import { pool } from '../db.js';
import * as yookassa from './yookassa.js';

const DEFAULT_SIDEBAR_PRICE = 300;
const DEFAULT_UNIT = 'day';
const SLOTS_PER_SIDE = 2;
const SURFACES = new Set(['news', 'forum']);

async function ensureAdsColumns() {
  await pool.query(`
    alter table public.advertising
      add column if not exists placement text,
      add column if not exists budget numeric(12, 2) default 0,
      add column if not exists currency text default 'RUB',
      add column if not exists moderation_note text,
      add column if not exists moderated_by uuid,
      add column if not exists moderated_at timestamptz,
      add column if not exists paid_at timestamptz,
      add column if not exists months int default 1,
      add column if not exists days int default 1,
      add column if not exists views_count int default 0,
      add column if not exists clicks_count int default 0,
      add column if not exists surface text default 'news'
  `);
  try {
    await pool.query(`
      alter table public.advertising alter column status drop default;
      alter table public.advertising alter column status type text using status::text;
      alter table public.advertising alter column status set default 'draft';
      alter table public.advertising drop constraint if exists advertising_status_check;
      alter table public.advertising
        add constraint advertising_status_check
        check (status in ('draft', 'pending', 'active', 'paused', 'expired', 'rejected'));
      alter table public.advertising alter column ad_type type text using ad_type::text;
      alter table public.advertising drop constraint if exists advertising_ad_type_check;
      alter table public.advertising
        add constraint advertising_ad_type_check
        check (ad_type in ('banner', 'directory', 'sponsored_base', 'sidebar'));
      alter table public.advertising drop constraint if exists advertising_placement_check;
      alter table public.advertising
        add constraint advertising_placement_check
        check (placement is null or placement in ('left', 'right'));
      alter table public.advertising drop constraint if exists advertising_surface_check;
      alter table public.advertising
        add constraint advertising_surface_check
        check (surface is null or surface in ('news', 'forum'));
      update public.advertising set surface = 'news' where surface is null or surface = '';
    `);
  } catch (err) {
    console.warn('[ads] schema ensure soft-fail', err.message);
  }
}

function parsePriceValue(raw) {
  let value = raw ?? {};
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = {};
    }
  }
  return value && typeof value === 'object' ? value : {};
}

function normalizeSurface(raw) {
  const s = String(raw || 'news').toLowerCase();
  return SURFACES.has(s) ? s : 'news';
}

function normalizePlacement(raw) {
  return raw === 'left' ? 'left' : 'right';
}

/** Any whole number of days the user wants (1…365). */
function normalizeDays(raw) {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(365, n);
}

export async function getSidebarAdPrice() {
  const { rows } = await pool.query(
    `select value from public.site_settings where key = 'sidebar_ad_price' limit 1`
  );
  const value = parsePriceValue(rows[0]?.value);
  const hasUnit = value.unit === 'day' || value.unit === 'month';
  const amount = Number(value.amount);
  const unit = value.unit === 'month' ? 'month' : DEFAULT_UNIT;
  return {
    title: value.title || 'Боковой баннер',
    amount: hasUnit && Number.isFinite(amount) ? amount : DEFAULT_SIDEBAR_PRICE,
    currency: 'RUB',
    unit,
    days: Math.max(1, Number(value.days) || 1),
    slotsPerSide: SLOTS_PER_SIDE,
    slotsPerSurface: SLOTS_PER_SIDE * 2,
    recommendedSize: { width: 200, height: 300, label: '200×300' },
    enabled: value.enabled !== false,
  };
}

export async function saveSidebarAdPrice(adminId, input = {}) {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    const err = new Error('Некорректная цена');
    err.status = 400;
    throw err;
  }
  const value = {
    title: String(input.title || 'Боковой баннер').trim() || 'Боковой баннер',
    amount,
    unit: input.unit === 'month' ? 'month' : 'day',
    days: Math.max(1, Number(input.days) || 1),
    currency: 'RUB',
    enabled: input.enabled !== false,
  };
  await pool.query(
    `insert into public.site_settings (key, value, updated_by, updated_at)
     values ('sidebar_ad_price', $1::jsonb, $2, now())
     on conflict (key) do update set
       value = excluded.value,
       updated_by = excluded.updated_by,
       updated_at = now()`,
    [JSON.stringify(value), adminId]
  );
  return getSidebarAdPrice();
}

function mapAd(row) {
  if (!row) return null;
  return {
    ...row,
    budget: Number(row.budget) || 0,
    months: Number(row.months) || 1,
    days: Number(row.days) || Number(row.months) || 1,
    views_count: Number(row.views_count) || 0,
    clicks_count: Number(row.clicks_count) || 0,
    surface: normalizeSurface(row.surface),
    placement: normalizePlacement(row.placement),
  };
}

/** Term ended by ends_at or status=expired */
export function isAdTermEnded(ad) {
  if (!ad) return false;
  if (ad.status === 'expired') return true;
  if (!ad.ends_at) return false;
  const t = new Date(ad.ends_at).getTime();
  return Number.isFinite(t) && t <= Date.now();
}

/** Draft / rejected / expired (or active past ends_at) can go to checkout */
export function canPayOrRenewAd(ad) {
  if (!ad) return false;
  if (['draft', 'rejected', 'expired'].includes(ad.status)) return true;
  if (['active', 'paused'].includes(ad.status) && isAdTermEnded(ad)) return true;
  return false;
}

/** Flip active ads past ends_at → expired */
export async function expireDueAds({ ownerId = null } = {}) {
  await ensureAdsColumns();
  const params = [];
  let sql = `
    update public.advertising
       set status = 'expired', updated_at = now()
     where ad_type = 'sidebar'
       and status in ('active', 'paused')
       and ends_at is not null
       and ends_at <= now()
  `;
  if (ownerId) {
    params.push(ownerId);
    sql += ` and owner_id = $${params.length}`;
  }
  await pool.query(sql, params);
}

function validateBannerFields({ title, targetUrl, imageUrl }) {
  const name = String(title || '').trim();
  const url = String(targetUrl || '').trim();
  const image = String(imageUrl || '').trim();
  if (!name) {
    const err = new Error('Укажите название');
    err.status = 400;
    throw err;
  }
  if (!url || !/^https?:\/\//i.test(url)) {
    const err = new Error('Укажите ссылку вида https://…');
    err.status = 400;
    throw err;
  }
  if (!image) {
    const err = new Error('Загрузите изображение баннера');
    err.status = 400;
    throw err;
  }
  return { name, url, image };
}

async function countActiveSlots(surface, placement, excludeId = null) {
  const params = [normalizeSurface(surface), normalizePlacement(placement)];
  let sql = `
    select count(*)::int as c
    from public.advertising
    where ad_type = 'sidebar'
      and status = 'active'
      and coalesce(surface, 'news') = $1
      and placement = $2
      and (starts_at is null or starts_at <= now())
      and (ends_at is null or ends_at > now())
  `;
  if (excludeId) {
    params.push(excludeId);
    sql += ` and id <> $${params.length}`;
  }
  const { rows } = await pool.query(sql, params);
  return Number(rows[0]?.c) || 0;
}

export async function getSlotAvailability() {
  await ensureAdsColumns();
  const price = await getSidebarAdPrice();
  const result = {};
  for (const surface of ['news', 'forum']) {
    result[surface] = {};
    for (const placement of ['left', 'right']) {
      const used = await countActiveSlots(surface, placement);
      result[surface][placement] = {
        used,
        total: SLOTS_PER_SIDE,
        free: Math.max(0, SLOTS_PER_SIDE - used),
      };
    }
  }
  return { slots: result, price, slotsPerSide: SLOTS_PER_SIDE };
}

export async function listActiveSidebarAds(surface = 'news') {
  await ensureAdsColumns();
  await expireDueAds();
  const surf = normalizeSurface(surface);
  const { rows } = await pool.query(
    `select id, title, image_url, target_url, placement, surface, ad_type, status, starts_at, ends_at
     from public.advertising
     where ad_type = 'sidebar'
       and status = 'active'
       and coalesce(surface, 'news') = $1
       and (starts_at is null or starts_at <= now())
       and (ends_at is null or ends_at > now())
     order by sort_order asc, updated_at desc`,
    [surf]
  );
  return rows.map(mapAd);
}

export async function listMine(userId) {
  await ensureAdsColumns();
  await expireDueAds({ ownerId: userId });
  const { rows } = await pool.query(
    `select * from public.advertising
     where owner_id = $1 and ad_type = 'sidebar'
     order by created_at desc`,
    [userId]
  );
  return rows.map(mapAd);
}

export async function listForModeration(status = 'pending') {
  await ensureAdsColumns();
  const params = [];
  let sql = `select a.*, u.email as owner_email
    from public.advertising a
    left join public.users u on u.id = a.owner_id
    where a.ad_type = 'sidebar'`;
  if (status && status !== 'all') {
    params.push(status);
    sql += ` and a.status = $${params.length}`;
  }
  sql += ` order by a.created_at desc`;
  const { rows } = await pool.query(sql, params);
  return rows.map(mapAd);
}

export async function getById(id) {
  await ensureAdsColumns();
  const { rows } = await pool.query(`select * from public.advertising where id = $1`, [id]);
  return mapAd(rows[0]);
}

export async function createSidebarAd({
  userId,
  title,
  targetUrl,
  imageUrl,
  placement = 'right',
  surface = 'news',
  days = 1,
}) {
  await ensureAdsColumns();
  const price = await getSidebarAdPrice();
  if (!price.enabled) {
    const err = new Error('Приём рекламы временно отключён');
    err.status = 403;
    throw err;
  }
  const place = normalizePlacement(placement);
  const surf = normalizeSurface(surface);
  const d = normalizeDays(days);
  const { name, url, image } = validateBannerFields({ title, targetUrl, imageUrl });
  const budget = Math.round(price.amount * d);

  const { rows } = await pool.query(
    `insert into public.advertising
      (owner_id, ad_type, status, title, image_url, target_url, placement, surface, budget, currency, days, months)
     values ($1, 'sidebar', 'draft', $2, $3, $4, $5, $6, $7, 'RUB', $8, $8)
     returning *`,
    [userId, name, image, url, place, surf, budget, d]
  );
  return mapAd(rows[0]);
}

export async function updateSidebarAd(userId, adId, patch = {}) {
  await ensureAdsColumns();
  const ad = await getById(adId);
  if (!ad || ad.owner_id !== userId || ad.ad_type !== 'sidebar') {
    const err = new Error('Заявка не найдена');
    err.status = 404;
    throw err;
  }

  const title = patch.title != null ? patch.title : ad.title;
  const targetUrl = patch.target_url ?? patch.targetUrl ?? ad.target_url;
  const imageUrl = patch.image_url ?? patch.imageUrl ?? ad.image_url;
  const { name, url, image } = validateBannerFields({ title, targetUrl, imageUrl });
  const place =
    patch.placement != null ? normalizePlacement(patch.placement) : normalizePlacement(ad.placement);
  const surf = patch.surface != null ? normalizeSurface(patch.surface) : normalizeSurface(ad.surface);

  let days = ad.days || 1;
  let budget = ad.budget;
  const termEnded = isAdTermEnded(ad);
  if (patch.days != null && (!ad.paid_at || termEnded)) {
    days = normalizeDays(patch.days);
    const price = await getSidebarAdPrice();
    budget = Math.round(price.amount * days);
  }

  const needsModeration =
    Boolean(ad.paid_at) ||
    ['pending', 'active', 'paused', 'rejected', 'expired'].includes(ad.status);
  const nextStatus = needsModeration ? 'pending' : 'draft';

  const { rows } = await pool.query(
    `update public.advertising set
       title = $2,
       target_url = $3,
       image_url = $4,
       placement = $5,
       surface = $6,
       days = $7,
       months = $7,
       budget = $8,
       status = $9,
       moderation_note = case when $9 = 'pending' then null else moderation_note end,
       moderated_by = case when $9 = 'pending' then null else moderated_by end,
       moderated_at = case when $9 = 'pending' then null else moderated_at end,
       updated_at = now()
     where id = $1
     returning *`,
    [adId, name, url, image, place, surf, days, budget, nextStatus]
  );
  const updated = mapAd(rows[0]);

  if (updated?.owner_id && nextStatus === 'pending') {
    await pool.query(
      `insert into public.notifications (user_id, type, title, body, link_path, payload)
       values ($1, 'moderation', 'Баннер на модерации', $2, '/cabinet/advertising', $3::jsonb)`,
      [
        updated.owner_id,
        `«${updated.title}» отправлен на проверку после изменений.`,
        JSON.stringify({ ad_id: updated.id, status: 'pending' }),
      ]
    );
    try {
      const { notifyAdminModeration, notifyUserAdModeration } = await import('./notifyMail.js');
      const where = updated.surface === 'forum' ? 'форум' : 'новости';
      const side = updated.placement === 'left' ? 'слева' : 'справа';
      notifyAdminModeration({
        kindLabel: 'Рекламный баннер на модерации',
        title: updated.title,
        detail: `${where}, ${side}, ${updated.days || 1} сут. · после правок`,
        adminPath: '/admin/ads',
      });
      notifyUserAdModeration({
        userId: updated.owner_id,
        title: updated.title,
        days: updated.days,
        surface: updated.surface,
      });
    } catch (err) {
      console.error('[ads] notify mail (update)', err.message);
    }
  }

  return updated;
}

export async function deleteSidebarAd(userId, adId) {
  await ensureAdsColumns();
  const ad = await getById(adId);
  if (!ad || ad.owner_id !== userId || ad.ad_type !== 'sidebar') {
    const err = new Error('Заявка не найдена');
    err.status = 404;
    throw err;
  }
  await pool.query(`delete from public.advertising where id = $1`, [adId]);
  return { ok: true, id: adId };
}

export async function recordImpression(adId) {
  await ensureAdsColumns();
  const { rows } = await pool.query(
    `update public.advertising set
       views_count = coalesce(views_count, 0) + 1,
       updated_at = updated_at
     where id = $1
       and ad_type = 'sidebar'
       and status = 'active'
       and (starts_at is null or starts_at <= now())
       and (ends_at is null or ends_at > now())
     returning id, views_count, clicks_count`,
    [adId]
  );
  return rows[0] || null;
}

export async function recordClick(adId) {
  await ensureAdsColumns();
  const { rows } = await pool.query(
    `update public.advertising set
       clicks_count = coalesce(clicks_count, 0) + 1,
       updated_at = updated_at
     where id = $1
       and ad_type = 'sidebar'
       and status = 'active'
     returning id, views_count, clicks_count, target_url`,
    [adId]
  );
  return rows[0] || null;
}

export async function createAdCheckout({ userId, adId, returnUrl }) {
  await ensureAdsColumns();
  await expireDueAds({ ownerId: userId });
  const ad = await getById(adId);
  if (!ad || ad.owner_id !== userId) {
    const err = new Error('Заявка не найдена');
    err.status = 404;
    throw err;
  }
  if (!canPayOrRenewAd(ad)) {
    const err = new Error(
      'Оплата доступна для черновика, отклонённой заявки или баннера с истёкшим сроком'
    );
    err.status = 400;
    throw err;
  }

  // Refresh price × days for renewals
  let amount = Number(ad.budget) || 0;
  if (isAdTermEnded(ad) || ad.status === 'expired') {
    const price = await getSidebarAdPrice();
    const days = Math.max(1, Number(ad.days) || 1);
    amount = Math.round(Number(price.amount) * days);
    await pool.query(
      `update public.advertising set budget = $2, updated_at = now() where id = $1`,
      [ad.id, amount]
    );
  }

  if (amount <= 0) {
    return markAdPaid(ad.id, { skipYoo: true });
  }

  if (!yookassa.isYooKassaConfigured()) {
    return markAdPaid(ad.id, { skipYoo: true });
  }

  const publicSite = (process.env.PUBLIC_SITE_URL || '').replace(/\/$/, '');
  let siteReturn =
    returnUrl ||
    (publicSite ? `${publicSite}/cabinet/advertising?paid=${ad.id}` : '');
  if (!siteReturn) {
    const err = new Error('Не задан PUBLIC_SITE_URL');
    err.status = 500;
    throw err;
  }

  const idempotenceKey = yookassa.newIdempotenceKey();
  const userRes = await pool.query(
    `select u.email, p.phone from public.users u
     left join public.profiles p on p.user_id = u.id where u.id = $1`,
    [userId]
  );
  const buyer = userRes.rows[0] || {};
  const days = Math.max(1, Number(ad.days) || 1);
  const whereRu = ad.surface === 'forum' ? 'форум' : 'новости';
  const renew = isAdTermEnded(ad) || ad.status === 'expired';

  const { payment } = await yookassa.createPayment({
    amount,
    currency: 'RUB',
    description: `${renew ? 'Продление' : 'Реклама'} ${whereRu} ${days} сут.: ${ad.title}`.slice(
      0,
      128
    ),
    returnUrl: siteReturn,
    metadata: {
      ad_id: ad.id,
      user_id: userId,
      kind: renew ? 'sidebar_ad_renew' : 'sidebar_ad',
    },
    customerEmail: buyer.email,
    customerPhone: buyer.phone,
    idempotenceKey,
  });

  const confirmationUrl = payment.confirmation?.confirmation_url || null;

  try {
    await pool.query(
      `insert into public.payments
        (user_id, provider, provider_payment_id, amount, currency, status, confirmation_url, meta)
       values ($1, 'yookassa', $2, $3, 'RUB', 'pending', $4, $5::jsonb)
       on conflict do nothing`,
      [
        userId,
        payment.id,
        amount,
        confirmationUrl,
        JSON.stringify({
          ad_id: ad.id,
          kind: renew ? 'sidebar_ad_renew' : 'sidebar_ad',
        }),
      ]
    );
  } catch {
    /* payments schema may differ */
  }

  return {
    ad: await getById(ad.id),
    confirmationUrl,
    paymentId: payment.id,
  };
}

export async function markAdPaid(adId, { skipYoo = false } = {}) {
  const daysRow = await pool.query(
    `select coalesce(nullif(days, 0), nullif(months, 0), 1) as days from public.advertising where id = $1`,
    [adId]
  );
  const days = Math.max(1, Number(daysRow.rows[0]?.days) || 1);
  const { rows } = await pool.query(
    `update public.advertising set
       status = 'pending',
       paid_at = now(),
       starts_at = coalesce(starts_at, now()),
       ends_at = now() + make_interval(days => $2::int),
       updated_at = now()
     where id = $1
     returning *`,
    [adId, days]
  );
  const ad = mapAd(rows[0]);
  if (ad?.owner_id) {
    await pool.query(
      `insert into public.notifications (user_id, type, title, body, link_path, payload)
       values ($1, 'payment', 'Реклама оплачена', $2, '/cabinet/advertising', $3::jsonb)`,
      [
        ad.owner_id,
        `«${ad.title}» отправлена на модерацию (${days} сут.).`,
        JSON.stringify({ ad_id: ad.id, skipYoo }),
      ]
    );
    try {
      const { notifyAdminModeration, notifyUserPlacement } = await import('./notifyMail.js');
      const where = ad.surface === 'forum' ? 'форум' : 'новости';
      const side = ad.placement === 'left' ? 'слева' : 'справа';
      notifyAdminModeration({
        kindLabel: 'Рекламный баннер на модерации',
        title: ad.title,
        detail: `${where}, ${side}, ${days} сут. · оплачен`,
        adminPath: '/admin/ads',
      });
      notifyUserPlacement({
        userId: ad.owner_id,
        entityTitle: ad.title,
        entityKind: 'ad',
        pending: true,
        cabinetPath: '/cabinet/advertising',
      });
    } catch (err) {
      console.error('[ads] notify mail (paid)', err.message);
    }
  }
  return { ad, confirmationUrl: null };
}

export async function verifyAdPayment(adId, { userId, paymentId } = {}) {
  const ad = await getById(adId);
  if (!ad) {
    const err = new Error('Реклама не найдена');
    err.status = 404;
    throw err;
  }
  if (userId && ad.owner_id !== userId) {
    const err = new Error('Нет доступа');
    err.status = 403;
    throw err;
  }

  const ended = isAdTermEnded(ad);
  // Already in flight / live — skip, unless term ended (renew)
  if (!ended && (ad.paid_at || ['pending', 'active', 'paused'].includes(ad.status))) {
    return ad;
  }

  // Without YooKassa do not mark paid on return URL alone (checkout handles offline pay)
  if (!yookassa.isYooKassaConfigured()) {
    return ad;
  }

  let pid = paymentId;
  if (!pid) {
    try {
      const { rows } = await pool.query(
        `select provider_payment_id from public.payments
         where meta->>'ad_id' = $1
         order by created_at desc nulls last
         limit 1`,
        [adId]
      );
      pid = rows[0]?.provider_payment_id;
    } catch {
      /* payments table may differ */
    }
  }

  if (!pid) return ad;

  const remote = await yookassa.getPayment(pid).catch(() => null);
  if (remote?.status === 'succeeded' && remote.paid) {
    if (canPayOrRenewAd(ad) || ['draft', 'rejected', 'expired'].includes(ad.status) || ended) {
      await markAdPaid(adId);
    }
  }
  return getById(adId);
}

export async function moderateAd(adminId, adId, { action, note = '' }) {
  await ensureAdsColumns();
  const ad = await getById(adId);
  if (!ad) {
    const err = new Error('Не найдено');
    err.status = 404;
    throw err;
  }

  let status = ad.status;
  if (action === 'approve' || action === 'activate') status = 'active';
  else if (action === 'reject') status = 'rejected';
  else if (action === 'pause') status = 'paused';
  else if (action === 'pending') status = 'pending';
  else {
    const err = new Error('Неизвестное действие');
    err.status = 400;
    throw err;
  }

  if (status === 'active') {
    const used = await countActiveSlots(ad.surface, ad.placement, ad.id);
    if (used >= SLOTS_PER_SIDE) {
      const err = new Error(
        `Нет свободных слотов: ${ad.surface === 'forum' ? 'форум' : 'новости'} / ${
          ad.placement === 'left' ? 'слева' : 'справа'
        } (макс. ${SLOTS_PER_SIDE})`
      );
      err.status = 409;
      throw err;
    }
  }

  const { rows } = await pool.query(
    `update public.advertising set
       status = $2,
       moderation_note = $3,
       moderated_by = $4,
       moderated_at = now(),
       updated_at = now()
     where id = $1
     returning *`,
    [adId, status, note || null, adminId]
  );
  const updated = mapAd(rows[0]);
  if (updated?.owner_id) {
    const title =
      status === 'active'
        ? 'Реклама опубликована'
        : status === 'rejected'
          ? 'Реклама отклонена'
          : `Реклама: ${status}`;
    await pool.query(
      `insert into public.notifications (user_id, type, title, body, link_path, payload)
       values ($1, 'moderation', $2, $3, '/cabinet/advertising', $4::jsonb)`,
      [
        updated.owner_id,
        title,
        note || updated.title,
        JSON.stringify({ ad_id: updated.id, status }),
      ]
    );
    if (status === 'active' || status === 'rejected') {
      try {
        const { notifyUserPublication } = await import('./notifyMail.js');
        notifyUserPublication({
          userId: updated.owner_id,
          entityTitle: updated.title,
          entityKind: 'ad',
          approved: status === 'active',
          note: note || '',
          path: '/cabinet/advertising',
        });
      } catch (err) {
        console.error('[ads] notify mail (moderate)', err.message);
      }
    }
  }
  return updated;
}
