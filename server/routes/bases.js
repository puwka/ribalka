import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/auth.js';

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

async function fetchBase(id) {
  const { rows } = await pool.query(
    `select ${BASE_SELECT}
     from public.bases b
     left join public.base_images bi on bi.base_id = b.id
     left join public.base_videos bv on bv.base_id = b.id
     left join public.base_services bs on bs.base_id = b.id
     where b.id = $1
     group by b.id`,
    [id]
  );
  return mapRow(rows[0]);
}

function parsePayload(body) {
  const name = String(body.name || '').trim();
  if (!name) {
    const err = new Error('Укажите название');
    err.status = 400;
    throw err;
  }
  const lat = body.lat === '' || body.lat == null ? null : Number(body.lat);
  const lng = body.lng === '' || body.lng == null ? null : Number(body.lng);
  const images = Array.isArray(body.images)
    ? body.images
    : String(body.imagesText || '')
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
  const videos = Array.isArray(body.videos)
    ? body.videos
    : String(body.videosText || '')
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
  const services = Array.isArray(body.services)
    ? body.services
    : String(body.servicesText || '')
        .split(/[,;\n]/)
        .map((s) => s.trim())
        .filter(Boolean);

  return {
    name,
    type: body.type === 'free' ? 'free' : 'paid',
    short_description: String(body.short_description || body.description || '')
      .trim()
      .slice(0, 180),
    description: String(body.description || '').trim(),
    region: String(body.region || 'Пермский край').trim(),
    address: String(body.address || '').trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    phone: String(body.phone || '').trim() || null,
    contacts: String(body.contacts || '').trim() || null,
    website_url: String(body.website_url || '').trim() || null,
    social_links: body.social_links || {
      vk: body.social_vk || null,
      telegram: body.social_telegram || null,
      max: body.social_max || null,
      other: body.social_other || null,
    },
    price_label: String(body.price_label || '').trim() || null,
    price_from:
      body.price_from === '' || body.price_from == null ? null : Number(body.price_from),
    conditions: String(body.conditions || '').trim() || null,
    features: String(body.features || '').trim() || null,
    work_hours: String(body.work_hours || '').trim() || null,
    fish_species: String(body.fish_species || '').trim() || null,
    images,
    videos,
    services,
  };
}

async function replaceMedia(client, baseId, { images, videos, services }) {
  await client.query('delete from public.base_images where base_id = $1', [baseId]);
  await client.query('delete from public.base_videos where base_id = $1', [baseId]);
  await client.query('delete from public.base_services where base_id = $1', [baseId]);

  for (let i = 0; i < images.length; i += 1) {
    const url = images[i];
    await client.query(
      `insert into public.base_images (base_id, external_url, provider, sort_order, is_cover)
       values ($1, $2, 'external', $3, $4)`,
      [baseId, url, i, i === 0]
    );
  }
  for (let i = 0; i < videos.length; i += 1) {
    await client.query(
      `insert into public.base_videos (base_id, external_url, provider, sort_order)
       values ($1, $2, 'youtube', $3)`,
      [baseId, videos[i], i]
    );
  }
  for (let i = 0; i < services.length; i += 1) {
    await client.query(
      `insert into public.base_services (base_id, name, sort_order)
       values ($1, $2, $3) on conflict (base_id, name) do nothing`,
      [baseId, services[i], i]
    );
  }
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

router.get('/moderation', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const params = [];
    let sql = `
      select ${BASE_SELECT}
      from public.bases b
      left join public.base_images bi on bi.base_id = b.id
      left join public.base_videos bv on bv.base_id = b.id
      left join public.base_services bs on bs.base_id = b.id
      where 1=1
    `;
    if (status !== 'all') {
      params.push(status);
      sql += ` and b.status = $${params.length}`;
    }
    sql += ' group by b.id order by b.submitted_at desc nulls last, b.updated_at desc';
    const { rows } = await pool.query(sql, params);
    res.json(rows.map(mapRow));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const row = await fetchBase(req.params.id);
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

/** Create draft */
router.post('/', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const data = parsePayload(req.body || {});
    await client.query('begin');
    const { rows } = await client.query(
      `insert into public.bases (
         owner_id, type, status, name, short_description, description,
         region, address, lat, lng, phone, contacts, website_url, social_links,
         price_label, price_from, conditions, features, work_hours, fish_species
       ) values (
         $1,$2,'draft',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16,$17,$18,$19
       ) returning id`,
      [
        req.user.sub,
        data.type,
        data.name,
        data.short_description,
        data.description,
        data.region,
        data.address,
        data.lat,
        data.lng,
        data.phone,
        data.contacts,
        data.website_url,
        JSON.stringify(data.social_links || {}),
        data.price_label,
        data.price_from,
        data.conditions,
        data.features,
        data.work_hours,
        data.fish_species,
      ]
    );
    const id = rows[0].id;
    await replaceMedia(client, id, data);
    await client.query('commit');
    res.status(201).json(await fetchBase(id));
  } catch (err) {
    await client.query('rollback').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

/** Update draft/rejected */
router.patch('/:id', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { rows: found } = await client.query('select * from public.bases where id = $1', [
      req.params.id,
    ]);
    const existing = found[0];
    if (!existing) return res.status(404).json({ error: 'Not found' });
    const isAdmin = (req.user.roles || []).includes('admin');
    if (existing.owner_id !== req.user.sub && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!isAdmin && !['draft', 'rejected'].includes(existing.status)) {
      return res.status(400).json({ error: 'Редактирование доступно только для черновика/отклонённой' });
    }

    const data = parsePayload(req.body || {});
    await client.query('begin');
    await client.query(
      `update public.bases set
         type=$2, name=$3, short_description=$4, description=$5,
         region=$6, address=$7, lat=$8, lng=$9, phone=$10, contacts=$11,
         website_url=$12, social_links=$13::jsonb, price_label=$14, price_from=$15,
         conditions=$16, features=$17, work_hours=$18, fish_species=$19,
         updated_at=now()
       where id=$1`,
      [
        existing.id,
        data.type,
        data.name,
        data.short_description,
        data.description,
        data.region,
        data.address,
        data.lat,
        data.lng,
        data.phone,
        data.contacts,
        data.website_url,
        JSON.stringify(data.social_links || {}),
        data.price_label,
        data.price_from,
        data.conditions,
        data.features,
        data.work_hours,
        data.fish_species,
      ]
    );
    await replaceMedia(client, existing.id, data);
    await client.query('commit');
    res.json(await fetchBase(existing.id));
  } catch (err) {
    await client.query('rollback').catch(() => {});
    next(err);
  } finally {
    client.release();
  }
});

/** Admin moderate */
router.post('/:id/moderate', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { action, reason } = req.body || {};
    const { rows } = await pool.query('select * from public.bases where id = $1', [req.params.id]);
    const base = rows[0];
    if (!base) return res.status(404).json({ error: 'Not found' });

    if (action === 'approve') {
      await pool.query(
        `update public.bases set status='approved', published_at=coalesce(published_at, now()),
         rejection_reason=null, reviewed_at=now(), reviewed_by=$2, updated_at=now() where id=$1`,
        [base.id, req.user.sub]
      );
    } else if (action === 'reject') {
      if (!reason?.trim()) return res.status(400).json({ error: 'Укажите причину отказа' });
      await pool.query(
        `update public.bases set status='rejected', rejection_reason=$2,
         reviewed_at=now(), reviewed_by=$3, updated_at=now() where id=$1`,
        [base.id, reason.trim(), req.user.sub]
      );
    } else if (action === 'archive') {
      await pool.query(
        `update public.bases set status='archived', reviewed_at=now(), reviewed_by=$2, updated_at=now() where id=$1`,
        [base.id, req.user.sub]
      );
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }
    res.json(await fetchBase(base.id));
  } catch (err) {
    next(err);
  }
});

export default router;
