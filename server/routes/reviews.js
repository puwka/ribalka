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

router.get('/mine', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select * from public.site_reviews
       where user_id = $1
       order by created_at desc
       limit 200`,
      [req.user.sub]
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
    const review = rows[0];

    const { notifyAdminModeration, notifyOwnerNewReview } = await import(
      '../services/notifyMail.js'
    );
    notifyAdminModeration({
      kindLabel: 'Новый отзыв',
      title: body.target_name || body.base_name || targetId,
      detail: `${authorName} · ${rating}/5 · ${text.slice(0, 200)}`,
      adminPath: '/admin/reviews',
    });

    const { rows: owners } = await pool.query(
      `select owner_id, name from public.bases where id::text = $1 limit 1`,
      [targetId]
    );
    if (owners[0]?.owner_id) {
      notifyOwnerNewReview({
        ownerId: owners[0].owner_id,
        baseTitle: owners[0].name || body.target_name || 'Объект',
        baseId: targetId,
        authorName,
        rating,
        body: text,
      });
    }

    res.status(201).json(mapReview(review));
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reply', requireAuth, async (req, res, next) => {
  try {
    const reply = String(
      req.body?.owner_reply || req.body?.reply || req.body?.text || ''
    ).trim();
    if (!reply) return res.status(400).json({ error: 'Введите текст ответа' });

    const { rows: found } = await pool.query(
      `select * from public.site_reviews where id = $1 limit 1`,
      [req.params.id]
    );
    const review = found[0];
    if (!review) return res.status(404).json({ error: 'Отзыв не найден' });

    const { rows: owned } = await pool.query(
      `select id from public.bases
       where owner_id = $1 and id::text = $2
       limit 1`,
      [req.user.sub, String(review.target_id)]
    );
    if (!owned[0]) {
      return res.status(403).json({ error: 'Отзыв не найден или нет доступа' });
    }

    const { rows } = await pool.query(
      `update public.site_reviews
       set owner_reply = $2,
           owner_replied_at = now(),
           updated_at = now()
       where id = $1
       returning *`,
      [req.params.id, reply]
    );
    res.json(mapReview(rows[0]));
  } catch (err) {
    next(err);
  }
});

/** Author edits own review → back to moderation */
router.patch('/:id/mine', requireAuth, async (req, res, next) => {
  try {
    const { rows: found } = await pool.query(
      `select * from public.site_reviews where id = $1 limit 1`,
      [req.params.id]
    );
    const review = found[0];
    if (!review) return res.status(404).json({ error: 'Отзыв не найден' });
    if (!review.user_id || String(review.user_id) !== String(req.user.sub)) {
      return res.status(403).json({ error: 'Можно редактировать только свой отзыв' });
    }

    const text = String(req.body?.body || req.body?.text || '').trim();
    const rating = Number(req.body?.rating);
    const authorName = String(req.body?.author_name || review.author_name || '').trim();

    if (!text) return res.status(400).json({ error: 'Напишите отзыв' });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Поставьте оценку от 1 до 5' });
    }
    if (!authorName) return res.status(400).json({ error: 'Укажите имя' });

    const { rows } = await pool.query(
      `update public.site_reviews
       set body = $2,
           rating = $3,
           author_name = $4,
           status = 'pending'::public.moderation_status,
           updated_at = now()
       where id = $1
       returning *`,
      [req.params.id, text, rating, authorName]
    );
    const updated = rows[0];

    try {
      const { notifyAdminModeration } = await import('../services/notifyMail.js');
      notifyAdminModeration({
        kindLabel: 'Отзыв изменён — снова на модерации',
        title: updated.target_name || updated.target_id,
        detail: `${authorName} · ${rating}/5 · ${text.slice(0, 200)}`,
        adminPath: '/admin/reviews',
      });
    } catch (err) {
      console.error('[reviews] notify mail', err.message);
    }

    res.json(mapReview(updated));
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

    if (status === 'approved' || status === 'rejected') {
      const review = rows[0];
      const { notifyUserPublication } = await import('../services/notifyMail.js');
      if (review.user_id) {
        notifyUserPublication({
          userId: review.user_id,
          entityTitle: review.target_name || 'Отзыв',
          entityKind: 'review',
          approved: status === 'approved',
          path: review.target_id ? `/waters/${review.target_id}` : '/cabinet',
        });
      }
    }

    res.json(mapReview(rows[0]));
  } catch (err) {
    next(err);
  }
});

export default router;
