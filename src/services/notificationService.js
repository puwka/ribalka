/**
 * Central in-app notifications + preference-aware delivery.
 * Email campaigns are queued via emailOutbox (architecture for future SMTP/Resend).
 */

import { localAuthStore } from '../lib/localAuthStore';
import { supabase, supabaseDataEnabled } from '../lib/supabase';
import { emailOutbox } from './email/emailOutbox';

export const NOTIFICATION_TYPES = {
  SYSTEM: 'system',
  BOOKING: 'booking',
  REPORT: 'report',
  FAVORITE: 'favorite',
  OWNER: 'owner',
  MODERATION: 'moderation',
  FORUM: 'forum',
  ACHIEVEMENT: 'achievement',
  COMMENT: 'comment',
  SUBSCRIPTION: 'subscription',
};

/** Maps notification type → settings.inApp key */
const IN_APP_PREF_KEY = {
  system: 'system',
  booking: 'booking',
  report: 'report',
  favorite: 'favorite',
  owner: 'owner',
  moderation: 'moderation',
  forum: 'forum',
  achievement: 'achievement',
  comment: 'comment',
  subscription: 'subscription',
  payment: 'subscription',
  reply: 'forum',
  referral: 'system',
};

export const DEFAULT_NOTIFICATION_SETTINGS = {
  inApp: {
    system: true,
    booking: true,
    report: true,
    favorite: true,
    owner: true,
    moderation: true,
    forum: true,
    achievement: true,
    comment: true,
    subscription: true,
  },
  email: {
    weeklyDigest: true,
    newBases: true,
    biteForecast: true,
    news: true,
  },
  push: {
    enabled: false,
  },
};

function mergeSettings(raw) {
  const base = structuredClone(DEFAULT_NOTIFICATION_SETTINGS);
  if (!raw || typeof raw !== 'object') return base;
  return {
    inApp: { ...base.inApp, ...(raw.inApp || {}) },
    email: { ...base.email, ...(raw.email || {}) },
    push: { ...base.push, ...(raw.push || {}) },
  };
}

export const notificationService = {
  types: NOTIFICATION_TYPES,

  getSettings(userId) {
    return mergeSettings(localAuthStore.getNotificationSettings(userId));
  },

  saveSettings(userId, patch) {
    const next = mergeSettings({
      ...this.getSettings(userId),
      ...patch,
      inApp: { ...this.getSettings(userId).inApp, ...(patch.inApp || {}) },
      email: { ...this.getSettings(userId).email, ...(patch.email || {}) },
      push: { ...this.getSettings(userId).push, ...(patch.push || {}) },
    });
    localAuthStore.setNotificationSettings(userId, next);
    return next;
  },

  list(userId, { unreadOnly = false } = {}) {
    let list = localAuthStore.getNotifications(userId) || [];
    if (unreadOnly) list = list.filter((n) => !n.is_read);
    return list;
  },

  unreadCount(userId) {
    return this.list(userId, { unreadOnly: true }).length;
  },

  /**
   * Preference-aware push to inbox. Returns null if skipped by settings.
   */
  notify(userId, { type = 'system', title, body = '', link_path = null, payload = {} }) {
    if (!userId || !title) return null;
    const settings = this.getSettings(userId);
    const prefKey = IN_APP_PREF_KEY[type] || 'system';
    if (settings.inApp[prefKey] === false) return null;

    const item = localAuthStore.pushNotification(userId, {
      type,
      title,
      body,
      link_path,
      payload,
    });

    // Browser Notification API (optional, when permitted)
    try {
      if (
        settings.push.enabled &&
        typeof Notification !== 'undefined' &&
        Notification.permission === 'granted'
      ) {
        // eslint-disable-next-line no-new
        new Notification(title, { body, icon: '/icons/icon-192.png' });
      }
    } catch {
      /* ignore */
    }

    return item;
  },

  markRead(userId, id) {
    if (supabaseDataEnabled && supabase) {
      void supabase.from('notifications').update({ is_read: true }).eq('id', id).eq('user_id', userId);
    }
    try {
      return localAuthStore.markNotificationRead(userId, id);
    } catch {
      return null;
    }
  },

  markAllRead(userId) {
    if (supabaseDataEnabled && supabase) {
      void supabase.from('notifications').update({ is_read: true }).eq('user_id', userId).eq('is_read', false);
    }
    try {
      return localAuthStore.markAllNotificationsRead(userId);
    } catch {
      return [];
    }
  },

  remove(userId, id) {
    return localAuthStore.removeNotification(userId, id);
  },

  clearRead(userId) {
    return localAuthStore.clearReadNotifications(userId);
  },

  async requestPushPermission(userId) {
    if (typeof Notification === 'undefined') {
      return { ok: false, reason: 'unsupported' };
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      this.saveSettings(userId, { push: { enabled: true } });
      return { ok: true, permission: perm };
    }
    this.saveSettings(userId, { push: { enabled: false } });
    return { ok: false, permission: perm };
  },

  /* ——— Domain helpers ——— */

  notifySystem(userId, title, body, link_path = null) {
    return this.notify(userId, { type: NOTIFICATION_TYPES.SYSTEM, title, body, link_path });
  },

  notifyBooking(userId, title, body, link_path) {
    return this.notify(userId, { type: NOTIFICATION_TYPES.BOOKING, title, body, link_path });
  },

  notifyOwner(userId, title, body, link_path) {
    return this.notify(userId, { type: NOTIFICATION_TYPES.OWNER, title, body, link_path });
  },

  notifyFavorite(userId, title, body, link_path) {
    return this.notify(userId, { type: NOTIFICATION_TYPES.FAVORITE, title, body, link_path });
  },

  notifyReport(userId, title, body, link_path) {
    return this.notify(userId, { type: NOTIFICATION_TYPES.REPORT, title, body, link_path });
  },

  /**
   * When a report is approved — notify users who favorited that base/place.
   */
  async notifyFavoritePlaceOwnersAboutReport(report, { listFavoritesByTarget }) {
    if (!report?.baseId || !listFavoritesByTarget) return;
    const fans = await listFavoritesByTarget(report.baseId);
    for (const fav of fans) {
      if (fav.user_id === report.authorUserId) continue;
      this.notifyReport(
        fav.user_id,
        'Новый отчёт по избранному месту',
        `${report.place}: ${report.fish || 'улов'}`,
        `/reports/${report.id}`
      );
    }
  },

  /**
   * Owner: someone favorited their base.
   */
  notifyOwnerBaseFavorited(ownerId, baseName, byUserName) {
    if (!ownerId) return null;
    return this.notifyOwner(
      ownerId,
      'База добавлена в избранное',
      `${byUserName || 'Пользователь'} сохранил «${baseName}»`,
      '/owner'
    );
  },

  /* ——— Email architecture hooks ——— */

  queueEmail(userId, campaign, payload = {}) {
    const settings = this.getSettings(userId);
    if (settings.email[campaign] === false) return null;
    return emailOutbox.enqueue({
      userId,
      campaign,
      payload,
      createdAt: new Date().toISOString(),
    });
  },

  /**
   * Weekly job entrypoint (call from cron / Edge Function later).
   */
  async scheduleWeeklyDigests(userIds, buildDigest) {
    const jobs = [];
    for (const userId of userIds) {
      const settings = this.getSettings(userId);
      if (!settings.email.weeklyDigest) continue;
      const digest = typeof buildDigest === 'function' ? await buildDigest(userId) : {};
      jobs.push(this.queueEmail(userId, 'weeklyDigest', digest));
    }
    return jobs.filter(Boolean);
  },
};
