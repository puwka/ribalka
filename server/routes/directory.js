import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const PAGE_KEY = 'page:directory';
const CATEGORIES = new Set(['shop', 'service', 'guide']);

async function ensureEventsTable() {
  await pool.query(`
    create table if not exists public.directory_listing_events (
      id uuid primary key default gen_random_uuid(),
      item_id text not null,
      owner_id uuid references public.users (id) on delete set null,
      event_type text not null check (event_type in ('view', 'phone', 'website')),
      session_key text,
      created_at timestamptz not null default now()
    )
  `);
}

async function loadDirectoryPage(client = pool) {
  const { rows } = await client.query(`select value from public.cms_kv where key = $1`, [PAGE_KEY]);
  let page = rows[0]?.value ?? {};
  if (typeof page === 'string') {
    try {
      page = JSON.parse(page);
    } catch {
      page = {};
    }
  }
  if (!page || typeof page !== 'object' || Array.isArray(page)) page = {};
  if (!Array.isArray(page.items)) page.items = [];
  return page;
}

async function saveDirectoryPage(page, client = pool, userId = null) {
  await client.query(
    `insert into public.cms_kv (key, value, updated_by, updated_at)
     values ($1, $2::jsonb, $3, now())
     on conflict (key) do update set
       value = excluded.value,
       updated_by = coalesce(excluded.updated_by, public.cms_kv.updated_by),
       updated_at = now()`,
    [PAGE_KEY, JSON.stringify(page), userId]
  );
}

function isActiveListing(item) {
  if ((item.status || 'published') !== 'published') return false;
  if (!item.paidUntil) return true;
  return new Date(item.paidUntil).getTime() > Date.now();
}

function mapMineItem(item) {
  const paidUntil = item.paidUntil || null;
  const expired =
    Boolean(paidUntil) && new Date(paidUntil).getTime() <= Date.now();
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    description: item.description || '',
    address: item.address || '',
    phone: item.phone || '',
    website: item.website || '',
    hours: item.hours || '',
    image: item.image || '',
    tags: Array.isArray(item.tags) ? item.tags : [],
    status: item.status || 'draft',
    yellowFrame: Boolean(item.yellowFrame),
    isTop: Boolean(item.isTop || item.top),
    paidUntil,
    expired,
    active: isActiveListing(item),
    ownerUserId: item.ownerUserId || null,
    createdAt: item.createdAt || null,
    updatedAt: item.updatedAt || null,
  };
}

function newItemId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `dir-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

function parseListingBody(body = {}) {
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').trim();
  const description = String(body.description || '').trim();
  const category = String(body.category || 'shop').trim();
  if (!CATEGORIES.has(category)) {
    const err = new Error('Категория: shop, service или guide');
    err.status = 400;
    throw err;
  }
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
    const err = new Error('Добавьте описание');
    err.status = 400;
    throw err;
  }
  const tags = Array.isArray(body.tags)
    ? body.tags
    : String(body.tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
  return {
    name,
    category,
    description,
    address: String(body.address || '').trim(),
    phone,
    website: String(body.website || '').trim(),
    hours: String(body.hours || '').trim(),
    image: String(body.image || '').trim(),
    tags,
  };
}

/** Auth user → owner role (for directory / bases cabinet) */
router.post('/enable-owner', requireAuth, async (req, res, next) => {
  try {
    await ensureOwnerRole(req.user.sub);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Public: track card interaction */
router.post('/events', async (req, res, next) => {
  try {
    await ensureEventsTable();
    const itemId = String(req.body?.itemId || req.body?.item_id || '').trim();
    const eventType = String(req.body?.eventType || req.body?.type || '').trim();
    if (!itemId) return res.status(400).json({ error: 'itemId required' });
    if (!['view', 'phone', 'website'].includes(eventType)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    const page = await loadDirectoryPage();
    const item = page.items.find((i) => String(i.id) === itemId);
    if (!item || !isActiveListing(item)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const ownerId = item.ownerUserId || item.owner_id || null;
    const sessionKey =
      String(req.body?.sessionKey || req.body?.session_id || '').slice(0, 120) || null;

    await pool.query(
      `insert into public.directory_listing_events (item_id, owner_id, event_type, session_key)
       values ($1, $2, $3, $4)`,
      [itemId, ownerId, eventType, sessionKey]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Owner: list my directory listings (including expired) */
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const page = await loadDirectoryPage();
    const mine = page.items
      .filter((i) => i.ownerUserId && String(i.ownerUserId) === String(req.user.sub))
      .map(mapMineItem)
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));
    res.json(mine);
  } catch (err) {
    next(err);
  }
});

/** Owner: analytics for my directory cards */
router.get('/mine/analytics', requireAuth, async (req, res, next) => {
  try {
    await ensureEventsTable();
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
    const from = new Date(Date.now() - days * 86400000);

    const page = await loadDirectoryPage();
    const mine = page.items.filter(
      (i) => i.ownerUserId && String(i.ownerUserId) === String(req.user.sub)
    );
    const itemIds = mine.map((i) => String(i.id));
    if (!itemIds.length) {
      return res.json({ days, items: [], totals: { views: 0, phone: 0, website: 0 } });
    }

    const { rows } = await pool.query(
      `select item_id, event_type, count(*)::int as cnt
       from public.directory_listing_events
       where owner_id = $1
         and item_id = any($2::text[])
         and created_at >= $3
       group by item_id, event_type`,
      [req.user.sub, itemIds, from.toISOString()]
    );

    const byItem = Object.fromEntries(
      mine.map((i) => [
        String(i.id),
        {
          ...mapMineItem(i),
          views: 0,
          phone: 0,
          website: 0,
        },
      ])
    );

    for (const r of rows) {
      const bucket = byItem[String(r.item_id)];
      if (!bucket) continue;
      if (r.event_type === 'view') bucket.views = r.cnt;
      if (r.event_type === 'phone') bucket.phone = r.cnt;
      if (r.event_type === 'website') bucket.website = r.cnt;
    }

    const list = Object.values(byItem);
    const totals = list.reduce(
      (acc, row) => ({
        views: acc.views + row.views,
        phone: acc.phone + row.phone,
        website: acc.website + row.website,
      }),
      { views: 0, phone: 0, website: 0 }
    );

    res.json({ days, items: list, totals });
  } catch (err) {
    next(err);
  }
});

/** Owner: get one listing */
router.get('/mine/:id', requireAuth, async (req, res, next) => {
  try {
    const page = await loadDirectoryPage();
    const item = page.items.find(
      (i) =>
        String(i.id) === String(req.params.id) &&
        i.ownerUserId &&
        String(i.ownerUserId) === String(req.user.sub)
    );
    if (!item) return res.status(404).json({ error: 'Not found' });
    res.json(mapMineItem(item));
  } catch (err) {
    next(err);
  }
});

/** Owner: create draft listing (stays in cabinet after expiry too) */
router.post('/mine', requireAuth, async (req, res, next) => {
  try {
    await ensureOwnerRole(req.user.sub);
    const fields = parseListingBody(req.body || {});
    const page = await loadDirectoryPage();
    const now = new Date().toISOString();
    const row = {
      id: newItemId(),
      ...fields,
      status: 'draft',
      yellowFrame: false,
      isTop: false,
      ownerUserId: req.user.sub,
      paidUntil: null,
      createdAt: now,
      updatedAt: now,
    };
    page.items = [row, ...page.items];
    await saveDirectoryPage(page, pool, req.user.sub);
    res.status(201).json(mapMineItem(row));
  } catch (err) {
    next(err);
  }
});

/** Owner: update own listing fields (not admin publish) */
router.patch('/mine/:id', requireAuth, async (req, res, next) => {
  try {
    const page = await loadDirectoryPage();
    const idx = page.items.findIndex(
      (i) =>
        String(i.id) === String(req.params.id) &&
        i.ownerUserId &&
        String(i.ownerUserId) === String(req.user.sub)
    );
    if (idx < 0) return res.status(404).json({ error: 'Not found' });

    const existing = page.items[idx];
    const fields = parseListingBody({
      ...existing,
      ...req.body,
      category: req.body?.category ?? existing.category,
    });

    const nextStatus =
      existing.status === 'published' || existing.status === 'approved'
        ? existing.status
        : existing.status === 'rejected'
          ? 'draft'
          : existing.status || 'draft';

    const row = {
      ...existing,
      ...fields,
      status: nextStatus,
      updatedAt: new Date().toISOString(),
    };
    page.items[idx] = row;
    await saveDirectoryPage(page, pool, req.user.sub);
    res.json(mapMineItem(row));
  } catch (err) {
    next(err);
  }
});

export default router;
