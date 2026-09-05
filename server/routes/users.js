import { Router } from 'express';
import { pool } from '../db.js';
import { authMiddleware, requireAuth, requireAdmin } from '../middleware/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', requireAuth, requireAdmin, async (_req, res, next) => {
  try {
    const { rows } = await pool.query(
      `select u.id, u.email, u.primary_role, u.status, u.created_at, u.last_seen_at,
              p.display_name, p.phone, p.city,
              coalesce(
                (select array_agg(r.code order by r.code)
                 from public.user_roles ur
                 join public.roles r on r.id = ur.role_id
                 where ur.user_id = u.id),
                array[u.primary_role]::text[]
              ) as roles
       from public.users u
       left join public.profiles p on p.user_id = u.id
       where u.status <> 'deleted'
       order by u.created_at desc
       limit 500`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/status', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!['active', 'blocked', 'deleted'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const { rows } = await pool.query(
      `update public.users set status = $2, updated_at = now()
       where id = $1 returning id, email, status`,
      [req.params.id, status]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
