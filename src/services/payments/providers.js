/**
 * Payment providers — public config only in Vite env.
 * Secret keys MUST live in Edge Functions / server (.env without VITE_).
 *
 * YooKassa: YOOKASSA_SHOP_ID (public ok as VITE_), YOOKASSA_SECRET_KEY (server)
 * Robokassa: ROBOKASSA_MERCHANT_LOGIN (public), ROBOKASSA_PASSWORD1/2 (server)
 */

function publicEnv(name) {
  return (import.meta.env[name] || '').trim();
}

export function getPaymentPublicConfig() {
  return {
    yookassa: {
      shopId: publicEnv('VITE_YOOKASSA_SHOP_ID'),
      returnUrl: publicEnv('VITE_PAYMENT_RETURN_URL') || `${window.location.origin}/owner/payments/return`,
      enabled: Boolean(publicEnv('VITE_YOOKASSA_SHOP_ID')),
    },
    robokassa: {
      merchantLogin: publicEnv('VITE_ROBOKASSA_MERCHANT_LOGIN'),
      isTest: publicEnv('VITE_ROBOKASSA_IS_TEST') !== 'false',
      returnUrl: publicEnv('VITE_PAYMENT_RETURN_URL') || `${window.location.origin}/owner/payments/return`,
      enabled: Boolean(publicEnv('VITE_ROBOKASSA_MERCHANT_LOGIN')),
    },
    /** Local checkout simulator when real shops are not configured */
    simulateLocal: publicEnv('VITE_PAYMENTS_SIMULATE') !== 'false',
  };
}

/**
 * Creates provider payment intent.
 * Real integrations call Edge Function which holds secrets.
 */
export async function createProviderPayment({
  provider,
  amount,
  currency = 'RUB',
  description,
  paymentId,
  metadata = {},
}) {
  const cfg = getPaymentPublicConfig();

  if (provider === 'yookassa') {
    if (!cfg.yookassa.enabled) {
      return createSimulatedCheckout({
        provider: 'yookassa',
        paymentId,
        amount,
        reason: 'VITE_YOOKASSA_SHOP_ID не задан — локальный checkout',
      });
    }
    // Client never calls YooKassa with secret. Delegate to Edge Function.
    return {
      provider: 'yookassa',
      mode: 'edge',
      edgeFunction: 'create-yookassa-payment',
      confirmation_url: null,
      provider_payment_id: null,
      needsServer: true,
      payload: {
        shopId: cfg.yookassa.shopId,
        amount,
        currency,
        description,
        paymentId,
        returnUrl: `${cfg.yookassa.returnUrl}?payment_id=${paymentId}`,
        metadata,
      },
      message:
        'Создайте платёж через Edge Function create-yookassa-payment (секрет на сервере).',
    };
  }

  if (provider === 'robokassa') {
    if (!cfg.robokassa.enabled) {
      return createSimulatedCheckout({
        provider: 'robokassa',
        paymentId,
        amount,
        reason: 'VITE_ROBOKASSA_MERCHANT_LOGIN не задан — локальный checkout',
      });
    }
    return {
      provider: 'robokassa',
      mode: 'edge',
      edgeFunction: 'create-robokassa-payment',
      confirmation_url: null,
      provider_payment_id: null,
      needsServer: true,
      payload: {
        merchantLogin: cfg.robokassa.merchantLogin,
        amount,
        currency,
        description,
        paymentId,
        isTest: cfg.robokassa.isTest,
        returnUrl: `${cfg.robokassa.returnUrl}?payment_id=${paymentId}`,
        metadata,
      },
      message:
        'Подпись Robokassa формируется на сервере (PASSWORD1). Вызовите Edge Function.',
    };
  }

  return createSimulatedCheckout({ provider: provider || 'manual', paymentId, amount });
}

function createSimulatedCheckout({ provider, paymentId, amount, reason }) {
  const url = `/owner/payments/return?payment_id=${encodeURIComponent(paymentId)}&simulate=1&provider=${provider}`;
  return {
    provider,
    mode: 'simulate',
    confirmation_url: url,
    provider_payment_id: `sim_${paymentId}`,
    needsServer: false,
    message: reason || 'Локальный симулятор оплаты',
    amount,
  };
}

export const PAYMENT_PROVIDERS = ['yookassa', 'robokassa', 'manual'];
