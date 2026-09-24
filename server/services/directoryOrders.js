import { pool } from '../db.js';
import * as yookassa from './yookassa.js';
import { getDirectoryListingPrices, remainingMonthsCeil } from './listingOrders.js';

const ORDER_TTL_HOURS = 24;
const PAGE_KEY = 'page:directory';
const CATEGORIES = new Set(['shop', 'service', 'guide']);
/** Max simultaneous TOP slots per directory category */
export const DIRECTORY_TOP_SLOTS = 4;

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

function calcAmount(tariff, { months, frame, topDays = 0 }) {
  const m = Number(months) || 3;
  const monthly =
    Number(tariff.amountPerMonth || 0) + (frame ? Number(tariff.addonFrame || 0) : 0);
  const full = monthly * m;
  const discountPct =
    m === 3
      ? Number(tariff.discount3) || 0
      : m === 6
        ? Number(tariff.discount6) || 0
        : Number(tariff.discount12) || 0;
  const discountAmount = Math.round((full * discountPct) / 100);
  const days = Math.max(0, Math.min(90, Number(topDays) || 0));
  const daily = Number(tariff.addonTopDaily ?? tariff.addonTop) || 300;
  const topAmount = Math.round(days * daily);
  return Math.max(0, Math.round(full - discountAmount) + topAmount);
}

function categoryLabel(category) {
  return { shop: 'Магазин', service: 'Сервис', guide: 'Гид / егерь' }[category] || category;
}

/** Active TOP: isTop + topUntil in future, or legacy isTop without topUntil while paid. */
export function itemHasActiveTop(item) {
  if (!item || !(item.isTop || item.top)) return false;
  if (item.topUntil) return new Date(item.topUntil).getTime() > Date.now();
  if (item.paidUntil) return new Date(item.paidUntil).getTime() > Date.now();
  return true;
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
async function ensureOwnerRole(userId) {
  await pool.query(
    `insert into public.user_roles (user_id, role_id)
     select $1, r.id from public.roles r where r.code = 'owner'
     on conflict do nothing`,
    [userId]
  );
  await pool.query(
    `update public.users
     set primary_role = case when primary_role = 'user' then 'owner' else primary_role end
     where id = $1`,
    [userId]
  );
}

export async function createDirectoryCheckout({
  userId,
  category,
  months = 3,
  frame = false,
  top = false,
  topDays = 0,
  listing = {},
  directoryItemId = null,
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

  await ensureOwnerRole(userId);

  let existingItem = null;
  const itemId = directoryItemId ? String(directoryItemId).trim() : '';
  if (itemId) {
    const page = await getCmsPage();
    existingItem = page.items.find((i) => String(i.id) === itemId) || null;
    if (!existingItem || String(existingItem.ownerUserId) !== String(userId)) {
      const err = new Error('Карточка не найдена или нет доступа');
      err.status = 404;
      throw err;
    }
  }

  const name = String(listing.name || existingItem?.name || '').trim();
  const phone = String(listing.phone || existingItem?.phone || '').trim();
  const description = String(listing.description || existingItem?.description || '').trim();
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

  const wantFrame = Boolean(frame);
  let days = Math.max(0, Math.min(90, Number(topDays) || (top ? 1 : 0)));
  if (days > 0) {
    const slots = await getDirectoryTopAvailability({
      category,
      itemId: itemId || null,
    });
    if (!slots.dailyAvailable && !slots.alreadyTop) {
      const err = new Error(
        'К сожалению, все места в топе заняты, попробуйте позже.'
      );
      err.status = 409;
      throw err;
    }
  }

  const amount = calcAmount(tariff, { months: m, frame: wantFrame, topDays: days });
  const payload = {
    name,
    category,
    description,
    address: String(listing.address || existingItem?.address || '').trim(),
    region: String(listing.region || existingItem?.region || '').trim(),
    phone,
    website: String(listing.website || existingItem?.website || '').trim(),
    hours: String(listing.hours || existingItem?.hours || '').trim(),
    image: String(listing.image || existingItem?.image || '').trim(),
    tags: Array.isArray(listing.tags)
      ? listing.tags
      : String(listing.tags || '')
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
    yellowFrame: wantFrame,
    isTop: days > 0,
    topDays: days,
    months: m,
    renew: Boolean(existingItem),
  };

  const expiresAt = new Date(Date.now() + ORDER_TTL_HOURS * 3600 * 1000).toISOString();
  const orderDescription = (
    days > 0
      ? `${tariff.title}: ${categoryLabel(category)} «${name}» (${m} мес. + ТОП ${days} сут.)`
      : `${tariff.title}: ${categoryLabel(category)} «${name}» (${m} мес.)`
  ).slice(0, 128);

  const { rows } = await pool.query(
    `insert into public.directory_listing_orders
      (user_id, category, amount, currency, status, description, expires_at,
       payment_provider, months, addon_frame, addon_top, payload, directory_item_id, meta)
     values ($1,$2,$3,'RUB','pending',$4,$5,'yookassa',$6,$7,$8,$9::jsonb,$10,$11::jsonb)
     returning *`,
    [
      userId,
      category,
      amount,
      orderDescription,
      expiresAt,
      m,
      wantFrame,
      days > 0,
      JSON.stringify(payload),
      itemId || null,
      JSON.stringify({ top_days: days }),
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
    (publicSite ? `${publicSite}/owner/directory/payment/result/${order.id}` : '');
  if (!siteReturn) {
    const err = new Error('Не задан PUBLIC_SITE_URL');
    err.status = 500;
    throw err;
  }
  siteReturn = siteReturn.replace(':orderId', order.id).replace('{orderId}', order.id);
  if (!siteReturn.includes(order.id)) {
    siteReturn = `${siteReturn.replace(/\/$/, '')}/owner/directory/payment/result/${order.id}`;
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

/**
 * Mid-period TOP/frame upgrade for an already paid directory card.
 * Does not extend paidUntil.
 */
export async function createDirectoryUpgradeCheckout({
  userId,
  directoryItemId,
  top = false,
  topDays = 0,
  frame = false,
  returnUrl,
}) {
  const itemId = String(directoryItemId || '').trim();
  if (!itemId) {
    const err = new Error('Укажите карточку справочника');
    err.status = 400;
    throw err;
  }

  await ensureOwnerRole(userId);
  const page = await getCmsPage();
  const existingItem = page.items.find((i) => String(i.id) === itemId) || null;
  if (!existingItem || String(existingItem.ownerUserId) !== String(userId)) {
    const err = new Error('Карточка не найдена или нет доступа');
    err.status = 404;
    throw err;
  }

  const rem = remainingMonthsCeil(existingItem.paidUntil);
  if (!rem) {
    const err = new Error('Нет активного оплаченного периода — оформите продление');
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

  const hasFrame = Boolean(existingItem.yellowFrame || existingItem.highlight);
  const addFrame = Boolean(frame) && !hasFrame;
  let days = Math.max(0, Math.min(90, Number(topDays) || (top ? 1 : 0)));
  if (days > 0) {
    const slots = await getDirectoryTopAvailability({
      category: existingItem.category,
      itemId,
    });
    if (!slots.dailyAvailable && !slots.alreadyTop) {
      const err = new Error(
        'К сожалению, все места в топе заняты, попробуйте позже.'
      );
      err.status = 409;
      throw err;
    }
  }
  const daily = Number(tariff.addonTopDaily ?? tariff.addonTop) || 300;
  const amount = Math.max(
    0,
    Math.round((addFrame ? Number(tariff.addonFrame) || 0 : 0) * rem) +
      Math.round(days * daily)
  );

  if (amount <= 0) {
    const err = new Error('Нет новых опций для доплаты');
    err.status = 400;
    throw err;
  }

  const category = existingItem.category;
  const payload = {
    kind: 'upgrade',
    name: existingItem.name,
    category,
    description: existingItem.description || '',
    address: existingItem.address || '',
    region: existingItem.region || '',
    phone: existingItem.phone || '',
    website: existingItem.website || '',
    hours: existingItem.hours || '',
    image: existingItem.image || '',
    tags: existingItem.tags || [],
    yellowFrame: hasFrame || addFrame,
    isTop: days > 0 || Boolean(existingItem.isTop || existingItem.top),
    topDays: days,
    remainingMonths: rem,
    renew: true,
  };

  const expiresAt = new Date(Date.now() + ORDER_TTL_HOURS * 3600 * 1000).toISOString();
  const orderDescription = (
    days > 0
      ? `Доплата опций: ${categoryLabel(category)} «${existingItem.name}» (+ТОП ${days} сут.)`
      : `Доплата опций: ${categoryLabel(category)} «${existingItem.name}»`
  ).slice(0, 128);

  const { rows } = await pool.query(
    `insert into public.directory_listing_orders
      (user_id, category, amount, currency, status, description, expires_at,
       payment_provider, months, addon_frame, addon_top, payload, directory_item_id, meta)
     values ($1,$2,$3,'RUB','pending',$4,$5,'yookassa',$6,$7,$8,$9::jsonb,$10,$11::jsonb)
     returning *`,
    [
      userId,
      category,
      amount,
      orderDescription,
      expiresAt,
      3,
      hasFrame || addFrame,
      days > 0,
      JSON.stringify(payload),
      itemId,
      JSON.stringify({ kind: 'upgrade', remainingMonths: rem, top_days: days }),
    ]
  );
  let order = mapOrder(rows[0]);

  if (!yookassa.isYooKassaConfigured()) {
    const err = new Error('Платёжная система не настроена на сервере');
    err.status = 503;
    throw err;
  }

  const publicSite = (process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  let siteReturn =
    returnUrl ||
    (publicSite ? `${publicSite}/owner/directory/payment/result/${order.id}` : '');
  if (!siteReturn) {
    const err = new Error('Не задан PUBLIC_SITE_URL');
    err.status = 500;
    throw err;
  }
  siteReturn = siteReturn.replace(':orderId', order.id).replace('{orderId}', order.id);
  if (!siteReturn.includes(order.id)) {
    siteReturn = `${siteReturn.replace(/\/$/, '')}/owner/directory/payment/result/${order.id}`;
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
      order_kind: 'directory_upgrade',
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
      JSON.stringify({ yookassa_status: payment.status, kind: 'upgrade' }),
    ]
  );

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
      JSON.stringify({ order_id: order.id, order_kind: 'directory_upgrade' }),
    ]
  );

  order = await getOrderById(order.id);
  console.log('[directory-listing] upgrade checkout', order.id, payment.id, order.amount);
  return { order, confirmationUrl, paymentId: payment.id };
}

async function publishDirectoryItem(client, order) {
  const payload = order.payload && typeof order.payload === 'object' ? order.payload : {};
  let meta = order.meta;
  if (typeof meta === 'string') {
    try {
      meta = JSON.parse(meta);
    } catch {
      meta = {};
    }
  }
  const isUpgrade = payload.kind === 'upgrade' || meta?.kind === 'upgrade';
  const isTopDaily = payload.kind === 'top_daily' || meta?.kind === 'top_daily';
  const itemId = order.directory_item_id || `dir-${order.id.slice(0, 8)}`;
  const months = Math.max(1, Number(order.months || 3));

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
  const idx = items.findIndex((i) => String(i.id) === String(itemId));
  const existing = idx >= 0 ? items[idx] : null;

  if (isTopDaily) {
    if (!existing) {
      const err = new Error('Карточка справочника не найдена');
      err.status = 404;
      throw err;
    }
    const hours = Math.max(1, Number(meta?.top_daily?.hours || payload.hours) || 24);
    const already = itemHasActiveTop(existing);
    if (!already) {
      const used = items.filter(
        (i) =>
          String(i.id) !== String(itemId) &&
          String(i.category) === String(existing.category) &&
          itemHasActiveTop(i)
      ).length;
      if (used >= DIRECTORY_TOP_SLOTS) {
        // Displace earliest daily TOP in this category
        const dailies = items
          .map((i, index) => ({ i, index }))
          .filter(
            ({ i }) =>
              String(i.id) !== String(itemId) &&
              String(i.category) === String(existing.category) &&
              itemHasActiveTop(i) &&
              (i.topKind === 'daily' || (i.topUntil && !i.topKind))
          )
          .sort(
            (a, b) =>
              new Date(a.i.topUntil || 0).getTime() - new Date(b.i.topUntil || 0).getTime()
          );
        if (dailies[0]) {
          const d = dailies[0].i;
          items[dailies[0].index] = {
            ...d,
            isTop: false,
            top: false,
            topUntil: null,
            topKind: null,
            updatedAt: new Date().toISOString(),
          };
        }
      }
    }
    const baseUntil = already && existing.topUntil ? new Date(existing.topUntil) : new Date();
    if (baseUntil.getTime() < Date.now()) baseUntil.setTime(Date.now());
    baseUntil.setHours(baseUntil.getHours() + hours);
    const row = {
      ...existing,
      isTop: true,
      top: true,
      topKind: 'daily',
      topUntil: baseUntil.toISOString(),
      updatedAt: new Date().toISOString(),
      orderId: order.id,
    };
    items[idx] = row;
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
      `insert into public.notifications (user_id, type, title, body, link_path, payload)
       values ($1, 'payment', 'ТОП на сутки оплачен', $2, $3, $4::jsonb)`,
      [
        order.user_id,
        `«${row.name}» поднята в ТОП справочника на ${hours} ч.`,
        `/owner/directory/${itemId}/edit`,
        JSON.stringify({ order_id: order.id, directory_item_id: itemId, kind: 'top_daily' }),
      ]
    );
    return itemId;
  }

  const now = new Date();
  let paidUntil = existing?.paidUntil || null;
  if (!isUpgrade) {
    const baseDate =
      existing?.paidUntil && new Date(existing.paidUntil).getTime() > now.getTime()
        ? new Date(existing.paidUntil)
        : now;
    baseDate.setMonth(baseDate.getMonth() + months);
    paidUntil = baseDate.toISOString();
  }

  // Продление опубликованной карточки — остаётся published; новое/черновик — на модерацию
  const wasPublished =
    existing &&
    (existing.status === 'published' || existing.status === 'approved');
  const nextStatus = isUpgrade
    ? existing?.status || 'published'
    : wasPublished
      ? existing.status
      : 'pending';

  const keepTop = itemHasActiveTop(existing);
  const topDaysPaid = Math.max(
    0,
    Math.min(90, Number(payload.topDays ?? meta?.top_days) || 0)
  );
  let nextIsTop = keepTop;
  let nextTopUntil = keepTop ? existing?.topUntil || null : null;
  let nextTopKind = keepTop ? existing?.topKind || null : null;

  if (topDaysPaid > 0) {
    const already = keepTop;
    if (!already) {
      const used = items.filter(
        (i) =>
          String(i.id) !== String(itemId) &&
          String(i.category) === String(order.category || existing?.category || payload.category) &&
          itemHasActiveTop(i)
      ).length;
      if (used >= DIRECTORY_TOP_SLOTS) {
        const dailies = items
          .map((i, index) => ({ i, index }))
          .filter(
            ({ i }) =>
              String(i.id) !== String(itemId) &&
              String(i.category) ===
                String(order.category || existing?.category || payload.category) &&
              itemHasActiveTop(i) &&
              (i.topKind === 'daily' || (i.topUntil && !i.topKind))
          )
          .sort(
            (a, b) =>
              new Date(a.i.topUntil || 0).getTime() - new Date(b.i.topUntil || 0).getTime()
          );
        if (dailies[0]) {
          const d = dailies[0].i;
          items[dailies[0].index] = {
            ...d,
            isTop: false,
            top: false,
            topUntil: null,
            topKind: null,
            updatedAt: new Date().toISOString(),
          };
        }
      }
    }
    const baseUntil =
      already && existing?.topUntil ? new Date(existing.topUntil) : new Date();
    if (baseUntil.getTime() < Date.now()) baseUntil.setTime(Date.now());
    baseUntil.setHours(baseUntil.getHours() + topDaysPaid * 24);
    nextIsTop = true;
    nextTopUntil = baseUntil.toISOString();
    nextTopKind = 'daily';
  }

  const row = {
    ...(existing || {}),
    id: itemId,
    name: payload.name || existing?.name,
    category: order.category || existing?.category,
    description: payload.description ?? existing?.description ?? '',
    address: payload.address ?? existing?.address ?? '',
    region: payload.region ?? existing?.region ?? '',
    phone: payload.phone || existing?.phone || '',
    website: payload.website ?? existing?.website ?? '',
    hours: payload.hours ?? existing?.hours ?? '',
    image: payload.image ?? existing?.image ?? '',
    tags: Array.isArray(payload.tags) ? payload.tags : existing?.tags || [],
    status: nextStatus,
    yellowFrame: Boolean(
      order.addon_frame || payload.yellowFrame || existing?.yellowFrame
    ),
    isTop: nextIsTop,
    top: nextIsTop,
    topUntil: nextTopUntil,
    topKind: nextTopKind,
    ownerUserId: order.user_id,
    orderId: order.id,
    paidUntil: paidUntil || existing?.paidUntil || null,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (idx >= 0) items[idx] = row;
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

  const notifyBody = isUpgrade
    ? `Доплата опций для «${row.name}» прошла успешно.`
    : wasPublished
      ? `Оплата продления «${row.name}» прошла. Размещение до ${new Date(paidUntil).toLocaleDateString('ru-RU')}.`
      : `«${row.name}» отправлена на модерацию. После проверки появится в справочнике.`;

  await client.query(
    `insert into public.notifications (user_id, type, title, body, link_path, payload)
     values ($1, 'payment', $2, $3, $4, $5::jsonb)`,
    [
      order.user_id,
      isUpgrade
        ? 'Доплата справочника получена'
        : wasPublished
          ? 'Продление справочника оплачено'
          : 'Заявка в справочник оплачена',
      notifyBody,
      '/owner/directory',
      JSON.stringify({ order_id: order.id, directory_item_id: itemId, kind: isUpgrade ? 'upgrade' : 'renew' }),
    ]
  );

  try {
    const { notifyAdminModeration, notifyUserPlacement } = await import('./notifyMail.js');
    if (nextStatus === 'pending') {
      notifyAdminModeration({
        kindLabel: 'Новый магазин / услуга / гид',
        title: row.name || 'Карточка справочника',
        detail: `Категория: ${row.category || order.category || '—'}`,
        adminPath: '/admin/content/directory',
      });
    }
    if (!isUpgrade) {
      notifyUserPlacement({
        userId: order.user_id,
        entityTitle: row.name || 'Карточка',
        entityKind: 'directory',
        pending: nextStatus === 'pending',
        paidUntilLabel: paidUntil
          ? new Date(paidUntil).toLocaleDateString('ru-RU')
          : null,
        cabinetPath: '/owner/directory',
      });
    }
  } catch (err) {
    console.error('[directoryOrders] notify mail', err.message);
  }

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

export async function getDirectoryTopAvailability({ category, itemId = null } = {}) {
  const page = await getCmsPage();
  const cat = String(category || '').trim();
  const peers = page.items.filter((i) => {
    if (cat && String(i.category) !== cat) return false;
    if ((i.status || 'published') !== 'published' && (i.status || '') !== 'approved') {
      return false;
    }
    return itemHasActiveTop(i);
  });
  const alreadyTop = itemId
    ? peers.some((i) => String(i.id) === String(itemId))
    : false;
  const othersUsed = peers.filter((i) => !itemId || String(i.id) !== String(itemId)).length;
  const usedSlots = alreadyTop ? othersUsed + 1 : othersUsed;
  const dailyAvailable = alreadyTop || othersUsed < DIRECTORY_TOP_SLOTS;
  return {
    max: DIRECTORY_TOP_SLOTS,
    used: usedSlots,
    free: Math.max(0, DIRECTORY_TOP_SLOTS - usedSlots),
    available: dailyAvailable,
    dailyAvailable,
    alreadyTop,
    category: cat || null,
  };
}

/**
 * One-day TOP boost for shop / service / guide cards (24h).
 */
export async function createDirectoryTopDailyCheckout({
  userId,
  directoryItemId,
  returnUrl,
}) {
  const itemId = directoryItemId;
  if (!itemId) {
    const err = new Error('directoryItemId required');
    err.status = 400;
    throw err;
  }

  const page = await getCmsPage();
  const existingItem = page.items.find((i) => String(i.id) === String(itemId));
  if (!existingItem || String(existingItem.ownerUserId) !== String(userId)) {
    const err = new Error('Карточка не найдена или нет доступа');
    err.status = 404;
    throw err;
  }

  const status = existingItem.status || 'draft';
  if (status !== 'published' && status !== 'approved') {
    const err = new Error('Суточный ТОП доступен только для опубликованных карточек');
    err.status = 400;
    throw err;
  }
  if (existingItem.paidUntil && new Date(existingItem.paidUntil).getTime() <= Date.now()) {
    const err = new Error('Сначала продлите размещение карточки');
    err.status = 400;
    throw err;
  }

  const slots = await getDirectoryTopAvailability({
    category: existingItem.category,
    itemId,
  });
  if (!slots.dailyAvailable) {
    const err = new Error(
      `Все ${DIRECTORY_TOP_SLOTS} места в ТОП этой категории заняты. Попробуйте позже.`
    );
    err.status = 409;
    throw err;
  }

  const prices = await getDirectoryListingPrices();
  const tariff = prices.service;
  if (!tariff?.enabled) {
    const err = new Error('Размещение в справочнике временно отключено');
    err.status = 403;
    throw err;
  }

  const amount = Math.max(
    0,
    Number(tariff.addonTopDaily ?? tariff.addonTop) || 300
  );
  const hours = 24;
  const description = `ТОП на сутки: ${categoryLabel(existingItem.category)} «${existingItem.name}»`.slice(
    0,
    128
  );
  const metaPatch = {
    kind: 'top_daily',
    top_daily: { hours, amount },
  };
  const payload = {
    kind: 'top_daily',
    hours,
    name: existingItem.name,
    category: existingItem.category,
    isTop: true,
  };

  const { rows: existing } = await pool.query(
    `select * from public.directory_listing_orders
     where directory_item_id = $1 and user_id = $2
       and status in ('pending', 'waiting_for_payment')
       and (expires_at is null or expires_at > now())
       and coalesce(meta->>'kind', '') = 'top_daily'
     order by created_at desc
     limit 1`,
    [itemId, userId]
  );
  let order = mapOrder(existing[0]);
  const amountChanged = Boolean(order) && Number(order.amount) !== Number(amount);

  if (order && !order.provider_payment_id && amountChanged) {
    const { rows: updated } = await pool.query(
      `update public.directory_listing_orders
       set amount = $2, description = $3,
           meta = coalesce(meta, '{}'::jsonb) || $4::jsonb,
           payload = $5::jsonb,
           updated_at = now()
       where id = $1
       returning *`,
      [order.id, amount, description, JSON.stringify(metaPatch), JSON.stringify(payload)]
    );
    order = mapOrder(updated[0]);
  }

  if (order && order.provider_payment_id && amountChanged) {
    await pool.query(
      `update public.directory_listing_orders
       set status = 'cancelled', updated_at = now(),
           meta = coalesce(meta, '{}'::jsonb) || '{"reason":"top_daily_price_changed"}'::jsonb
       where id = $1 and status in ('pending', 'waiting_for_payment')`,
      [order.id]
    );
    order = null;
  }

  if (!order) {
    const expiresAt = new Date(Date.now() + ORDER_TTL_HOURS * 3600 * 1000).toISOString();
    const { rows } = await pool.query(
      `insert into public.directory_listing_orders
        (user_id, category, amount, currency, status, description, expires_at,
         payment_provider, months, addon_frame, addon_top, payload, directory_item_id, meta)
       values ($1,$2,$3,'RUB','pending',$4,$5,'yookassa',3,false,true,$6::jsonb,$7,$8::jsonb)
       returning *`,
      [
        userId,
        existingItem.category,
        amount,
        description,
        expiresAt,
        JSON.stringify(payload),
        itemId,
        JSON.stringify(metaPatch),
      ]
    );
    order = mapOrder(rows[0]);
  }

  if (Number(order.amount) === 0) {
    return markDirectoryOrderPaid(order.id, { skipYoo: true });
  }

  if (!yookassa.isYooKassaConfigured()) {
    const err = new Error('Платёжная система не настроена на сервере');
    err.status = 503;
    throw err;
  }

  if (order.provider_payment_id && order.confirmation_url && order.status === 'waiting_for_payment') {
    const remote = await yookassa.getPayment(order.provider_payment_id).catch(() => null);
    if (remote?.status === 'succeeded' && remote.paid) {
      return finalizeDirectoryPaidFromYooKassa(order, remote);
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
    (publicSite ? `${publicSite}/owner/directory/payment/result/${order.id}` : '');
  if (!siteReturn) {
    const err = new Error('Не задан PUBLIC_SITE_URL');
    err.status = 500;
    throw err;
  }
  siteReturn = siteReturn.replace(':orderId', order.id).replace('{orderId}', order.id);
  if (!siteReturn.includes(order.id)) {
    siteReturn = `${siteReturn.replace(/\/$/, '')}/owner/directory/payment/result/${order.id}`;
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

  const idempotenceKey = `dir-top-daily-${order.id}`;
  const payment = await yookassa.createPayment({
    amount: order.amount,
    currency: order.currency || 'RUB',
    description: order.description,
    returnUrl: siteReturn,
    metadata: {
      order_id: order.id,
      order_kind: 'directory_top_daily',
      directory_item_id: itemId,
      user_id: userId,
    },
    customer: {
      email: buyer.email || undefined,
      phone: buyer.phone || undefined,
    },
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
      JSON.stringify({ yookassa_status: payment.status, kind: 'top_daily' }),
    ]
  );

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
      JSON.stringify({ order_id: order.id, order_kind: 'directory_top_daily' }),
    ]
  );

  order = await getOrderById(order.id);
  console.log('[directory-listing] top_daily checkout', order.id, payment.id, order.amount);
  return { order, confirmationUrl, paymentId: payment.id };
}
