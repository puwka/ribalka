import { monetizationDb, PAYMENT_STATUS } from '../lib/monetizationDb';
import { ApiError } from '../lib/apiError';
import { localAuthStore } from '../lib/localAuthStore';
import { notificationService } from './notificationService';
import { createProviderPayment, getPaymentPublicConfig, PAYMENT_PROVIDERS } from './payments/providers';
import { plansService } from './plansService';

function addDays(iso, days) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export const paymentService = {
  statuses: PAYMENT_STATUS,
  providers: PAYMENT_PROVIDERS,
  getPublicConfig: getPaymentPublicConfig,

  async listMine(userId) {
    const rows = await monetizationDb.listPaymentsByUser(userId);
    return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async listAll() {
    const rows = await monetizationDb.listPayments();
    return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  async get(id, { userId, isAdmin } = {}) {
    const row = await monetizationDb.getPayment(id);
    if (!row) throw new ApiError('Платёж не найден', { status: 404 });
    if (!isAdmin && row.user_id !== userId) throw new ApiError('Нет доступа', { status: 403 });
    return row;
  },

  /**
   * Create payment for plan renewal / switch.
   */
  async createPlanPayment({
    userId,
    planId,
    billingPeriod = 'month',
    provider = 'yookassa',
  }) {
    if (!userId) throw new ApiError('Нужна авторизация');
    const plan = await plansService.get(planId);
    if (!plan || !plan.is_active) throw new ApiError('Тариф недоступен');

    const amount =
      billingPeriod === 'year' ? Number(plan.price_year) : Number(plan.price_month);
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError('Некорректная сумма тарифа');

    const paymentId = crypto.randomUUID();
    const providerResult = await createProviderPayment({
      provider,
      amount,
      currency: plan.currency || 'RUB',
      description: `Тариф «${plan.name}» (${billingPeriod === 'year' ? 'год' : 'месяц'})`,
      paymentId,
      metadata: { plan_id: plan.id, plan_code: plan.code, billing_period: billingPeriod },
    });

    const payment = {
      id: paymentId,
      user_id: userId,
      plan_id: plan.id,
      plan_code: plan.code,
      plan_name: plan.name,
      billing_period: billingPeriod,
      amount,
      currency: plan.currency || 'RUB',
      status: PAYMENT_STATUS.PENDING,
      provider: providerResult.provider,
      provider_payment_id: providerResult.provider_payment_id,
      confirmation_url: providerResult.confirmation_url,
      provider_mode: providerResult.mode,
      needs_server: Boolean(providerResult.needsServer),
      provider_message: providerResult.message || null,
      description: `Оплата тарифа «${plan.name}»`,
      error_message: null,
      subscription_id: null,
      meta: {
        edge: providerResult.edgeFunction || null,
        payload: providerResult.payload || null,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      paid_at: null,
      canceled_at: null,
      failed_at: null,
    };

    await monetizationDb.putPayment(payment);
    notificationService.notify(userId, {
      type: 'payment',
      title: 'Платёж создан',
      body: `${amount} ₽ · ${plan.name} · ${payment.status}`,
      link_path: '/owner/payments',
    });
    return payment;
  },

  async markSucceeded(paymentId, { providerPayload = {}, userId, isAdmin = false } = {}) {
    const payment = await monetizationDb.getPayment(paymentId);
    if (!payment) throw new ApiError('Платёж не найден');
    if (!isAdmin && userId && payment.user_id !== userId) {
      throw new ApiError('Нет доступа к платежу', { status: 403 });
    }
    if (providerPayload?.simulate) {
      const simulateAllowed =
        import.meta.env.DEV || import.meta.env.VITE_PAYMENTS_SIMULATE !== 'false';
      if (!simulateAllowed) {
        throw new ApiError('Симуляция оплаты отключена', { status: 403 });
      }
      if (!isAdmin && (!userId || payment.user_id !== userId)) {
        throw new ApiError('Симуляция доступна только владельцу платежа', { status: 403 });
      }
    } else if (!isAdmin && !userId) {
      throw new ApiError('Нужна авторизация для подтверждения платежа', { status: 401 });
    }
    if (payment.status === PAYMENT_STATUS.SUCCEEDED) return payment;
    if (![PAYMENT_STATUS.PENDING, PAYMENT_STATUS.FAILED].includes(payment.status)) {
      throw new ApiError(`Нельзя подтвердить платёж в статусе ${payment.status}`);
    }

    payment.status = PAYMENT_STATUS.SUCCEEDED;
    payment.paid_at = new Date().toISOString();
    payment.error_message = null;
    payment.meta = { ...(payment.meta || {}), providerPayload };
    await monetizationDb.putPayment(payment);

    const sub = await this._applySubscriptionFromPayment(payment);
    payment.subscription_id = sub.id;
    await monetizationDb.putPayment(payment);

    notificationService.notify(payment.user_id, {
      type: 'subscription',
      title: 'Оплата успешна',
      body: `Тариф «${payment.plan_name}» активен до ${new Date(sub.current_period_end).toLocaleDateString('ru-RU')}`,
      link_path: '/owner/subscription',
    });

    // mirror legacy localAuthStore for dashboard compatibility
    try {
      localAuthStore.renewSubscription(payment.user_id, payment.plan_code);
    } catch {
      /* optional */
    }

    return payment;
  },

  async markFailed(paymentId, errorMessage = 'Ошибка оплаты') {
    const payment = await monetizationDb.getPayment(paymentId);
    if (!payment) throw new ApiError('Платёж не найден');
    if (payment.status === PAYMENT_STATUS.SUCCEEDED) {
      throw new ApiError('Успешный платёж нельзя пометить ошибкой');
    }
    payment.status = PAYMENT_STATUS.FAILED;
    payment.failed_at = new Date().toISOString();
    payment.error_message = errorMessage;
    await monetizationDb.putPayment(payment);
    notificationService.notify(payment.user_id, {
      type: 'payment',
      title: 'Ошибка оплаты',
      body: errorMessage,
      link_path: '/owner/payments',
    });
    return payment;
  },

  async cancel(paymentId, { userId, isAdmin } = {}) {
    const payment = await this.get(paymentId, { userId, isAdmin });
    if (payment.status !== PAYMENT_STATUS.PENDING) {
      throw new ApiError('Отменить можно только pending');
    }
    payment.status = PAYMENT_STATUS.CANCELED;
    payment.canceled_at = new Date().toISOString();
    await monetizationDb.putPayment(payment);
    notificationService.notify(payment.user_id, {
      type: 'payment',
      title: 'Платёж отменён',
      body: payment.plan_name,
      link_path: '/owner/payments',
    });
    return payment;
  },

  /**
   * Webhook entry (called from Edge Function after signature verify).
   */
  async handleProviderWebhook({ provider, event, paymentId, externalId, success }) {
    const payment =
      (paymentId && (await monetizationDb.getPayment(paymentId))) ||
      (await this._findByProviderId(provider, externalId));
    if (!payment) throw new ApiError('Платёж не найден для webhook');

    if (success || event === 'payment.succeeded' || event === 'ResultURL') {
      return this.markSucceeded(payment.id, {
        isAdmin: true,
        providerPayload: { provider, event, externalId },
      });
    }
    if (event === 'payment.canceled' || event === 'Cancel') {
      return this.cancel(payment.id, { userId: payment.user_id, isAdmin: true });
    }
    return this.markFailed(payment.id, `Провайдер ${provider}: ${event || 'failed'}`);
  },

  async getActiveSubscription(userId) {
    const list = await monetizationDb.listSubscriptionsByUser(userId);
    const active = list
      .filter((s) => s.status === 'active' || s.status === 'trialing')
      .sort((a, b) => String(b.current_period_end).localeCompare(String(a.current_period_end)));
    return active[0] || null;
  },

  async _applySubscriptionFromPayment(payment) {
    const plan = await plansService.get(payment.plan_id);
    const days =
      payment.billing_period === 'year'
        ? plan?.period_days_year || 365
        : plan?.period_days_month || 30;

    const existing = await this.getActiveSubscription(payment.user_id);
    const now = new Date().toISOString();
    const baseEnd =
      existing && new Date(existing.current_period_end) > new Date()
        ? existing.current_period_end
        : now;

    const sub = {
      id: existing?.id || crypto.randomUUID(),
      user_id: payment.user_id,
      plan_id: payment.plan_id,
      plan_code: payment.plan_code,
      status: 'active',
      billing_period: payment.billing_period,
      current_period_start: now,
      current_period_end: addDays(baseEnd, days),
      cancel_at: null,
      last_payment_id: payment.id,
      created_at: existing?.created_at || now,
      updated_at: now,
    };
    await monetizationDb.putSubscription(sub);
    return sub;
  },

  async _findByProviderId(provider, externalId) {
    if (!externalId) return null;
    const all = await monetizationDb.listPayments();
    return all.find((p) => p.provider === provider && p.provider_payment_id === externalId) || null;
  },
};
