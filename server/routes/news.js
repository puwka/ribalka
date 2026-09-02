import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select * from public.news where status = 'published' order by published_at desc nulls last, created_at desc`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`select * from public.news where id = $1`, [req.params.id]);
    const row = rows[0];
    if (!row || (row.status !== 'published' && row.status !== 'approved')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(row);
  } catch (err) {
    next(err);
  }
});

export default router;
