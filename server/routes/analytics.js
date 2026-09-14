import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

const BASE_EVENT_TYPES = new Set([
  'view',
  'click',
  'phone',
  'map',
  'website',
  'favorite_add',
  'favorite_remove',
]);

const PAGE_KEY = 'page:directory';

async function ensureBaseEventsTable() {
  await pool.query(`
    create table if not exists public.base_listing_events (
      id uuid primary key default gen_random_uuid(),
      base_id text not null,
      owner_id uuid references public.users (id) on delete set null,
      event_type text not null,
      source text,
      session_key text,
      created_at timestamptz not null default now()
    )
  `);
}

async function ensureDirectoryEventsTable() {
  await pool.query(`
    create table if not exists public.directory_listing_events (
      id uuid primary key default gen_random_uuid(),
      item_id text not null,
      owner_id uuid references public.users (id) on delete set null,
      event_type text not null,
      session_key text,
      created_at timestamptz not null default now()
    )
  `);
}

function parseDays(raw, fallback = 30) {
  return Math.min(365, Math.max(7, Number(raw) || fallback));
}

function fromDays(days) {
  return new Date(Date.now() - days * 86400000);
}

function emptyDayMap(days) {
  const from = fromDays(days - 1);
  from.setHours(0, 0, 0, 0);
  const map = new Map();
  for (let i = 0; i < days; i += 1) {
    const d = new Date(from.getTime() + i * 86400000);
    map.set(d.toISOString().slice(0, 10), 0);
  }
  return map;
}

function seriesFromMap(map) {
  return Array.from(map.entries()).map(([date, value]) => ({ date, value }));
}

function buildTypedSeries(days, dailyRows, types) {
  const map = emptyDayMap(days);
  const allow = Array.isArray(types) ? new Set(types) : null;
  for (const r of dailyRows) {
    if (allow && !allow.has(r.event_type)) continue;
    const key = String(r.day).slice(0, 10);
    if (map.has(key)) map.set(key, map.get(key) + Number(r.cnt || 0));
  }
  return seriesFromMap(map);
}

function sumEventTypes(rows) {
  const out = { views: 0, clicks: 0, phone: 0, website: 0, favorites: 0, map: 0 };
  for (const r of rows) {
    const n = Number(r.cnt) || 0;
    if (r.event_type === 'view') out.views = n;
    else if (r.event_type === 'phone') out.phone = n;
    else if (r.event_type === 'website') out.website = n;
    else if (r.event_type === 'map') out.map = n;
    else if (r.event_type === 'favorite_add') out.favorites = n;
    else if (r.event_type === 'click') out.clicks += n;
  }
  out.clicks += out.phone + out.map + out.website;
  return out;
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

/** Public: track base interaction */
router.post('/base/events', async (req, res, next) => {
  try {
    await ensureBaseEventsTable();
    const baseId = String(req.body?.baseId || req.body?.base_id || '').trim();
    let eventType = String(req.body?.eventType || req.body?.type || '').trim();
    const source = String(req.body?.source || '').slice(0, 80) || null;
    const sessionKey =
      String(req.body?.sessionKey || req.body?.session_id || '').slice(0, 120) || null;

    if (eventType === 'click' && source === 'phone') eventType = 'phone';
    if (eventType === 'click' && source === 'map') eventType = 'map';
    if (eventType === 'click' && source === 'website') eventType = 'website';

    if (!baseId) return res.status(400).json({ error: 'baseId required' });
    if (!BASE_EVENT_TYPES.has(eventType)) {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    const { rows } = await pool.query(
      `select id, owner_id from public.bases where id::text = $1 limit 1`,
      [baseId]
    );
    const base = rows[0];
    if (!base) return res.status(404).json({ error: 'Base not found' });

    await pool.query(
      `insert into public.base_listing_events (base_id, owner_id, event_type, source, session_key)
       values ($1, $2, $3, $4, $5)`,
      [String(base.id), base.owner_id, eventType, source, sessionKey]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/** Owner: analytics for my bases */
router.get('/owner/bases', requireAuth, async (req, res, next) => {
  try {
    await ensureBaseEventsTable();
    const days = parseDays(req.query.days);
    const from = fromDays(days);
    const chartDays = Math.min(days, 90);

    const { rows: bases } = await pool.query(
      `select id, name, status
       from public.bases
       where owner_id = $1
       order by updated_at desc nulls last`,
      [req.user.sub]
    );

    if (!bases.length) {
      return res.json({
        days,
        totals: { views: 0, clicks: 0, phone: 0, map: 0, favorites: 0, uniqueViews: 0 },
        items: [],
        byBase: [],
        charts: { views: [], clicks: [], favorites: [] },
      });
    }

    const baseIds = bases.map((b) => String(b.id));
    const { rows: grouped } = await pool.query(
      `select base_id, event_type, count(*)::int as cnt,
              count(distinct nullif(session_key, ''))::int as uniq
       from public.base_listing_events
       where owner_id = $1
         and base_id = any($2::text[])
         and created_at >= $3
       group by base_id, event_type`,
      [req.user.sub, baseIds, from.toISOString()]
    );

    const { rows: daily } = await pool.query(
      `select date_trunc('day', created_at)::date::text as day, event_type, count(*)::int as cnt
       from public.base_listing_events
       where owner_id = $1
         and base_id = any($2::text[])
         and created_at >= $3
       group by 1, 2
       order by 1`,
      [req.user.sub, baseIds, from.toISOString()]
    );

    const byBase = Object.fromEntries(
      bases.map((b) => [
        String(b.id),
        {
          id: String(b.id),
          name: b.name,
          status: b.status,
          views: 0,
          uniqueViews: 0,
          clicks: 0,
          phone: 0,
          map: 0,
          favorites: 0,
          reviews: 0,
          rating: 0,
        },
      ])
    );

    const totals = { views: 0, clicks: 0, phone: 0, map: 0, favorites: 0, uniqueViews: 0 };

    for (const r of grouped) {
      const bucket = byBase[String(r.base_id)];
      if (!bucket) continue;
      const n = r.cnt;
      if (r.event_type === 'view') {
        bucket.views = n;
        bucket.uniqueViews = r.uniq;
        totals.views += n;
        totals.uniqueViews += r.uniq;
      } else if (r.event_type === 'click') {
        bucket.clicks += n;
        totals.clicks += n;
      } else if (r.event_type === 'phone') {
        bucket.phone = n;
        bucket.clicks += n;
        totals.phone += n;
        totals.clicks += n;
      } else if (r.event_type === 'map') {
        bucket.map = n;
        bucket.clicks += n;
        totals.map += n;
        totals.clicks += n;
      } else if (r.event_type === 'website') {
        bucket.clicks += n;
        totals.clicks += n;
      } else if (r.event_type === 'favorite_add') {
        bucket.favorites = n;
        totals.favorites += n;
      }
    }

    const items = Object.values(byBase);
    res.json({
      days,
      totals,
      items,
      byBase: items,
      charts: {
        views: buildTypedSeries(chartDays, daily, ['view']),
        clicks: buildTypedSeries(chartDays, daily, ['click', 'phone', 'map', 'website']),
        favorites: buildTypedSeries(chartDays, daily, ['favorite_add']),
      },
    });
  } catch (err) {
    next(err);
  }
});

/** Admin: platform listing analytics */
router.get('/admin', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    await ensureBaseEventsTable();
    await ensureDirectoryEventsTable();
    const days = parseDays(req.query.days);
    const from = fromDays(days);

    const [baseTotals, dirTotals, baseTop, dirTop, ownersBase, ownersDir] = await Promise.all([
      pool.query(
        `select event_type, count(*)::int as cnt
         from public.base_listing_events
         where created_at >= $1
         group by event_type`,
        [from.toISOString()]
      ),
      pool.query(
        `select event_type, count(*)::int as cnt
         from public.directory_listing_events
         where created_at >= $1
         group by event_type`,
        [from.toISOString()]
      ),
      pool.query(
        `select e.base_id, b.name, b.owner_id,
                coalesce(p.display_name, u.email, '—') as owner_name,
                count(*) filter (where e.event_type = 'view')::int as views,
                count(*) filter (where e.event_type in ('click','phone','map','website'))::int as clicks,
                count(*) filter (where e.event_type = 'phone')::int as phone,
                count(*) filter (where e.event_type = 'favorite_add')::int as favorites
         from public.base_listing_events e
         left join public.bases b on b.id::text = e.base_id
         left join public.users u on u.id = coalesce(e.owner_id, b.owner_id)
         left join public.profiles p on p.user_id = coalesce(e.owner_id, b.owner_id)
         where e.created_at >= $1
         group by e.base_id, b.name, b.owner_id, p.display_name, u.email
         order by views desc
         limit 50`,
        [from.toISOString()]
      ),
      pool.query(
        `select e.item_id, e.owner_id,
                coalesce(p.display_name, u.email, '—') as owner_name,
                count(*) filter (where e.event_type = 'view')::int as views,
                count(*) filter (where e.event_type = 'phone')::int as phone,
                count(*) filter (where e.event_type = 'website')::int as website
         from public.directory_listing_events e
         left join public.users u on u.id = e.owner_id
         left join public.profiles p on p.user_id = e.owner_id
         where e.created_at >= $1
         group by e.item_id, e.owner_id, p.display_name, u.email
         order by views desc
         limit 50`,
        [from.toISOString()]
      ),
      pool.query(
        `select e.owner_id,
                coalesce(p.display_name, u.email, '—') as owner_name,
                count(*) filter (where e.event_type = 'view')::int as views,
                count(*) filter (where e.event_type in ('click','phone','map','website'))::int as clicks,
                count(*) filter (where e.event_type = 'phone')::int as phone,
                count(*) filter (where e.event_type = 'favorite_add')::int as favorites
         from public.base_listing_events e
         left join public.users u on u.id = e.owner_id
         left join public.profiles p on p.user_id = e.owner_id
         where e.created_at >= $1 and e.owner_id is not null
         group by e.owner_id, p.display_name, u.email
         order by views desc
         limit 40`,
        [from.toISOString()]
      ),
      pool.query(
        `select e.owner_id,
                coalesce(p.display_name, u.email, '—') as owner_name,
                count(*) filter (where e.event_type = 'view')::int as views,
                count(*) filter (where e.event_type = 'phone')::int as phone,
                count(*) filter (where e.event_type = 'website')::int as website
         from public.directory_listing_events e
         left join public.users u on u.id = e.owner_id
         left join public.profiles p on p.user_id = e.owner_id
         where e.created_at >= $1 and e.owner_id is not null
         group by e.owner_id, p.display_name, u.email
         order by views desc
         limit 40`,
        [from.toISOString()]
      ),
    ]);

    const items = await loadDirectoryItems();
    const itemMeta = Object.fromEntries(
      items.map((i) => [
        String(i.id),
        { name: i.name || i.id, category: i.category || '', status: i.status || 'published' },
      ])
    );

    res.json({
      days,
      bases: {
        totals: sumEventTypes(baseTotals.rows),
        topItems: baseTop.rows,
        byOwner: ownersBase.rows,
      },
      directory: {
        totals: sumEventTypes(dirTotals.rows),
        topItems: dirTop.rows.map((r) => ({
          ...r,
          name: itemMeta[String(r.item_id)]?.name || r.item_id,
          category: itemMeta[String(r.item_id)]?.category || '',
          status: itemMeta[String(r.item_id)]?.status || '',
        })),
        byOwner: ownersDir.rows,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
