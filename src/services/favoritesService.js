import { engagementDb } from '../lib/engagementDb';
import { basesService } from './basesService';
import { analyticsTracker } from './ownerDashboardService';
import { gamificationService } from './gamificationService';
import { notificationService } from './notificationService';
import { localAuthStore } from '../lib/localAuthStore';

export const FAVORITE_TYPES = {
  BASE: 'base',
  PLACE: 'place',
  REPORT: 'report',
};

function typeFromBase(item) {
  return item?.type === 'free' ? FAVORITE_TYPES.PLACE : FAVORITE_TYPES.BASE;
}

function snapshotFromBase(item) {
  return {
    name: item.name,
    short: item.short || item.short_description || '',
    price: item.price || item.price_label || '',
    address: item.address || '',
    fish: item.fish || item.fish_species || '',
    services: item.services || [],
    phone: item.phone || '',
    workHours: item.workHours || item.work_hours || '',
    image: item.images?.[0] || null,
    type: item.type,
    owner_id: item.ownerId || item.owner_id || null,
  };
}

function snapshotFromReport(report) {
  return {
    name: report.place || 'Отчёт',
    short: (report.description || '').slice(0, 140),
    author: report.author,
    date: report.date,
    fish: report.fish || '',
    rating: report.rating || 0,
    image: report.images?.[0] || null,
  };
}

export const favoritesService = {
  types: FAVORITE_TYPES,

  async list(userId, filter = 'all') {
    const type = filter === 'all' ? undefined : filter;
    const rows = await engagementDb.listFavorites(userId, type);
    return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async isFavorite(userId, type, targetId) {
    if (!userId) return false;
    return Boolean(await engagementDb.findFavorite(userId, type, targetId));
  },

  async toggleBaseOrPlace(userId, item) {
    if (!userId) throw new Error('Войдите, чтобы использовать избранное');
    const type = typeFromBase(item);
    const existing = await engagementDb.findFavorite(userId, type, item.id);
    if (existing) {
      await engagementDb.removeFavorite(userId, type, item.id);
      await analyticsTracker.trackFavorite(item, userId, false);
      await gamificationService.syncFromFavorites(userId);
      return { favorited: false, type };
    }
    await engagementDb.addFavorite({
      user_id: userId,
      type,
      target_id: String(item.id),
      snapshot: snapshotFromBase(item),
    });
    await analyticsTracker.trackFavorite(item, userId, true);
    await gamificationService.onFavoriteAdded(userId);

    const ownerId = item.ownerId || item.owner_id;
    const profile = localAuthStore.getPublicProfile(userId);
    notificationService.notifyOwnerBaseFavorited(
      ownerId,
      item.name,
      profile?.display_name
    );
    notificationService.notifyFavorite(
      userId,
      'Добавлено в избранное',
      item.name,
      type === FAVORITE_TYPES.PLACE ? '/free-waters' : '/paid-waters'
    );

    return { favorited: true, type };
  },

  async toggleReport(userId, report) {
    if (!userId) throw new Error('Войдите, чтобы использовать избранное');
    const type = FAVORITE_TYPES.REPORT;
    const existing = await engagementDb.findFavorite(userId, type, report.id);
    if (existing) {
      await engagementDb.removeFavorite(userId, type, report.id);
      await gamificationService.syncFromFavorites(userId);
      return { favorited: false, type };
    }
    await engagementDb.addFavorite({
      user_id: userId,
      type,
      target_id: String(report.id),
      snapshot: snapshotFromReport(report),
    });
    await gamificationService.onFavoriteAdded(userId);
    notificationService.notifyFavorite(
      userId,
      'Добавлено в избранное',
      snapshotFromReport(report).name,
      `/reports/${report.id}`
    );
    return { favorited: true, type };
  },

  async remove(userId, type, targetId) {
    await engagementDb.removeFavorite(userId, type, targetId);
    await gamificationService.syncFromFavorites(userId);
  },

  /**
   * Resolve compare rows for favorite bases/places (live data if still published).
   */
  async resolveForCompare(userId, ids) {
    const favs = await this.list(userId);
    const selected = favs.filter(
      (f) =>
        (f.type === FAVORITE_TYPES.BASE || f.type === FAVORITE_TYPES.PLACE) &&
        ids.includes(String(f.target_id))
    );

    const live = await basesService.listPublic();
    return selected.map((f) => {
      const found = live.find((b) => String(b.id) === String(f.target_id));
      const src = found || f.snapshot || {};
      return {
        id: f.target_id,
        type: f.type,
        name: src.name || f.snapshot?.name,
        price: src.price || src.price_label || f.snapshot?.price || '—',
        address: src.address || f.snapshot?.address || '—',
        fish: src.fish || src.fish_species || f.snapshot?.fish || '—',
        services: src.services || f.snapshot?.services || [],
        phone: src.phone || f.snapshot?.phone || '—',
        workHours: src.workHours || src.work_hours || f.snapshot?.workHours || '—',
        short: src.short || f.snapshot?.short || '',
      };
    });
  },
};
