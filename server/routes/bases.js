import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

const BASE_SELECT = `
  b.*,
  coalesce(
    json_agg(distinct jsonb_build_object(
      'id', bi.id,
      'storage_path', bi.storage_path,
      'external_url', bi.external_url,
      'provider', bi.provider,
      'sort_order', bi.sort_order,
      'is_cover', bi.is_cover
    )) filter (where bi.id is not null),
    '[]'
  ) as base_images,
  coalesce(
    json_agg(distinct jsonb_build_object(
      'id', bv.id,
      'storage_path', bv.storage_path,
      'external_url', bv.external_url,
      'provider', bv.provider,
      'sort_order', bv.sort_order,
      'title', bv.title
    )) filter (where bv.id is not null),
    '[]'
  ) as base_videos,
  coalesce(
    json_agg(distinct jsonb_build_object(
      'id', bs.id,
      'name', bs.name,
      'sort_order', bs.sort_order
    )) filter (where bs.id is not null),
    '[]'
  ) as base_services
`;

function mapRow(row) {
  if (!row) return null;
  return {
    ...row,
    base_images: row.base_images || [],
    base_videos: row.base_videos || [],
    base_services: row.base_services || [],
  };
}

router.get('/', async (req, res, next) => {
  try {
    const { type } = req.query;
    const params = ['approved'];
    let sql = `
      select ${BASE_SELECT}
      from public.bases b
      left join public.base_images bi on bi.base_id = b.id
      left join public.base_videos bv on bv.base_id = b.id
      left join public.base_services bs on bs.base_id = b.id
      where b.status = $1
    `;
    if (type) {
      params.push(type);
      sql += ` and b.type = $${params.length}`;
    }
    sql += ` group by b.id order by b.name`;
    const { rows } = await pool.query(sql, params);
    res.json(rows.map(mapRow));
  } catch (err) {
    next(err);
  }
});

router.get('/mine', async (req, res, next) => {
  try {
    if (!req.user?.sub) return res.status(401).json({ error: 'Unauthorized' });
    const { rows } = await pool.query(
      `select ${BASE_SELECT}
       from public.bases b
       left join public.base_images bi on bi.base_id = b.id
       left join public.base_videos bv on bv.base_id = b.id
       left join public.base_services bs on bs.base_id = b.id
       where b.owner_id = $1
       group by b.id order by b.updated_at desc`,
      [req.user.sub]
    );
    res.json(rows.map(mapRow));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select ${BASE_SELECT}
       from public.bases b
       left join public.base_images bi on bi.base_id = b.id
       left join public.base_videos bv on bv.base_id = b.id
       left join public.base_services bs on bs.base_id = b.id
       where b.id = $1
       group by b.id`,
      [req.params.id]
    );
    const row = mapRow(rows[0]);
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.status !== 'approved') {
      const isOwner = req.user?.sub && req.user.sub === row.owner_id;
      const isAdmin = (req.user?.roles || []).includes('admin');
      if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Forbidden' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

export default router;
