import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const PAGE_KEY = 'page:directory';

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

async function loadDirectoryItems() {
  const { rows } = await pool.query(`select value from public.cms_kv where key = $1`, [PAGE_KEY]);
  let page = rows[0]?.value ?? {};
  if (typeof page === 'string') {
    try {
      page = JSON.parse(page);
    } catch {
      page = {};
    }
  }
  return Array.isArray(page?.items) ? page.items : [];
}

function isActiveListing(item) {
  if ((item.status || 'published') !== 'published') return false;
  if (!item.paidUntil) return true;
  return new Date(item.paidUntil).getTime() > Date.now();
}

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

    const items = await loadDirectoryItems();
    const item = items.find((i) => String(i.id) === itemId);
    if (!item || !isActiveListing(item)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const ownerId = item.ownerUserId || item.owner_id || null;
    const sessionKey = String(req.body?.sessionKey || req.body?.session_id || '').slice(0, 120) || null;

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

/** Owner: list my directory listings */
router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const items = await loadDirectoryItems();
    const mine = items
      .filter((i) => i.ownerUserId && String(i.ownerUserId) === String(req.user.sub))
      .map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        status: i.status || 'published',
        phone: i.phone || '',
        website: i.website || '',
        paidUntil: i.paidUntil || null,
        isTop: Boolean(i.isTop || i.top),
        yellowFrame: Boolean(i.yellowFrame),
        active: isActiveListing(i),
      }));
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

    const items = await loadDirectoryItems();
    const mine = items.filter(
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
          id: i.id,
          name: i.name,
          category: i.category,
          status: i.status,
          paidUntil: i.paidUntil || null,
          active: isActiveListing(i),
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

export default router;
