import { pool } from '../db.js';
import * as yookassa from './yookassa.js';

const SETTINGS_KEY = 'base_listing';
const DEFAULT_LISTING = {
  title: 'Размещение рыболовной базы',
  amount: 5000,
  currency: 'RUB',
  enabled: true,
};

const ORDER_TTL_HOURS = 24;

export async function getListingPriceSettings() {
  const { rows } = await pool.query(
    'select value from public.site_settings where key = $1',
    [SETTINGS_KEY]
  );
  let value = rows[0]?.value ?? {};
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = {};
    }
  }
  const amount = Number(value.amount);
  return {
    title: value.title || DEFAULT_LISTING.title,
    amount: Number.isFinite(amount) ? amount : DEFAULT_LISTING.amount,
    currency: value.currency || DEFAULT_LISTING.currency,
    enabled: value.enabled !== false,
  };
}

export async function saveListingPriceSettings(adminId, input) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    const err = new Error('Некорректная цена');
    err.status = 400;
    throw err;
  }
  const value = {
    title: (input.title || DEFAULT_LISTING.title).trim() || DEFAULT_LISTING.title,
    amount,
    currency: 'RUB',
    enabled: input.enabled !== false && input.enabled !== '0' && input.enabled !== 0,
  };
  // Pass object — node-pg serializes jsonb correctly (avoid double-encoding)
  await pool.query(
    `insert into public.site_settings (key, value, updated_by, updated_at)
     values ($1, $2::jsonb, $3, now())
     on conflict (key) do update set
       value = excluded.value,
       updated_by = excluded.updated_by,
       updated_at = now()`,
    [SETTINGS_KEY, value, adminId]
  );
  return getListingPriceSettings();
}

function mapOrder(row) {
  if (!row) return null;
  return {
    ...row,
    amount: Number(row.amount),
  };
}

export async function getOrderById(orderId) {
  const { rows } = await pool.query('select * from public.listing_orders where id = $1', [orderId]);
  return mapOrder(rows[0]);
}

export async function getActiveOrderForBase(userId, baseId) {
  const { rows } = await pool.query(
    `select o.*, b.name as base_name
     from public.listing_orders o
     left join public.bases b on b.id = o.base_id
     where o.user_id = $1 and o.base_id = $2
       and o.status in ('pending', 'waiting_for_payment')
       and (o.expires_at is null or o.expires_at > now())
     order by o.created_at desc
     limit 1`,
    [userId, baseId]
  );
  return mapOrder(rows[0]);
}

async function getBaseOwned(baseId, userId) {
  const { rows } = await pool.query('select * from public.bases where id = $1', [baseId]);
  const base = rows[0];
  if (!base) {
    const err = new Error('База не найдена');
    err.status = 404;
    throw err;
  }
  if (base.owner_id !== userId) {
    const err = new Error('Нет доступа к этой базе');
    err.status = 403;
    throw err;
  }
  return base;
}

/**
 * Create order with price frozen from site_settings (never from client).
 * Then create YooKassa payment (or mark paid if amount=0).
 */
export async function createListingCheckout({ userId, baseId, returnUrl }) {
  const settings = await getListingPriceSettings();
  if (!settings.enabled) {
    const err = new Error('Размещение временно отключено');
    err.status = 403;
    throw err;
  }

  const base = await getBaseOwned(baseId, userId);
  if (!['draft', 'rejected'].includes(base.status)) {
    const err = new Error('Оплата доступна только для черновика или отклонённой базы');
    err.status = 400;
    throw err;
  }

  // Reuse active unpaid order for this base
  const { rows: existing } = await pool.query(
    `select * from public.listing_orders
     where base_id = $1 and user_id = $2
       and status in ('pending', 'waiting_for_payment')
       and (expires_at is null or expires_at > now())
     order by created_at desc
     limit 1`,
    [baseId, userId]
  );
  let order = mapOrder(existing[0]);

  // If unpaid order has no YooKassa payment yet — sync amount to current admin price
  if (order && !order.provider_payment_id && Number(order.amount) !== Number(settings.amount)) {
    const { rows: updated } = await pool.query(
      `update public.listing_orders
       set amount = $2, description = $3, updated_at = now()
       where id = $1
       returning *`,
      [
        order.id,
        settings.amount,
        `${settings.title}: «${base.name}»`.slice(0, 128),
      ]
    );
    order = mapOrder(updated[0]);
  }

  // If unpaid order already has YooKassa payment at old amount — cancel and create new
  if (
    order &&
    order.provider_payment_id &&
    Number(order.amount) !== Number(settings.amount)
  ) {
    await pool.query(
      `update public.listing_orders
       set status = 'cancelled', updated_at = now(),
           meta = coalesce(meta, '{}'::jsonb) || '{"reason":"price_changed"}'::jsonb
       where id = $1 and status in ('pending', 'waiting_for_payment')`,
      [order.id]
    );
    order = null;
  }

  if (!order) {
    const expiresAt = new Date(Date.now() + ORDER_TTL_HOURS * 3600 * 1000).toISOString();
    const description = `${settings.title}: «${base.name}»`.slice(0, 128);
    const { rows } = await pool.query(
      `insert into public.listing_orders
        (user_id, base_id, amount, currency, status, description, expires_at, payment_provider)
       values ($1, $2, $3, $4, 'pending', $5, $6, 'yookassa')
       returning *`,
      [userId, baseId, settings.amount, settings.currency, description, expiresAt]
    );
    order = mapOrder(rows[0]);
  }

  // Zero price — skip YooKassa
  if (Number(order.amount) === 0) {
    return markOrderPaid(order.id, { providerPaymentId: null, skipYoo: true });
  }

  if (!yookassa.isYooKassaConfigured()) {
    const err = new Error('Платёжная система не настроена на сервере');
    err.status = 503;
    throw err;
  }

  // Active payment already has confirmation URL
  if (order.provider_payment_id && order.confirmation_url && order.status === 'waiting_for_payment') {
    const remote = await yookassa.getPayment(order.provider_payment_id).catch(() => null);
    if (remote?.status === 'succeeded' && remote.paid) {
      return finalizePaidFromYooKassa(order, remote);
    }
    if (remote && !['canceled', 'succeeded'].includes(remote.status)) {
      return {
        order: await getOrderById(order.id),
        confirmationUrl: order.confirmation_url,
        paymentId: order.provider_payment_id,
      };
    }
  }

  const publicSite = (process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  let siteReturn =
    returnUrl ||
    process.env.YOOKASSA_RETURN_URL ||
    (publicSite ? `${publicSite}/owner/payment/result/${order.id}` : '');
  if (!siteReturn) {
    const err = new Error('Не задан PUBLIC_SITE_URL / YOOKASSA_RETURN_URL');
    err.status = 500;
    throw err;
  }
  siteReturn = siteReturn
    .replace(':orderId', order.id)
    .replace('{orderId}', order.id);
  if (!siteReturn.includes(order.id)) {
    siteReturn = `${siteReturn.replace(/\/$/, '')}/owner/payment/result/${order.id}`;
  }

  const idempotenceKey = yookassa.newIdempotenceKey();

  const userRes = await pool.query(
    `select u.email, p.phone
     from public.users u
     left join public.profiles p on p.user_id = u.id
     where u.id = $1`,
    [userId]
  );
  const buyer = userRes.rows[0] || {};
  if (!buyer.email && !buyer.phone) {
    const err = new Error('Укажите email в профиле — он нужен для чека оплаты');
    err.status = 400;
    throw err;
  }

  const { payment } = await yookassa.createPayment({
    amount: order.amount,
    currency: order.currency,
    description: order.description,
    returnUrl: siteReturn,
    metadata: {
      order_id: order.id,
      base_id: baseId,
      user_id: userId,
    },
    customerEmail: buyer.email,
    customerPhone: buyer.phone,
    idempotenceKey,
  });

  const confirmationUrl = payment.confirmation?.confirmation_url || null;

  await pool.query('begin');
  try {
    await pool.query(
      `update public.listing_orders set
         status = 'waiting_for_payment',
         provider_payment_id = $2,
         confirmation_url = $3,
         idempotence_key = $4,
         meta = coalesce(meta, '{}'::jsonb) || $5::jsonb,
         updated_at = now()
       where id = $1`,
      [
        order.id,
        payment.id,
        confirmationUrl,
        idempotenceKey,
        JSON.stringify({ yookassa_status: payment.status }),
      ]
    );

    const payExists = await pool.query(
      `select id from public.payments where provider = 'yookassa' and provider_payment_id = $1`,
      [payment.id]
    );
    if (!payExists.rows[0]) {
      await pool.query(
        `insert into public.payments
          (user_id, provider, provider_payment_id, amount, currency, status, listing_order_id, confirmation_url, meta)
         values ($1, 'yookassa', $2, $3, $4, 'pending', $5, $6, $7::jsonb)`,
        [
          userId,
          payment.id,
          order.amount,
          order.currency,
          order.id,
          confirmationUrl,
          JSON.stringify({ order_id: order.id, base_id: baseId }),
        ]
      );
    }
    await pool.query('commit');
  } catch (err) {
    await pool.query('rollback');
    throw err;
  }

  console.log('[listing] checkout', order.id, payment.id, order.amount);
  return {
    order: await getOrderById(order.id),
    confirmationUrl,
    paymentId: payment.id,
  };
}

async function applyPaidSideEffects(client, order) {
  await client.query(
    `update public.bases set
       status = 'pending',
       submitted_at = coalesce(submitted_at, now()),
       rejection_reason = null,
       updated_at = now()
     where id = $1 and status in ('draft', 'rejected', 'pending')`,
    [order.base_id]
  );

  await client.query(
    `insert into public.notifications (user_id, type, title, body, link_path, payload)
     values ($1, 'payment', 'Оплата получена', $2, $3, $4::jsonb)`,
    [
      order.user_id,
      `Оплата размещения «заказ ${order.id.slice(0, 8)}» прошла успешно. База отправлена на модерацию.`,
      `/owner/bases/${order.base_id}/edit`,
      JSON.stringify({ order_id: order.id, base_id: order.base_id }),
    ]
  );
}

export async function markOrderPaid(orderId, { providerPaymentId = null, skipYoo = false } = {}) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      'select * from public.listing_orders where id = $1 for update',
      [orderId]
    );
    const order = rows[0];
    if (!order) {
      const err = new Error('Заказ не найден');
      err.status = 404;
      throw err;
    }
    if (order.status === 'paid') {
      await client.query('commit');
      return { order: mapOrder(order), alreadyPaid: true };
    }

    await client.query(
      `update public.listing_orders set
         status = 'paid',
         paid_at = now(),
         provider_payment_id = coalesce($2, provider_payment_id),
         updated_at = now()
       where id = $1`,
      [orderId, providerPaymentId]
    );

    if (providerPaymentId) {
      await client.query(
        `update public.payments set
           status = 'succeeded',
           paid_at = now(),
           updated_at = now()
         where provider = 'yookassa' and provider_payment_id = $1`,
        [providerPaymentId]
      );
    } else if (skipYoo) {
      await client.query(
        `insert into public.payments
          (user_id, provider, amount, currency, status, listing_order_id, paid_at, meta)
         values ($1, 'manual', $2, $3, 'succeeded', $4, now(), '{"zero_price":true}'::jsonb)`,
        [order.user_id, order.amount, order.currency, order.id]
      );
    }

    await applyPaidSideEffects(client, order);
    await client.query('commit');
    console.log('[listing] paid', orderId, skipYoo ? 'zero' : providerPaymentId);
    return { order: await getOrderById(orderId), alreadyPaid: false };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

function amountsMatch(a, b) {
  return Math.abs(Number(a) - Number(b)) < 0.001;
}

export async function finalizePaidFromYooKassa(order, payment) {
  if (!payment || payment.status !== 'succeeded' || !payment.paid) {
    return { order, paid: false, payment };
  }
  const metaOrderId = payment.metadata?.order_id;
  if (metaOrderId && metaOrderId !== order.id) {
    console.error('[listing] metadata order_id mismatch', metaOrderId, order.id);
    const err = new Error('Несоответствие заказа и платежа');
    err.status = 400;
    throw err;
  }
  const paidAmount = payment.amount?.value;
  if (paidAmount != null && !amountsMatch(paidAmount, order.amount)) {
    console.error('[listing] amount mismatch', paidAmount, order.amount);
    const err = new Error('Сумма платежа не совпадает с заказом');
    err.status = 400;
    throw err;
  }
  if (payment.amount?.currency && payment.amount.currency !== order.currency) {
    const err = new Error('Валюта платежа не совпадает');
    err.status = 400;
    throw err;
  }
  const result = await markOrderPaid(order.id, { providerPaymentId: payment.id });
  return { ...result, paid: true, payment };
}

/**
 * Verify payment status with YooKassa (used by return URL page).
 */
export async function verifyOrderPayment(orderId, { userId, isAdmin = false } = {}) {
  const order = await getOrderById(orderId);
  if (!order) {
    const err = new Error('Заказ не найден');
    err.status = 404;
    throw err;
  }
  if (!isAdmin && order.user_id !== userId) {
    const err = new Error('Нет доступа');
    err.status = 403;
    throw err;
  }

  // Expire stale
  if (
    ['pending', 'waiting_for_payment'].includes(order.status) &&
    order.expires_at &&
    new Date(order.expires_at) < new Date()
  ) {
    await pool.query(
      `update public.listing_orders set status = 'expired', updated_at = now() where id = $1 and status in ('pending','waiting_for_payment')`,
      [orderId]
    );
    return { order: await getOrderById(orderId), paid: false };
  }

  if (order.status === 'paid') {
    return { order, paid: true };
  }

  if (!order.provider_payment_id) {
    return { order, paid: false };
  }

  const payment = await yookassa.getPayment(order.provider_payment_id);
  if (payment.status === 'succeeded' && payment.paid) {
    return finalizePaidFromYooKassa(order, payment);
  }

  if (payment.status === 'canceled') {
    await pool.query(
      `update public.listing_orders set status = 'cancelled', updated_at = now(),
         meta = coalesce(meta,'{}'::jsonb) || $2::jsonb
       where id = $1 and status != 'paid'`,
      [orderId, JSON.stringify({ yookassa_status: 'canceled' })]
    );
    await pool.query(
      `update public.payments set status = 'canceled', updated_at = now()
       where provider = 'yookassa' and provider_payment_id = $1`,
      [order.provider_payment_id]
    );
  }

  return { order: await getOrderById(orderId), paid: false, payment };
}

export async function handleYooKassaWebhook(event) {
  const object = event?.object;
  if (!object?.id) {
    return { ok: true, ignored: true };
  }

  const eventType = event.event || '';
  console.log('[yookassa webhook]', eventType, object.id, object.status);

  const { rows } = await pool.query(
    `select * from public.listing_orders where provider_payment_id = $1`,
    [object.id]
  );
  let order = mapOrder(rows[0]);

  if (!order && object.metadata?.order_id) {
    order = await getOrderById(object.metadata.order_id);
  }

  if (!order) {
    console.warn('[yookassa webhook] order not found for payment', object.id);
    return { ok: true, ignored: true };
  }

  if (order.status === 'paid') {
    return { ok: true, alreadyPaid: true, orderId: order.id };
  }

  // Always re-fetch from API — do not trust webhook body alone for money
  let payment = object;
  try {
    payment = await yookassa.getPayment(object.id);
  } catch (err) {
    console.error('[yookassa webhook] getPayment failed', err.message);
  }

  if (payment.status === 'succeeded' && payment.paid) {
    await finalizePaidFromYooKassa(order, payment);
    return { ok: true, paid: true, orderId: order.id };
  }

  if (payment.status === 'canceled') {
    await pool.query(
      `update public.listing_orders set status = 'cancelled', updated_at = now()
       where id = $1 and status != 'paid'`,
      [order.id]
    );
  }

  return { ok: true, paid: false, orderId: order.id, status: payment.status };
}

export async function listOrdersForUser(userId, filters = {}) {
  const params = [userId];
  let sql = `
    select o.*, b.name as base_name
    from public.listing_orders o
    left join public.bases b on b.id = o.base_id
    where o.user_id = $1
  `;
  if (filters.status) {
    params.push(filters.status);
    sql += ` and o.status = $${params.length}`;
  }
  if (filters.baseId) {
    params.push(filters.baseId);
    sql += ` and o.base_id = $${params.length}`;
  }
  sql += ' order by o.created_at desc limit 200';
  const { rows } = await pool.query(sql, params);
  return rows.map(mapOrder);
}

export async function listOrdersAdmin(filters = {}) {
  const params = [];
  let sql = `
    select o.*,
           b.name as base_name,
           u.email as user_email,
           p.display_name as user_name
    from public.listing_orders o
    left join public.bases b on b.id = o.base_id
    left join public.users u on u.id = o.user_id
    left join public.profiles p on p.user_id = o.user_id
    where 1=1
  `;
  if (filters.status) {
    params.push(filters.status);
    sql += ` and o.status = $${params.length}`;
  }
  if (filters.baseId) {
    params.push(filters.baseId);
    sql += ` and o.base_id = $${params.length}`;
  }
  if (filters.userId) {
    params.push(filters.userId);
    sql += ` and o.user_id = $${params.length}`;
  }
  if (filters.from) {
    params.push(filters.from);
    sql += ` and o.created_at >= $${params.length}`;
  }
  if (filters.to) {
    params.push(filters.to);
    sql += ` and o.created_at <= $${params.length}`;
  }
  sql += ' order by o.created_at desc limit 500';
  const { rows } = await pool.query(sql, params);
  return rows.map(mapOrder);
}
