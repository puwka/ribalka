import { monetizationDb } from '../lib/monetizationDb';
import { ApiError } from '../lib/apiError';
import { assertAdmin } from '../lib/assertAdmin';

async function requireAdmin(adminId) {
  await assertAdmin(adminId);
}

function normalizePlan(input, existing = null) {
  const code = (input.code || existing?.code || '').trim();
  if (!code) throw new ApiError('Укажите code тарифа');
  const planName = String(input.name || existing?.name || '').trim();
  if (!planName) throw new ApiError('Укажите название');

  const priceMonth = Number(input.price_month ?? existing?.price_month ?? 0);
  const priceYear = Number(input.price_year ?? existing?.price_year ?? 0);
  let discount = Number(input.discount_year_percent ?? existing?.discount_year_percent ?? 0);
  if (!discount && priceMonth > 0 && priceYear > 0) {
    const full = priceMonth * 12;
    discount = Math.max(0, Math.round((1 - priceYear / full) * 100));
  }

  return {
    id: existing?.id || input.id || crypto.randomUUID(),
    code,
    name: planName,
    description: (input.description ?? existing?.description ?? '').trim(),
    price_month: priceMonth,
    price_year: priceYear,
    currency: input.currency || existing?.currency || 'RUB',
    period_days_month: Number(input.period_days_month ?? existing?.period_days_month ?? 30),
    period_days_year: Number(input.period_days_year ?? existing?.period_days_year ?? 365),
    discount_year_percent: discount,
    features: Array.isArray(input.features)
      ? input.features.map((f) => String(f).trim()).filter(Boolean)
      : existing?.features || [],
    limits: {
      bases: Number(input.limits?.bases ?? existing?.limits?.bases ?? 1),
      ads_active: Number(input.limits?.ads_active ?? existing?.limits?.ads_active ?? 0),
      featured: Boolean(input.limits?.featured ?? existing?.limits?.featured),
      search_boost: Boolean(input.limits?.search_boost ?? existing?.limits?.search_boost),
      mailing: Boolean(input.limits?.mailing ?? existing?.limits?.mailing),
    },
    target_role: input.target_role || existing?.target_role || 'owner',
    is_active: input.is_active !== undefined ? Boolean(input.is_active) : existing?.is_active !== false,
    sort_order: Number(input.sort_order ?? existing?.sort_order ?? 100),
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export const plansService = {
  async list({ activeOnly = false, role = null } = {}) {
    let rows = await monetizationDb.listPlans();
    if (activeOnly) rows = rows.filter((p) => p.is_active);
    if (role) rows = rows.filter((p) => p.target_role === role || p.target_role === 'all');
    return rows.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  },

  async get(id) {
    return monetizationDb.getPlan(id);
  },

  async getByCode(code) {
    return monetizationDb.getPlanByCode(code);
  },

  async create(adminId, input) {
    await requireAdmin(adminId);
    const existingCode = await monetizationDb.getPlanByCode((input.code || '').trim());
    if (existingCode) throw new ApiError('Такой code уже есть');
    const plan = normalizePlan(input);
    return monetizationDb.putPlan(plan);
  },

  async update(adminId, planId, input) {
    await requireAdmin(adminId);
    const existing = await monetizationDb.getPlan(planId);
    if (!existing) throw new ApiError('Тариф не найден');
    if (input.code && input.code !== existing.code) {
      const clash = await monetizationDb.getPlanByCode(input.code.trim());
      if (clash) throw new ApiError('Такой code уже есть');
    }
    return monetizationDb.putPlan(normalizePlan(input, existing));
  },

  async setActive(adminId, planId, isActive) {
    await requireAdmin(adminId);
    const existing = await monetizationDb.getPlan(planId);
    if (!existing) throw new ApiError('Тариф не найден');
    existing.is_active = Boolean(isActive);
    return monetizationDb.putPlan(existing);
  },

  async remove(adminId, planId) {
    await requireAdmin(adminId);
    await monetizationDb.deletePlan(planId);
  },
};
