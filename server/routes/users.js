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
                (select array_agg(r.code::text order by r.code)
                 from public.user_roles ur
                 join public.roles r on r.id = ur.role_id
                 where ur.user_id = u.id),
                array[u.primary_role::text]
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

/**
 * Public author profile for /u/:id
 * Admins and the owner see full data even if is_public=false.
 */
router.get('/:id/public', async (req, res, next) => {
  try {
    const targetId = req.params.id;
    const viewerId = req.user?.sub || null;
    const viewerRoles = req.user?.roles || [];
    const isAdmin = viewerRoles.includes('admin');
    const isSelf = viewerId && String(viewerId) === String(targetId);

    const { rows } = await pool.query(
      `select u.id, u.email, u.primary_role, u.status, u.created_at,
              p.display_name, p.bio, p.city, p.phone, p.is_public, p.avatar_path
       from public.users u
       left join public.profiles p on p.user_id = u.id
       where u.id = $1 and u.status <> 'deleted'`,
      [targetId]
    );
    const row = rows[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (row.status === 'blocked' && !isAdmin) {
      return res.status(404).json({ error: 'Not found' });
    }

    const isPublic = row.is_public !== false;
    const canSeePrivate = isAdmin || isSelf || isPublic;
    const displayName =
      row.display_name ||
      (row.email ? String(row.email).split('@')[0] : 'Рыболов');

    if (!canSeePrivate) {
      return res.json({
        user_id: row.id,
        display_name: displayName,
        bio: '',
        city: '',
        phone: '',
        is_public: false,
        primary_role: row.primary_role,
        created_at: row.created_at,
        avatar_url: null,
      });
    }

    res.json({
      user_id: row.id,
      display_name: displayName,
      bio: row.bio || '',
      city: row.city || '',
      phone: isPublic || isAdmin || isSelf ? row.phone || '' : '',
      is_public: isPublic,
      primary_role: row.primary_role,
      created_at: row.created_at,
      avatar_url: row.avatar_path || null,
      email: isAdmin || isSelf ? row.email : undefined,
      status: isAdmin ? row.status : undefined,
    });
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

const ALLOWED_ROLES = new Set(['user', 'owner', 'admin']);

/**
 * Change primary role and sync user_roles junction.
 * Always keeps base `user` role; adds owner/admin when selected.
 */
router.patch('/:id/role', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const role = String(req.body?.role || req.body?.primary_role || '')
      .trim()
      .toLowerCase();
    if (!ALLOWED_ROLES.has(role)) {
      return res.status(400).json({ error: 'Роль: user, owner или admin' });
    }

    const targetId = req.params.id;
    if (String(targetId) === String(req.user.sub) && role !== 'admin') {
      return res.status(400).json({ error: 'Нельзя снять роль admin у себя' });
    }

    const existing = await pool.query(
      `select id, email, primary_role from public.users where id = $1 and status <> 'deleted'`,
      [targetId]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Not found' });

    await pool.query(
      `update public.users set primary_role = $2::public.app_role, updated_at = now() where id = $1`,
      [targetId, role]
    );

    // Drop elevated roles, then re-add what we need
    await pool.query(
      `delete from public.user_roles ur
       using public.roles r
       where ur.role_id = r.id
         and ur.user_id = $1
         and r.code in ('owner', 'admin')`,
      [targetId]
    );

    await pool.query(
      `insert into public.user_roles (user_id, role_id)
       select $1, r.id from public.roles r where r.code = 'user'
       on conflict do nothing`,
      [targetId]
    );

    if (role === 'owner' || role === 'admin') {
      await pool.query(
        `insert into public.user_roles (user_id, role_id)
         select $1, r.id from public.roles r where r.code = $2
         on conflict do nothing`,
        [targetId, role]
      );
    }

    // Admin also gets owner capabilities in local auth model; keep optional owner for admin
    if (role === 'admin') {
      await pool.query(
        `insert into public.user_roles (user_id, role_id)
         select $1, r.id from public.roles r where r.code = 'owner'
         on conflict do nothing`,
        [targetId]
      );
    }

    const { rows } = await pool.query(
      `select u.id, u.email, u.primary_role, u.status,
              coalesce(
                (select array_agg(r.code::text order by r.code)
                 from public.user_roles ur
                 join public.roles r on r.id = ur.role_id
                 where ur.user_id = u.id),
                array[u.primary_role::text]
              ) as roles
       from public.users u
       where u.id = $1`,
      [targetId]
    );
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

export default router;
