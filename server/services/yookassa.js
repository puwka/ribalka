/**
 * YooKassa API client (server-only).
 * Docs: https://yookassa.ru/developers/payment-acceptance/getting-started/quick-start
 */
import { randomUUID } from 'node:crypto';

const API_BASE = 'https://api.yookassa.ru/v3';

function getCredentials() {
  const shopId = process.env.YOOKASSA_SHOP_ID || '';
  const secretKey = process.env.YOOKASSA_SECRET_KEY || '';
  const mode = (process.env.PAYMENT_MODE || 'test').toLowerCase();
  return { shopId, secretKey, mode };
}

export function isYooKassaConfigured() {
  const { shopId, secretKey } = getCredentials();
  return Boolean(shopId && secretKey);
}

function authHeader() {
  const { shopId, secretKey } = getCredentials();
  if (!shopId || !secretKey) {
    const err = new Error('YooKassa is not configured (YOOKASSA_SHOP_ID / YOOKASSA_SECRET_KEY)');
    err.status = 503;
    throw err;
  }
  return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`;
}

async function yooRequest(method, path, { body, idempotenceKey } = {}) {
  const headers = {
    Authorization: authHeader(),
    'Content-Type': 'application/json',
  };
  if (idempotenceKey) {
    headers['Idempotence-Key'] = idempotenceKey;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const message =
      data?.description || data?.message || data?.error || `YooKassa HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.details = data;
    console.error('[yookassa]', method, path, res.status, message);
    throw err;
  }
  return data;
}

/**
 * Create one-stage payment with redirect confirmation.
 * @param {{
 *   amount: number|string,
 *   currency?: string,
 *   description: string,
 *   returnUrl: string,
 *   metadata: Record<string, string>,
 *   idempotenceKey?: string,
 * }} opts
 */
export async function createPayment(opts) {
  const idempotenceKey = opts.idempotenceKey || randomUUID();
  const amountValue = Number(opts.amount).toFixed(2);

  const payload = {
    amount: {
      value: amountValue,
      currency: opts.currency || 'RUB',
    },
    capture: true,
    confirmation: {
      type: 'redirect',
      return_url: opts.returnUrl,
    },
    description: (opts.description || 'Оплата').slice(0, 128),
    metadata: opts.metadata || {},
  };

  const payment = await yooRequest('POST', '/payments', {
    body: payload,
    idempotenceKey,
  });

  console.log('[yookassa] payment created', payment.id, payment.status, amountValue);
  return { payment, idempotenceKey };
}

export async function getPayment(paymentId) {
  if (!paymentId) throw new Error('paymentId required');
  return yooRequest('GET', `/payments/${encodeURIComponent(paymentId)}`);
}

export function newIdempotenceKey() {
  return randomUUID();
}
