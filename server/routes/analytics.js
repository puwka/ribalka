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
const WATERS_KEY = 'waters';

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
  await pool.query(`
    create index if not exists base_listing_events_created_idx
      on public.base_listing_events (created_at desc)
  `);
  await pool.query(`
    create index if not exists base_listing_events_base_idx
      on public.base_listing_events (base_id, created_at desc)
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

async function getKv(key) {
  const { rows } = await pool.query(`select value from public.cms_kv where key = $1`, [key]);
  let value = rows[0]?.value ?? null;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      value = null;
    }
  }
  return value;
}

/** CMS water overrides (admin catalog). Seed-only waters may be absent. */
async function loadWatersMeta() {
  const value = await getKv(WATERS_KEY);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const row of Object.values(value)) {
    if (!row?.id) continue;
    const id = String(row.id);
    out[id] = {
      name: row.name || id,
      type: row.type || '',
      ownerUserId: row.ownerUserId || row.owner_id || null,
    };
  }
  return out;
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
  let page = await getKv(PAGE_KEY);
  if (!page || typeof page !== 'object') page = {};
  return Array.isArray(page?.items) ? page.items : [];
}

/**
 * Resolve owner for analytics.
 * Owner listings live in public.bases; catalog/CMS waters often do not —
 * still accept those IDs so admin stats are not stuck at zero.
 */
async function resolveBaseOwnerId(baseId) {
  const { rows } = await pool.query(
    `select owner_id from public.bases where id::text = $1 limit 1`,
    [baseId]
  );
  if (rows[0]) return rows[0].owner_id || null;

  // CMS waters rarely have a real user owner; skip heavy map load on every hit.
  return null;
}

/** Public: track base / water interaction */
router.post('/base/events', async (req, res, next) => {
  try {
    await ensureBaseEventsTable();
    const baseId = String(req.body?.baseId || req.body?.base_id || '').trim().slice(0, 120);
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

    const ownerId = await resolveBaseOwnerId(baseId);

    await pool.query(
      `insert into public.base_listing_events (base_id, owner_id, event_type, source, session_key)
       values ($1, $2, $3, $4, $5)`,
      [baseId, ownerId, eventType, source, sessionKey]
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
    const watersMeta = await loadWatersMeta();
    const itemMeta = Object.fromEntries(
      items.map((i) => [
        String(i.id),
        {
          name: i.name || i.id,
          category: i.category || '',
          status: i.status || 'published',
          ownerUserId: i.ownerUserId || i.owner_id || null,
        },
      ])
    );

    const directoryTopItems = dirTop.rows.map((r) => ({
      ...r,
      name: itemMeta[String(r.item_id)]?.name || r.item_id,
      category: itemMeta[String(r.item_id)]?.category || '',
      status: itemMeta[String(r.item_id)]?.status || '',
      owner_id: r.owner_id || itemMeta[String(r.item_id)]?.ownerUserId || null,
    }));

    const basesTopItems = baseTop.rows.map((r) => ({
      ...r,
      name: r.name || watersMeta[String(r.base_id)]?.name || `Водоём ${r.base_id}`,
    }));

    // Attribute directory events to CMS ownerUserId when event.owner_id is null
    const { rows: dirItemStats } = await pool.query(
      `select item_id,
              count(*) filter (where event_type = 'view')::int as views,
              count(*) filter (where event_type = 'phone')::int as phone,
              count(*) filter (where event_type = 'website')::int as website
       from public.directory_listing_events
       where created_at >= $1
       group by item_id`,
      [from.toISOString()]
    );
    const ownerAgg = new Map();
    for (const row of dirItemStats) {
      const oid = String(
        itemMeta[String(row.item_id)]?.ownerUserId || ''
      ).trim();
      if (!oid) continue;
      const cur = ownerAgg.get(oid) || { owner_id: oid, owner_name: '—', views: 0, phone: 0, website: 0 };
      cur.views += Number(row.views) || 0;
      cur.phone += Number(row.phone) || 0;
      cur.website += Number(row.website) || 0;
      ownerAgg.set(oid, cur);
    }
    // Fill names from SQL byOwner when available
    for (const r of ownersDir.rows) {
      const cur = ownerAgg.get(String(r.owner_id));
      if (cur && r.owner_name) cur.owner_name = r.owner_name;
    }
    const missingIds = [...ownerAgg.values()].filter((o) => o.owner_name === '—').map((o) => o.owner_id);
    if (missingIds.length) {
      const { rows: names } = await pool.query(
        `select u.id::text as id, coalesce(p.display_name, u.email, '—') as owner_name
         from public.users u
         left join public.profiles p on p.user_id = u.id
         where u.id::text = any($1::text[])`,
        [missingIds]
      );
      for (const n of names) {
        const cur = ownerAgg.get(String(n.id));
        if (cur) cur.owner_name = n.owner_name;
      }
    }

    res.json({
      days,
      bases: {
        totals: sumEventTypes(baseTotals.rows),
        topItems: basesTopItems,
        byOwner: ownersBase.rows,
      },
      directory: {
        totals: sumEventTypes(dirTotals.rows),
        topItems: directoryTopItems,
        byOwner: [...ownerAgg.values()].sort((a, b) => b.views - a.views).slice(0, 40),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
