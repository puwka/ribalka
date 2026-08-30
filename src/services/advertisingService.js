import { monetizationDb, AD_TYPES, AD_STATUS } from '../lib/monetizationDb';
import { ApiError } from '../lib/apiError';
import { assertAdmin } from '../lib/assertAdmin';
import { notificationService } from './notificationService';
import { paymentService } from './paymentService';
import { plansService } from './plansService';

const AD_TYPE_LABELS = {
  banner: 'Баннер',
  search_promo: 'Продвижение в поиске',
  featured: 'Featured размещение',
  mailing: 'Рассылка',
  promo_campaign: 'Участие в акции',
};

const AD_PRICES = {
  banner: 3500,
  search_promo: 4900,
  featured: 7900,
  mailing: 9900,
  promo_campaign: 5900,
};

export const advertisingService = {
  types: AD_TYPES,
  statuses: AD_STATUS,
  typeLabels: AD_TYPE_LABELS,
  catalogPrices: AD_PRICES,

  async listMine(ownerId) {
    const rows = await monetizationDb.listAdOrdersByOwner(ownerId);
    return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async listForModeration(status = 'pending') {
    const rows = await monetizationDb.listAdOrders();
    const filtered = status === 'all' ? rows : rows.filter((a) => a.status === status);
    return filtered.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async listActivePublic() {
    const rows = await monetizationDb.listAdOrders();
    const now = Date.now();
    return rows.filter((a) => {
      if (a.status !== AD_STATUS.ACTIVE) return false;
      if (a.starts_at && new Date(a.starts_at).getTime() > now) return false;
      if (a.ends_at && new Date(a.ends_at).getTime() < now) return false;
      return true;
    });
  },

  async createOrder(ownerId, input) {
    if (!ownerId) throw new ApiError('Нужна авторизация');
    if (!input.title?.trim()) throw new ApiError('Укажите заголовок');
    const adType = input.ad_type || AD_TYPES.BANNER;
    if (!AD_TYPE_LABELS[adType]) throw new ApiError('Неизвестный тип рекламы');

    const sub = await paymentService.getActiveSubscription(ownerId);
    let planLimits = { ads_active: 1 };
    if (sub?.plan_id) {
      const plan = await plansService.get(sub.plan_id);
      if (plan?.limits) planLimits = plan.limits;
    }

    const activeCount = (await this.listMine(ownerId)).filter((a) =>
      [AD_STATUS.ACTIVE, AD_STATUS.APPROVED, AD_STATUS.PENDING].includes(a.status)
    ).length;
    void activeCount;
    void planLimits;

    const now = new Date().toISOString();
    const order = {
      id: crypto.randomUUID(),
      owner_id: ownerId,
      ad_type: adType,
      title: input.title.trim(),
      description: (input.description || '').trim(),
      target_url: (input.target_url || '').trim(),
      base_id: input.base_id || null,
      budget: Number(input.budget ?? AD_PRICES[adType] ?? 0),
      currency: 'RUB',
      status: input.submit ? AD_STATUS.PENDING : AD_STATUS.DRAFT,
      starts_at: input.starts_at || null,
      ends_at: input.ends_at || null,
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
        link_path: '/owner/advertising',
      });
    }
    return order;
  },

  async updateMine(ownerId, orderId, patch) {
    const row = await monetizationDb.getAdOrder(orderId);
    if (!row || row.owner_id !== ownerId) throw new ApiError('Заявка не найдена', { status: 404 });
    if (![AD_STATUS.DRAFT, AD_STATUS.REJECTED].includes(row.status)) {
      throw new ApiError('Редактировать можно черновик или отклонённую заявку');
    }
    Object.assign(row, {
      title: patch.title?.trim() ?? row.title,
      description: patch.description ?? row.description,
      target_url: patch.target_url ?? row.target_url,
      base_id: patch.base_id ?? row.base_id,
      ad_type: patch.ad_type ?? row.ad_type,
      budget: patch.budget != null ? Number(patch.budget) : row.budget,
      starts_at: patch.starts_at ?? row.starts_at,
      ends_at: patch.ends_at ?? row.ends_at,
    });
    return monetizationDb.putAdOrder(row);
  },

  async submit(ownerId, orderId) {
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
      link_path: '/owner/advertising',
    });
    return row;
  },

  async moderate(adminId, orderId, { action, note = '', patch = {} }) {
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

    if (action === 'approve') row.status = AD_STATUS.APPROVED;
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
      link_path: '/owner/advertising',
    });
    return row;
  },

  async adminCreate(adminId, input) {
    await assertAdmin(adminId);
    const now = new Date().toISOString();
    const order = {
      id: crypto.randomUUID(),
      owner_id: input.owner_id || adminId,
      ad_type: input.ad_type || AD_TYPES.BANNER,
      title: (input.title || 'Реклама').trim(),
      description: (input.description || '').trim(),
      target_url: (input.target_url || '').trim(),
      base_id: input.base_id || null,
      budget: Number(input.budget ?? 0),
      currency: 'RUB',
      status: input.status || AD_STATUS.ACTIVE,
      starts_at: input.starts_at || now,
      ends_at: input.ends_at || null,
      moderation_note: 'Создано администратором',
      moderated_by: adminId,
      moderated_at: now,
      created_at: now,
      updated_at: now,
    };
    return monetizationDb.putAdOrder(order);
  },
};
