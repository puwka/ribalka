import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

function mapReport(row, images = [], videos = []) {
  return {
    id: String(row.id),
    author: row.author_name,
    authorUserId: row.user_id || null,
    place: row.place_name,
    baseId: row.base_id ? String(row.base_id) : null,
    baseName: null,
    date: row.trip_date,
    fish: row.fish_caught || '',
    bait: row.bait || '',
    weight: row.weight_label || '',
    description: row.description || '',
    extra: '',
    images,
    videos,
    rating: row.rating_score || 0,
    likedBy: [],
    starSum: 0,
    starCount: 0,
    starBy: {},
    comments: [],
    status: row.status,
    moderationNote: row.moderation_note || null,
    moderatedAt: row.moderated_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadMedia(reportId) {
  const [imgs, vids] = await Promise.all([
    pool.query(
      `select external_url, storage_path, sort_order from public.report_images
       where report_id = $1 order by sort_order`,
      [reportId]
    ),
    pool.query(
      `select external_url, storage_path, sort_order from public.report_videos
       where report_id = $1 order by sort_order`,
      [reportId]
    ),
  ]);
  const images = imgs.rows.map((r) => r.external_url || r.storage_path).filter(Boolean);
  const videos = vids.rows.map((r) => r.external_url || r.storage_path).filter(Boolean);
  return { images, videos };
}

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const status = req.query.status || 'approved';
    const { rows } = await pool.query(
      status === 'all'
        ? `select * from public.fishing_reports
           order by trip_date desc nulls last, created_at desc
           limit 200`
        : `select * from public.fishing_reports
           where status = $1::public.moderation_status
           order by trip_date desc nulls last, created_at desc
           limit 200`,
      status === 'all' ? [] : [status]
    );
    const out = [];
    for (const row of rows) {
      const media = await loadMedia(row.id);
      out.push(mapReport(row, media.images, media.videos));
    }
    res.json(out);
  } catch (err) {
    next(err);
  }
});

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select * from public.fishing_reports
       where user_id = $1
       order by created_at desc`,
      [req.user.sub]
    );
    const out = [];
    for (const row of rows) {
      const media = await loadMedia(row.id);
      out.push(mapReport(row, media.images, media.videos));
    }
    res.json(out);
  } catch (err) {
    next(err);
  }
});

router.get('/moderation', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'pending';
    const { rows } = await pool.query(
      status === 'all'
        ? `select * from public.fishing_reports
           order by created_at desc
           limit 300`
        : `select * from public.fishing_reports
           where status = $1::public.moderation_status
           order by created_at desc
           limit 300`,
      status === 'all' ? [] : [status]
    );
    const out = [];
    for (const row of rows) {
      const media = await loadMedia(row.id);
      out.push(mapReport(row, media.images, media.videos));
    }
    res.json(out);
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const body = req.body || {};
    const author = String(body.author || body.author_name || '').trim();
    const place = String(body.place || body.place_name || body.baseName || '').trim();
    const fish = String(body.fish || body.fish_caught || '').trim();
    const description = String(body.description || '').trim();
    if (!author) return res.status(400).json({ error: 'Укажите имя' });
    if (!place) return res.status(400).json({ error: 'Укажите место' });
    if (!fish) return res.status(400).json({ error: 'Укажите улов' });
    if (!description) return res.status(400).json({ error: 'Добавьте описание' });

    const baseId = isUuid(body.baseId || body.base_id) ? body.baseId || body.base_id : null;
    const tripDate = body.date || body.trip_date || new Date().toISOString().slice(0, 10);
    const images = Array.isArray(body.images) ? body.images.filter(Boolean).slice(0, 5) : [];
    const videos = Array.isArray(body.videos) ? body.videos.filter(Boolean).slice(0, 2) : [];

    await client.query('begin');
    const { rows } = await client.query(
      `insert into public.fishing_reports (
         user_id, author_name, base_id, place_name, trip_date,
         fish_caught, bait, weight_label, description, status
       ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,'pending')
       returning *`,
      [
        req.user.sub,
        author,
        baseId,
        place,
        tripDate,
        fish,
        String(body.bait || '').trim() || null,
        String(body.weight || body.weight_label || '').trim() || null,
        description,
      ]
    );
    const row = rows[0];
    for (let i = 0; i < images.length; i++) {
      await client.query(
        `insert into public.report_images (report_id, external_url, provider, sort_order)
         values ($1,$2,'external',$3)`,
        [row.id, images[i], i]
      );
    }
    for (let i = 0; i < videos.length; i++) {
      await client.query(
        `insert into public.report_videos (report_id, external_url, provider, sort_order)
         values ($1,$2,'external',$3)`,
        [row.id, videos[i], i]
      );
    }
    await client.query('commit');
    res.status(201).json(mapReport(row, images, videos));
  } catch (err) {
    await client.query('rollback');
    next(err);
  } finally {
    client.release();
  }
});

router.patch('/:id/moderate', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!['approved', 'rejected', 'hidden', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const note = req.body?.note || req.body?.moderationNote || null;
    const { rows } = await pool.query(
      `update public.fishing_reports set
         status = $2::public.moderation_status,
         moderation_note = $3,
         moderated_at = now(),
         updated_at = now()
       where id = $1
       returning *`,
      [req.params.id, status, note]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    const media = await loadMedia(rows[0].id);
    res.json(mapReport(rows[0], media.images, media.videos));
  } catch (err) {
    next(err);
  }
});

export default router;
