import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

function mapReview(row) {
  return {
    id: String(row.id),
    base_id: row.target_id,
    target_id: row.target_id,
    target_name: row.target_name || null,
    owner_id: null,
    user_id: row.user_id,
    author_name: row.author_name,
    body: row.body,
    rating: row.rating,
    status: row.status,
    owner_reply: row.owner_reply,
    owner_replied_at: row.owner_replied_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const targetId = req.query.targetId || req.query.baseId;
    if (!targetId) return res.status(400).json({ error: 'targetId required' });
    const { rows } = await pool.query(
      `select * from public.site_reviews
       where target_id = $1 and status = 'approved'
       order by created_at desc`,
      [String(targetId)]
    );
    res.json(rows.map(mapReview));
  } catch (err) {
    next(err);
  }
});

router.get('/moderation', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = req.query.status || 'all';
    const { rows } = await pool.query(
      status === 'all'
        ? `select * from public.site_reviews order by created_at desc limit 300`
        : `select * from public.site_reviews where status = $1::public.moderation_status order by created_at desc limit 300`,
      status === 'all' ? [] : [status]
    );
    res.json(rows.map(mapReview));
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const targetId = String(body.target_id || body.base_id || '').trim();
    const authorName = String(body.author_name || body.name || '').trim();
    const text = String(body.body || body.text || '').trim();
    const rating = Number(body.rating);
    if (!targetId) return res.status(400).json({ error: 'Укажите водоём' });
    if (!authorName) return res.status(400).json({ error: 'Укажите имя' });
    if (!text) return res.status(400).json({ error: 'Напишите отзыв' });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Поставьте оценку от 1 до 5' });
    }

    const { rows } = await pool.query(
      `insert into public.site_reviews
         (target_id, target_name, user_id, author_name, body, rating, status)
       values ($1,$2,$3,$4,$5,$6,'pending')
       returning *`,
      [
        targetId,
        body.target_name || body.base_name || null,
        req.user?.sub || null,
        authorName,
        text,
        rating,
      ]
    );
    res.status(201).json(mapReview(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!['approved', 'rejected', 'hidden', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await pool.query(
      `update public.site_reviews set status = $2::public.moderation_status, updated_at = now()
       where id = $1 returning *`,
      [req.params.id, status]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(mapReview(rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
