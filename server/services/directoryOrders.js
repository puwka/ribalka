import { pool } from '../db.js';
import * as yookassa from './yookassa.js';
import { getDirectoryListingPrices } from './listingOrders.js';

const ORDER_TTL_HOURS = 24;
const PAGE_KEY = 'page:directory';
const CATEGORIES = new Set(['shop', 'service', 'guide']);

function mapOrder(row) {
  if (!row) return null;
  return {
    ...row,
    amount: Number(row.amount),
    months: Number(row.months),
    addon_frame: Boolean(row.addon_frame),
    addon_top: Boolean(row.addon_top),
    kind: 'directory',
  };
}

function calcAmount(tariff, { months, frame, top }) {
  const m = Number(months) || 3;
  const monthly =
    Number(tariff.amountPerMonth || 0) +
    (top ? Number(tariff.addonTop || 0) : 0) +
    (frame ? Number(tariff.addonFrame || 0) : 0);
  return Math.max(0, Math.round(monthly * m));
}

function categoryLabel(category) {
  return { shop: 'Магазин', service: 'Сервис', guide: 'Гид / егерь' }[category] || category;
}

async function getCmsPage() {
  const { rows } = await pool.query('select value from public.cms_kv where key = $1', [PAGE_KEY]);
  let value = rows[0]?.value ?? {};
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = {};
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) value = {};
  if (!Array.isArray(value.items)) value.items = [];
  return value;
}

async function saveCmsPage(page, adminId = null) {
  await pool.query(
    `insert into public.cms_kv (key, value, updated_by, updated_at)
     values ($1, $2::jsonb, $3, now())
     on conflict (key) do update set
       value = excluded.value,
       updated_by = excluded.updated_by,
       updated_at = now()`,
    [PAGE_KEY, JSON.stringify(page), adminId]
  );
}

export async function getOrderById(orderId) {
  const { rows } = await pool.query(
    'select * from public.directory_listing_orders where id = $1',
    [orderId]
  );
  return mapOrder(rows[0]);
}

export async function listOrdersForUser(userId) {
  const { rows } = await pool.query(
    `select * from public.directory_listing_orders
     where user_id = $1
     order by created_at desc
     limit 100`,
    [userId]
  );
  return rows.map(mapOrder);
}

export async function listOrdersAdmin({ status } = {}) {
  const params = [];
  let sql = `select o.*, u.email as user_email, coalesce(p.display_name, u.email) as user_name
    from public.directory_listing_orders o
    left join public.users u on u.id = o.user_id
    left join public.profiles p on p.user_id = o.user_id`;
  if (status) {
    params.push(status);
    sql += ` where o.status = $1`;
  }
  sql += ` order by o.created_at desc limit 300`;
  const { rows } = await pool.query(sql, params);
  return rows.map(mapOrder);
}

/**
 * Create directory placement order + YooKassa payment.
 * Amount is always computed from admin tariff (never trusted from client).
 */
export async function createDirectoryCheckout({
  userId,
  category,
  months = 3,
  frame = false,
  top = false,
  listing = {},
  returnUrl,
}) {
  if (!CATEGORIES.has(category)) {
    const err = new Error('Укажите категорию: магазин, сервис или гид/егерь');
    err.status = 400;
    throw err;
  }
  const m = Number(months);
  if (![3, 6, 12].includes(m)) {
    const err = new Error('Срок оплаты: 3, 6 или 12 месяцев');
    err.status = 400;
    throw err;
  }

  const name = String(listing.name || '').trim();
  const phone = String(listing.phone || '').trim();
  const description = String(listing.description || '').trim();
  if (!name) {
    const err = new Error('Укажите название');
    err.status = 400;
    throw err;
  }
  if (!phone) {
    const err = new Error('Укажите телефон');
    err.status = 400;
    throw err;
  }
  if (!description) {
    const err = new Error('Добавьте краткое описание');
    err.status = 400;
    throw err;
  }

  const prices = await getDirectoryListingPrices();
  const tariff = prices.service;
  if (!tariff?.enabled) {
    const err = new Error('Размещение в справочнике временно отключено');
    err.status = 403;
    throw err;
  }

  const wantTop = Boolean(top);
  const wantFrame = Boolean(frame);
  const amount = calcAmount(tariff, { months: m, frame: wantFrame, top: wantTop });
  const payload = {
    name,
    category,
    description,
    address: String(listing.address || '').trim(),
    phone,
    website: String(listing.website || '').trim(),
    hours: String(listing.hours || '').trim(),
    image: String(listing.image || '').trim(),
    tags: Array.isArray(listing.tags)
      ? listing.tags
      : String(listing.tags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
    yellowFrame: wantFrame,
    isTop: wantTop,
    months: m,
  };

  const expiresAt = new Date(Date.now() + ORDER_TTL_HOURS * 3600 * 1000).toISOString();
  const orderDescription = `${tariff.title}: ${categoryLabel(category)} «${name}» (${m} мес.)`.slice(
    0,
    128
  );

  const { rows } = await pool.query(
    `insert into public.directory_listing_orders
      (user_id, category, amount, currency, status, description, expires_at,
       payment_provider, months, addon_frame, addon_top, payload)
     values ($1,$2,$3,'RUB','pending',$4,$5,'yookassa',$6,$7,$8,$9::jsonb)
     returning *`,
    [
      userId,
      category,
      amount,
      orderDescription,
      expiresAt,
      m,
      wantFrame,
      wantTop,
      JSON.stringify(payload),
    ]
  );
  let order = mapOrder(rows[0]);

  if (Number(order.amount) === 0) {
    return markDirectoryOrderPaid(order.id, { skipYoo: true });
  }

  if (!yookassa.isYooKassaConfigured()) {
    const err = new Error('Платёжная система не настроена на сервере');
    err.status = 503;
    throw err;
  }

  const publicSite = (process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  let siteReturn =
    returnUrl ||
    (publicSite ? `${publicSite}/directory/payment/result/${order.id}` : '');
  if (!siteReturn) {
    const err = new Error('Не задан PUBLIC_SITE_URL');
    err.status = 500;
    throw err;
  }
  siteReturn = siteReturn.replace(':orderId', order.id).replace('{orderId}', order.id);
  if (!siteReturn.includes(order.id)) {
    siteReturn = `${siteReturn.replace(/\/$/, '')}/directory/payment/result/${order.id}`;
  }

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

  const idempotenceKey = yookassa.newIdempotenceKey();
  const { payment } = await yookassa.createPayment({
    amount: order.amount,
    currency: order.currency,
    description: order.description,
    returnUrl: siteReturn,
    metadata: {
      order_id: order.id,
      order_kind: 'directory',
      category,
      user_id: userId,
    },
    customerEmail: buyer.email,
    customerPhone: buyer.phone,
    idempotenceKey,
  });

  const confirmationUrl = payment.confirmation?.confirmation_url || null;
  await pool.query(
    `update public.directory_listing_orders set
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

  await pool.query(
    `insert into public.payments
      (user_id, provider, provider_payment_id, amount, currency, status, confirmation_url, meta)
     values ($1, 'yookassa', $2, $3, $4, 'pending', $5, $6::jsonb)
     on conflict do nothing`,
    [
      userId,
      payment.id,
      order.amount,
      order.currency,
      confirmationUrl,
      JSON.stringify({ order_id: order.id, order_kind: 'directory' }),
    ]
  ).catch(async () => {
    /* payments.provider_payment unique may not exist — ignore */
    await pool.query(
      `insert into public.payments
        (user_id, provider, provider_payment_id, amount, currency, status, confirmation_url, meta)
       select $1, 'yookassa', $2, $3, $4, 'pending', $5, $6::jsonb
       where not exists (
         select 1 from public.payments where provider = 'yookassa' and provider_payment_id = $2
       )`,
      [
        userId,
        payment.id,
        order.amount,
        order.currency,
        confirmationUrl,
        JSON.stringify({ order_id: order.id, order_kind: 'directory' }),
      ]
    );
  });

  order = await getOrderById(order.id);
  console.log('[directory-listing] checkout', order.id, payment.id, order.amount);
  return { order, confirmationUrl, paymentId: payment.id };
}

async function publishDirectoryItem(client, order) {
  const payload = order.payload && typeof order.payload === 'object' ? order.payload : {};
  const itemId = order.directory_item_id || `dir-${order.id.slice(0, 8)}`;
  const paidUntil = new Date();
  paidUntil.setMonth(paidUntil.getMonth() + Number(order.months || 3));

  const pageRes = await client.query('select value from public.cms_kv where key = $1 for update', [
    PAGE_KEY,
  ]);
  let page = pageRes.rows[0]?.value ?? {};
  if (typeof page === 'string') {
    try {
      page = JSON.parse(page);
    } catch {
      page = {};
    }
  }
  if (!page || typeof page !== 'object' || Array.isArray(page)) page = {};
  const items = Array.isArray(page.items) ? [...page.items] : [];

  const row = {
    id: itemId,
    name: payload.name,
    category: order.category,
    description: payload.description || '',
    address: payload.address || '',
    phone: payload.phone || '',
    website: payload.website || '',
    hours: payload.hours || '',
    image: payload.image || '',
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    status: 'pending',
    yellowFrame: Boolean(order.addon_frame || payload.yellowFrame),
    isTop: Boolean(order.addon_top || payload.isTop),
    ownerUserId: order.user_id,
    orderId: order.id,
    paidUntil: paidUntil.toISOString(),
    createdAt: new Date().toISOString(),
  };

  const idx = items.findIndex((i) => String(i.id) === String(itemId));
  if (idx >= 0) items[idx] = { ...items[idx], ...row };
  else items.unshift(row);

  const next = {
    title: page.title || 'Справочник рыболова',
    description: page.description || '',
    ...page,
    items,
  };

  await client.query(
    `insert into public.cms_kv (key, value, updated_at)
     values ($1, $2::jsonb, now())
     on conflict (key) do update set value = excluded.value, updated_at = now()`,
    [PAGE_KEY, JSON.stringify(next)]
  );

  await client.query(
    `update public.directory_listing_orders set directory_item_id = $2, updated_at = now() where id = $1`,
    [order.id, itemId]
  );

  await client.query(
    `insert into public.notifications (user_id, type, title, body, link_path, payload)
     values ($1, 'payment', 'Заявка в справочник оплачена', $2, $3, $4::jsonb)`,
    [
      order.user_id,
      `«${payload.name}» отправлена на модерацию. После проверки появится в справочнике.`,
      '/directory',
      JSON.stringify({ order_id: order.id, directory_item_id: itemId }),
    ]
  );

  return itemId;
}

export async function markDirectoryOrderPaid(orderId, { providerPaymentId = null, skipYoo = false } = {}) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const { rows } = await client.query(
      'select * from public.directory_listing_orders where id = $1 for update',
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
      `update public.directory_listing_orders set
         status = 'paid',
         paid_at = now(),
         provider_payment_id = coalesce($2, provider_payment_id),
         updated_at = now()
       where id = $1`,
      [orderId, providerPaymentId]
    );

    if (providerPaymentId) {
      await client.query(
        `update public.payments set status = 'succeeded', paid_at = now(), updated_at = now()
         where provider = 'yookassa' and provider_payment_id = $1`,
        [providerPaymentId]
      );
    } else if (skipYoo) {
      await client.query(
        `insert into public.payments
          (user_id, provider, amount, currency, status, paid_at, meta)
         values ($1, 'manual', $2, $3, 'succeeded', now(), $4::jsonb)`,
        [
          order.user_id,
          order.amount,
          order.currency,
          JSON.stringify({ order_id: order.id, order_kind: 'directory', zero_price: true }),
        ]
      );
    }

    await publishDirectoryItem(client, order);
    await client.query('commit');
    console.log('[directory-listing] paid', orderId);
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

export async function finalizeDirectoryPaidFromYooKassa(order, payment) {
  if (!payment || payment.status !== 'succeeded' || !payment.paid) {
    return { order, paid: false, payment };
  }
  const metaOrderId = payment.metadata?.order_id;
  if (metaOrderId && metaOrderId !== order.id) {
    const err = new Error('Несоответствие заказа и платежа');
    err.status = 400;
    throw err;
  }
  const paidAmount = payment.amount?.value;
  if (paidAmount != null && !amountsMatch(paidAmount, order.amount)) {
    const err = new Error('Сумма платежа не совпадает с заказом');
    err.status = 400;
    throw err;
  }
  const result = await markDirectoryOrderPaid(order.id, { providerPaymentId: payment.id });
  return { ...result, paid: true, payment };
}

export async function verifyDirectoryOrderPayment(orderId, { userId, isAdmin = false } = {}) {
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

  if (
    ['pending', 'waiting_for_payment'].includes(order.status) &&
    order.expires_at &&
    new Date(order.expires_at) < new Date()
  ) {
    await pool.query(
      `update public.directory_listing_orders set status = 'expired', updated_at = now()
       where id = $1 and status in ('pending','waiting_for_payment')`,
      [orderId]
    );
    return { order: await getOrderById(orderId), paid: false };
  }

  if (order.status === 'paid') return { order, paid: true };
  if (!order.provider_payment_id) return { order, paid: false };

  const payment = await yookassa.getPayment(order.provider_payment_id);
  if (payment.status === 'succeeded' && payment.paid) {
    return finalizeDirectoryPaidFromYooKassa(order, payment);
  }
  if (payment.status === 'canceled') {
    await pool.query(
      `update public.directory_listing_orders set status = 'cancelled', updated_at = now()
       where id = $1 and status in ('pending','waiting_for_payment')`,
      [orderId]
    );
    return { order: await getOrderById(orderId), paid: false };
  }
  return { order, paid: false, payment };
}

export async function findOrderByProviderPaymentId(paymentId) {
  const { rows } = await pool.query(
    `select * from public.directory_listing_orders where provider_payment_id = $1`,
    [paymentId]
  );
  return mapOrder(rows[0]);
}
