import { monetizationDb, AD_TYPES, AD_STATUS } from '../lib/monetizationDb';
import { ApiError } from '../lib/apiError';
import { assertAdmin } from '../lib/assertAdmin';
import { notificationService } from './notificationService';
import { paymentService } from './paymentService';
import { plansService } from './plansService';
import { api, apiDataEnabled } from '../lib/apiClient';

const AD_TYPE_LABELS = {
  banner: 'Баннер',
  sidebar: 'Боковой баннер',
  search_promo: 'Продвижение в поиске',
  featured: 'Избранное размещение',
  mailing: 'Рассылка',
  promo_campaign: 'Участие в акции',
};

const AD_PRICES = {
  banner: 3500,
  sidebar: 300,
  search_promo: 4900,
  featured: 7900,
  mailing: 9900,
  promo_campaign: 5900,
};

const STATUS_RU = {
  draft: 'Черновик',
  pending: 'На модерации',
  approved: 'Одобрено',
  active: 'Активно',
  rejected: 'Отклонено',
  paused: 'Пауза',
  disabled: 'Отключено',
  expired: 'Срок истёк',
  all: 'Все',
};

export const advertisingService = {
  types: { ...AD_TYPES, SIDEBAR: 'sidebar' },
  statuses: AD_STATUS,
  typeLabels: AD_TYPE_LABELS,
  catalogPrices: AD_PRICES,
  statusLabels: STATUS_RU,

  async getSidebarPrice() {
    if (apiDataEnabled) {
      return api.get('/api/ads/sidebar/price');
    }
    return {
      title: 'Боковой баннер',
      amount: AD_PRICES.sidebar,
      currency: 'RUB',
      unit: 'day',
      slotsPerSide: 2,
      recommendedSize: { width: 200, height: 300, label: '200×300' },
      enabled: true,
    };
  },

  async getSlots() {
    if (apiDataEnabled) {
      return api.get('/api/ads/sidebar/slots');
    }
    return {
      slotsPerSide: 2,
      slots: {
        news: { left: { used: 0, total: 2, free: 2 }, right: { used: 0, total: 2, free: 2 } },
        forum: { left: { used: 0, total: 2, free: 2 }, right: { used: 0, total: 2, free: 2 } },
      },
    };
  },

  async listPublicSidebar() {
    if (apiDataEnabled) {
      return api.get('/api/ads/sidebar/public');
    }
    const active = await this.listActivePublic();
    const sidebars = active.filter((a) => a.ad_type === 'sidebar' || a.ad_type === 'banner');
    return {
      left: sidebars.filter((a) => a.placement === 'left'),
      right: sidebars.filter((a) => a.placement !== 'left'),
    };
  },

  async listMine(ownerId) {
    if (apiDataEnabled) {
      return api.get('/api/ads/mine');
    }
    const rows = await monetizationDb.listAdOrdersByOwner(ownerId);
    return rows
      .filter((a) => a.ad_type === 'sidebar' || !a.ad_type)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async listForModeration(status = 'pending') {
    if (apiDataEnabled) {
      const qs = status ? `?status=${encodeURIComponent(status)}` : '';
      return api.get(`/api/ads/moderation${qs}`);
    }
    const rows = await monetizationDb.listAdOrders();
    const filtered = status === 'all' ? rows : rows.filter((a) => a.status === status);
    return filtered.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async listActivePublic(surface = 'news') {
    if (apiDataEnabled) {
      const data = await api.get(
        `/api/ads/sidebar/public?surface=${encodeURIComponent(surface || 'news')}`
      );
      return [...(data.left || []), ...(data.right || [])];
    }
    const rows = await monetizationDb.listAdOrders();
    const now = Date.now();
    const surf = surface || 'news';
    return rows.filter((a) => {
      if (a.status !== AD_STATUS.ACTIVE) return false;
      if ((a.surface || 'news') !== surf) return false;
      if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
      if (a.ends_at && new Date(a.ends_at).getTime() < now) return false;
      return true;
    });
  },

  async createSidebarBanner(ownerId, input) {
    if (!ownerId) throw new ApiError('Нужна авторизация');
    if (apiDataEnabled) {
      return api.post('/api/ads/sidebar', {
        title: input.title,
        target_url: input.target_url || input.targetUrl,
        image_url: input.image_url || input.imageUrl,
        placement: input.placement || 'right',
        surface: input.surface || 'news',
        days: input.days || input.months || 1,
      });
    }
    return this.createOrder(ownerId, {
      ...input,
      ad_type: 'sidebar',
      surface: input.surface || 'news',
      days: input.days || 1,
      budget: AD_PRICES.sidebar * (input.days || 1),
      submit: false,
    });
  },

  async updateMine(ownerId, orderId, patch) {
    if (apiDataEnabled) {
      return api.patch(`/api/ads/${encodeURIComponent(orderId)}`, {
        title: patch.title,
        target_url: patch.target_url || patch.targetUrl,
        image_url: patch.image_url || patch.imageUrl,
        placement: patch.placement,
        surface: patch.surface,
        days: patch.days,
      });
    }
    const row = await monetizationDb.getAdOrder(orderId);
    if (!row || row.owner_id !== ownerId) throw new ApiError('Заявка не найдена', { status: 404 });
    Object.assign(row, {
      title: patch.title?.trim() ?? row.title,
      target_url: patch.target_url ?? patch.targetUrl ?? row.target_url,
      image_url: patch.image_url ?? patch.imageUrl ?? row.image_url,
      placement: patch.placement ?? row.placement,
      surface: patch.surface ?? row.surface ?? 'news',
      days: patch.days != null && !row.paid_at ? Number(patch.days) : row.days,
      status: row.paid_at || ['pending', 'active', 'paused', 'rejected'].includes(row.status)
        ? AD_STATUS.PENDING
        : AD_STATUS.DRAFT,
      moderation_note: null,
      updated_at: new Date().toISOString(),
    });
    if (row.status === AD_STATUS.PENDING) {
      notificationService.notify(ownerId, {
        type: 'moderation',
        title: 'Баннер на модерации',
        body: row.title,
        link_path: '/cabinet/advertising',
      });
    }
    return monetizationDb.putAdOrder(row);
  },

  async deleteMine(ownerId, orderId) {
    if (apiDataEnabled) {
      return api.delete(`/api/ads/${encodeURIComponent(orderId)}`);
    }
    const row = await monetizationDb.getAdOrder(orderId);
    if (!row || row.owner_id !== ownerId) throw new ApiError('Заявка не найдена', { status: 404 });
    await monetizationDb.deleteAdOrder?.(orderId);
    return { ok: true, id: orderId };
  },

  async recordImpression(adId) {
    if (apiDataEnabled) {
      return api.post(`/api/ads/${encodeURIComponent(adId)}/impression`, {}).catch(() => null);
    }
    return null;
  },

  async recordClick(adId) {
    if (apiDataEnabled) {
      return api.post(`/api/ads/${encodeURIComponent(adId)}/click`, {}).catch(() => null);
    }
    return null;
  },

  async checkout(ownerId, adId) {
    if (apiDataEnabled) {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      return api.post(`/api/ads/${encodeURIComponent(adId)}/checkout`, {
        returnUrl: `${origin}/cabinet/advertising?paid=${adId}`,
      });
    }
    const row = await monetizationDb.getAdOrder(adId);
    if (!row || row.owner_id !== ownerId) throw new ApiError('Не найдено');
    row.status = AD_STATUS.PENDING;
    row.paid_at = new Date().toISOString();
    const days = Math.max(1, Number(row.days) || 1);
    row.ends_at = new Date(Date.now() + days * 86400000).toISOString();
    await monetizationDb.putAdOrder(row);
    notificationService.notify(ownerId, {
      type: 'payment',
      title: 'Реклама оплачена',
      body: row.title,
      link_path: '/cabinet/advertising',
    });
    return { ad: row, confirmationUrl: null };
  },

  async createOrder(ownerId, input) {
    if (!ownerId) throw new ApiError('Нужна авторизация');
    if (!input.title?.trim()) throw new ApiError('Укажите заголовок');
    const adType = input.ad_type || AD_TYPES.BANNER;
    if (!AD_TYPE_LABELS[adType] && adType !== 'sidebar') throw new ApiError('Неизвестный тип рекламы');

    const sub = await paymentService.getActiveSubscription(ownerId).catch(() => null);
    let planLimits = { ads_active: 1 };
    if (sub?.plan_id) {
      const plan = await plansService.get(sub.plan_id);
      if (plan?.limits) planLimits = plan.limits;
    }
    void planLimits;

    const days = Math.max(1, Number(input.days) || 1);
    const now = new Date().toISOString();
    const order = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      ad_type: adType,
      title: input.title.trim(),
      description: (input.description || '').trim(),
      target_url: (input.target_url || '').trim(),
      image_url: (input.image_url || input.imageUrl || '').trim(),
      placement: input.placement === 'left' ? 'left' : 'right',
      surface: input.surface === 'forum' ? 'forum' : 'news',
      base_id: input.base_id || null,
      budget: Number(input.budget ?? AD_PRICES[adType] ?? AD_PRICES.sidebar * days),
      days,
      currency: 'RUB',
      status: input.submit ? AD_STATUS.PENDING : AD_STATUS.DRAFT,
      starts_at: input.starts_at || null,
      ends_at: input.ends_at || null,
      views_count: 0,
      clicks_count: 0,
      moderation_note: null,
      moderated_by: null,
      moderated_at: null,
      created_at: now,
      updated_at: now,
    };

    await monetizationDb.putAdOrder(order);
    if (order.status === AD_STATUS.PENDING) {
      notificationService.notify(ownerId, {
        type: 'moderation',
        title: 'Реклама на модерации',
        body: order.title,
        link_path: '/cabinet/advertising',
      });
    }
    return order;
  },

  async submit(ownerId, orderId) {
    if (apiDataEnabled) {
      return this.checkout(ownerId, orderId);
    }
    const row = await monetizationDb.getAdOrder(orderId);
    if (!row || row.owner_id !== ownerId) throw new ApiError('Заявка не найдена');
    if (![AD_STATUS.DRAFT, AD_STATUS.REJECTED].includes(row.status)) {
      throw new ApiError('Уже отправлено');
    }
    row.status = AD_STATUS.PENDING;
    row.moderation_note = null;
    await monetizationDb.putAdOrder(row);
    notificationService.notify(ownerId, {
      type: 'moderation',
      title: 'Реклама отправлена',
      body: row.title,
      link_path: '/cabinet/advertising',
    });
    return row;
  },

  async verify(ownerId, adId, paymentId) {
    if (apiDataEnabled) {
      return api.post(`/api/ads/${encodeURIComponent(adId)}/verify`, { paymentId });
    }
    return this.checkout(ownerId, adId);
  },

  async moderate(adminId, orderId, { action, note = '', patch = {} }) {
    if (apiDataEnabled) {
      return api.post(`/api/ads/${encodeURIComponent(orderId)}/moderate`, { action, note });
    }
    await assertAdmin(adminId);
    const row = await monetizationDb.getAdOrder(orderId);
    if (!row) throw new ApiError('Заявка не найдена');

    if (Object.keys(patch).length) {
      Object.assign(row, {
        title: patch.title ?? row.title,
        description: patch.description ?? row.description,
        target_url: patch.target_url ?? row.target_url,
        budget: patch.budget != null ? Number(patch.budget) : row.budget,
        starts_at: patch.starts_at ?? row.starts_at,
        ends_at: patch.ends_at ?? row.ends_at,
        ad_type: patch.ad_type ?? row.ad_type,
      });
    }

    if (action === 'approve') row.status = AD_STATUS.ACTIVE;
    else if (action === 'activate' || action === 'enable') row.status = AD_STATUS.ACTIVE;
    else if (action === 'reject') row.status = AD_STATUS.REJECTED;
    else if (action === 'pause') row.status = AD_STATUS.PAUSED;
    else if (action === 'disable') row.status = AD_STATUS.DISABLED;
    else if (action === 'pending') row.status = AD_STATUS.PENDING;
    else throw new ApiError('Неизвестное действие');

    row.moderation_note = note || null;
    row.moderated_by = adminId;
    row.moderated_at = new Date().toISOString();
    await monetizationDb.putAdOrder(row);

    notificationService.notify(row.owner_id, {
      type: 'moderation',
      title: `Реклама: ${row.status}`,
      body: note || row.title,
      link_path: '/cabinet/advertising',
    });
    return row;
  },

  async adminCreate(adminId, input) {
    await assertAdmin(adminId);
    if (apiDataEnabled) {
      const ad = await api.post('/api/ads/sidebar', {
        title: input.title || 'Реклама',
        target_url: input.target_url || 'https://example.com',
        image_url: input.image_url || input.imageUrl || '/img/hero/header-img.jpeg',
        placement: input.placement || 'right',
        days: input.days || 1,
      });
      await api.post(`/api/ads/${ad.id}/checkout`, {});
      return api.post(`/api/ads/${ad.id}/moderate`, { action: 'approve', note: 'Создано администратором' });
    }
    const now = new Date().toISOString();
    const order = {
      id: crypto.randomUUID(),
      owner_id: input.owner_id || adminId,
      ad_type: input.ad_type || 'sidebar',
      title: (input.title || 'Реклама').trim(),
      description: (input.description || '').trim(),
      target_url: (input.target_url || '').trim(),
      image_url: (input.image_url || '').trim(),
      placement: input.placement === 'left' ? 'left' : 'right',
      surface: input.surface === 'forum' ? 'forum' : 'news',
      base_id: input.base_id || null,
      budget: Number(input.budget ?? 0),
      days: Number(input.days) || 1,
      currency: 'RUB',
      status: input.status || AD_STATUS.ACTIVE,
      starts_at: input.starts_at || now,
      ends_at: input.ends_at || null,
      views_count: 0,
      clicks_count: 0,
      moderation_note: 'Создано администратором',
      moderated_by: adminId,
      moderated_at: now,
      created_at: now,
      updated_at: now,
    };
    return monetizationDb.putAdOrder(order);
  },
};
