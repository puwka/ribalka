import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
const WATERS_KEY = 'waters';
const DISTRICTS_KEY = 'districts';

async function getKv(key) {
  const { rows } = await pool.query('select value from public.cms_kv where key = $1', [key]);
  return rows[0]?.value ?? null;
}

async function setKv(key, value, adminId) {
  await pool.query(
    `insert into public.cms_kv (key, value, updated_by, updated_at)
     values ($1, $2::jsonb, $3, now())
     on conflict (key) do update set
       value = excluded.value,
       updated_by = excluded.updated_by,
       updated_at = now()`,
    [key, JSON.stringify(value), adminId || null]
  );
}

async function getWatersMap() {
  const value = await getKv(WATERS_KEY);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

async function saveWatersMap(map, adminId) {
  await setKv(WATERS_KEY, map, adminId);
}

router.use(authMiddleware);

/** Public: catalog overrides so every visitor sees the same waters */
router.get('/waters', async (_req, res, next) => {
  try {
    const map = await getWatersMap();
    const list = Object.values(map).filter(Boolean);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

router.get('/waters/:id', async (req, res, next) => {
  try {
    const map = await getWatersMap();
    const row = map[String(req.params.id)];
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) {
    next(err);
  }
});

/** Admin: merge waters from browser IndexedDB into server store */
router.put('/waters', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const incoming = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(incoming)) {
      return res.status(400).json({ error: 'Expected array of water records' });
    }
    const map = await getWatersMap();
    for (const item of incoming) {
      if (!item?.id) continue;
      const id = String(item.id);
      const prev = map[id];
      if (
        !prev ||
        String(item.updated_at || '') >= String(prev.updated_at || '')
      ) {
        map[id] = { ...item, id, updated_at: item.updated_at || new Date().toISOString() };
      }
    }
    await saveWatersMap(map, req.user.sub);
    res.json(Object.values(map));
  } catch (err) {
    next(err);
  }
});

router.put('/waters/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const body = req.body || {};
    const record = {
      ...body,
      id,
      updated_at: new Date().toISOString(),
    };
    const map = await getWatersMap();
    map[id] = record;
    await saveWatersMap(map, req.user.sub);
    res.json(record);
  } catch (err) {
    next(err);
  }
});

router.delete('/waters/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const id = String(req.params.id);
    const map = await getWatersMap();
    if (!map[id]) return res.status(404).json({ error: 'Not found' });
    delete map[id];
    await saveWatersMap(map, req.user.sub);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

/** Districts for water filters */
router.get('/districts', async (_req, res, next) => {
  try {
    const value = await getKv(DISTRICTS_KEY);
    const list = Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
    res.json(
      list
        .filter((d) => d && d.name && d.active !== false)
        .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0) || String(a.name).localeCompare(b.name, 'ru'))
    );
  } catch (err) {
    next(err);
  }
});

router.get('/districts/all', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const value = await getKv(DISTRICTS_KEY);
    const list = Array.isArray(value) ? value : Array.isArray(value?.items) ? value.items : [];
    res.json(list.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
  } catch (err) {
    next(err);
  }
});

router.put('/districts', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const incoming = Array.isArray(req.body) ? req.body : req.body?.items;
    if (!Array.isArray(incoming)) {
      return res.status(400).json({ error: 'Expected array of districts' });
    }
    const list = incoming
      .map((d, i) => ({
        id: String(d.id || `d-${i}`),
        name: String(d.name || '').trim(),
        sort_order: Number(d.sort_order ?? i * 10),
        active: d.active !== false,
      }))
      .filter((d) => d.name);
    await setKv(DISTRICTS_KEY, list, req.user.sub);
    res.json(list);
  } catch (err) {
    next(err);
  }
});

export default router;
