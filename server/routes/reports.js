import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(v) {
  return typeof v === 'string' && UUID_RE.test(v);
}

function voterKeyFrom(req, body = {}) {
  if (req.user?.sub) return String(req.user.sub);
  const anon = String(body.anonId || body.anon_id || req.query.anonId || '').trim();
  return anon ? `anon:${anon}` : null;
}

function mapReport(row, images = [], videos = [], social = {}) {
  const likedBy = social.likedBy || [];
  const starBy = social.starBy || {};
  const starSum = social.starSum || 0;
  const starCount = social.starCount || 0;
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
    rating: likedBy.length || row.rating_score || 0,
    likedBy,
    starSum,
    starCount,
    starBy,
    comments: social.comments || [],
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

async function loadSocial(reportId) {
  try {
    const [likes, stars, comments] = await Promise.all([
      pool.query(`select voter_key from public.report_likes where report_id = $1`, [reportId]),
      pool.query(`select voter_key, stars from public.report_stars where report_id = $1`, [reportId]),
      pool.query(
        `select id, author_name, user_id, body, parent_id, status, created_at
         from public.report_comments
         where report_id = $1 and status <> 'hidden'
         order by created_at asc`,
        [reportId]
      ),
    ]);
    const likedBy = likes.rows.map((r) => r.voter_key);
    const starBy = {};
    let starSum = 0;
    for (const r of stars.rows) {
      starBy[r.voter_key] = Number(r.stars);
      starSum += Number(r.stars);
    }
    return {
      likedBy,
      starBy,
      starSum,
      starCount: stars.rows.length,
      comments: comments.rows.map((c) => ({
        id: String(c.id),
        author: c.author_name,
        authorUserId: c.user_id || null,
        text: c.body,
        date: c.created_at,
        parentId: c.parent_id ? String(c.parent_id) : null,
        status: c.status || 'approved',
      })),
    };
  } catch {
    return { likedBy: [], starBy: {}, starSum: 0, starCount: 0, comments: [] };
  }
}

async function buildReport(row) {
  const media = await loadMedia(row.id);
  const social = await loadSocial(row.id);
  return mapReport(row, media.images, media.videos, social);
}

function publicWithViewer(report, viewerKey) {
  const likedBy = Array.isArray(report.likedBy) ? report.likedBy : [];
  const starCount = report.starCount || 0;
  const starAvg =
    starCount > 0 ? Math.round((report.starSum / starCount) * 10) / 10 : 0;
  return {
    ...report,
    rating: likedBy.length,
    starAvg,
    hasLiked: viewerKey ? likedBy.includes(viewerKey) : false,
    myStar: viewerKey && report.starBy ? report.starBy[viewerKey] || 0 : 0,
  };
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
      out.push(await buildReport(row));
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
      out.push(await buildReport(row));
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
      out.push(await buildReport(row));
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
    res.status(201).json(await buildReport(row));
  } catch (err) {
    await client.query('rollback');
    next(err);
  } finally {
    client.release();
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`select * from public.fishing_reports where id = $1`, [
      req.params.id,
    ]);
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Отчёт не найден' });

    const isAdmin = (req.user?.roles || []).includes('admin');
    const isAuthor = req.user?.sub && row.user_id === req.user.sub;
    if (!isAdmin && !isAuthor && row.status !== 'approved') {
      return res.status(404).json({ error: 'Отчёт недоступен' });
    }

    res.json(await buildReport(row));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/like', async (req, res, next) => {
  try {
    const key = voterKeyFrom(req, req.body || {});
    if (!key) return res.status(400).json({ error: 'Не удалось определить голосующего' });

    const { rows } = await pool.query(`select * from public.fishing_reports where id = $1`, [
      req.params.id,
    ]);
    const row = rows[0];
    if (!row || row.status !== 'approved') {
      return res.status(404).json({ error: 'Отчёт не найден' });
    }

    const existing = await pool.query(
      `select 1 from public.report_likes where report_id = $1 and voter_key = $2`,
      [row.id, key]
    );
    if (existing.rows[0]) {
      const report = publicWithViewer(await buildReport(row), key);
      return res.json({ success: false, message: 'Вы уже поставили лайк', report });
    }

    await pool.query(
      `insert into public.report_likes (report_id, voter_key, user_id)
       values ($1,$2,$3)
       on conflict do nothing`,
      [row.id, key, req.user?.sub || null]
    );
    await pool.query(
      `update public.fishing_reports set
         rating_score = (select count(*)::int from public.report_likes where report_id = $1),
         updated_at = now()
       where id = $1`,
      [row.id]
    );

    const report = publicWithViewer(await buildReport(row), key);
    res.json({ success: true, message: 'Лайк учтён', report });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/stars', async (req, res, next) => {
  try {
    const key = voterKeyFrom(req, req.body || {});
    if (!key) return res.status(400).json({ error: 'Войдите или обновите страницу' });
    const value = Number(req.body?.stars ?? req.body?.rating);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      return res.status(400).json({ error: 'Оценка должна быть от 1 до 5' });
    }

    const { rows } = await pool.query(`select * from public.fishing_reports where id = $1`, [
      req.params.id,
    ]);
    const row = rows[0];
    if (!row || row.status !== 'approved') {
      return res.status(404).json({ error: 'Отчёт не найден' });
    }

    await pool.query(
      `insert into public.report_stars (report_id, voter_key, user_id, stars, updated_at)
       values ($1,$2,$3,$4,now())
       on conflict (report_id, voter_key) do update set
         stars = excluded.stars,
         user_id = coalesce(excluded.user_id, public.report_stars.user_id),
         updated_at = now()`,
      [row.id, key, req.user?.sub || null, value]
    );

    res.json(publicWithViewer(await buildReport(row), key));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/comments', async (req, res, next) => {
  try {
    const body = req.body || {};
    const author = String(body.author || body.author_name || '').trim();
    const text = String(body.text || body.body || '').trim();
    if (!author || !text) return res.status(400).json({ error: 'Заполните имя и текст' });

    const { rows } = await pool.query(`select * from public.fishing_reports where id = $1`, [
      req.params.id,
    ]);
    const row = rows[0];
    if (!row || row.status !== 'approved') {
      return res.status(404).json({ error: 'Отчёт не найден' });
    }

    const parentId = isUuid(body.parentId || body.parent_id) ? body.parentId || body.parent_id : null;
    const { rows: inserted } = await pool.query(
      `insert into public.report_comments (report_id, author_name, user_id, body, parent_id, status)
       values ($1,$2,$3,$4,$5,'approved')
       returning *`,
      [row.id, author, req.user?.sub || null, text, parentId]
    );
    const c = inserted[0];
    const comment = {
      id: String(c.id),
      author: c.author_name,
      authorUserId: c.user_id || null,
      text: c.body,
      date: c.created_at,
      parentId: c.parent_id ? String(c.parent_id) : null,
      status: c.status,
    };
    res.status(201).json({
      comment,
      report: publicWithViewer(await buildReport(row), voterKeyFrom(req, body)),
    });
  } catch (err) {
    next(err);
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
    res.json(await buildReport(rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
