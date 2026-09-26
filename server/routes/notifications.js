import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.patch('/:id/read', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `update public.notifications
       set is_read = true
       where id = $1 and user_id = $2
       returning *`,
      [req.params.id, req.user.sub]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/read-all', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      `update public.notifications set is_read = true
       where user_id = $1 and is_read = false`,
      [req.user.sub]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      `delete from public.notifications where id = $1 and user_id = $2`,
      [req.params.id, req.user.sub]
    );
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/clear-read', requireAuth, async (req, res, next) => {
  try {
    await pool.query(
      `delete from public.notifications where user_id = $1 and is_read = true`,
      [req.user.sub]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
