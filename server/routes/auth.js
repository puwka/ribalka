import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { pool } from '../db.js';
import { signToken, authMiddleware, requireAuth } from '../middleware/auth.js';

const router = Router();

async function loadUserBundle(userId) {
  const userRes = await pool.query('select * from public.users where id = $1', [userId]);
  const user = userRes.rows[0];
  if (!user) return null;

  const profileRes = await pool.query('select * from public.profiles where user_id = $1', [userId]);
  const rolesRes = await pool.query(
    `select r.code from public.user_roles ur
     join public.roles r on r.id = ur.role_id
     where ur.user_id = $1`,
    [userId]
  );
  const notifRes = await pool.query(
    `select * from public.notifications where user_id = $1 order by created_at desc limit 50`,
    [userId]
  );

  const roles = Array.from(
    new Set([user.primary_role, ...rolesRes.rows.map((r) => r.code)].filter(Boolean))
  );

  return {
    user,
    profile: profileRes.rows[0] || null,
    roles,
    isAdmin: roles.includes('admin'),
    isOwner: roles.includes('owner') || roles.includes('admin'),
    notifications: notifRes.rows,
  };
}

router.post('/register', async (req, res, next) => {
  try {
    const { email, password, displayName, role = 'user' } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const safeRole = role === 'owner' ? 'owner' : 'user';
    const hash = await bcrypt.hash(password, 12);
    const id = randomUUID();
    const code = id.replace(/-/g, '').slice(0, 10).toLowerCase();
    const name = displayName || email.split('@')[0] || 'Рыболов';

    await pool.query('begin');
    await pool.query(
      `insert into public.users (id, email, password_hash, primary_role, referral_code)
       values ($1, $2, $3, $4, $5)`,
      [id, email.toLowerCase(), hash, safeRole, code]
    );
    await pool.query(`insert into public.profiles (user_id, display_name) values ($1, $2)`, [id, name]);
    await pool.query(
      `insert into public.user_roles (user_id, role_id)
       select $1, r.id from public.roles r where r.code = 'user'`,
      [id]
    );
    if (safeRole === 'owner') {
      await pool.query(
        `insert into public.user_roles (user_id, role_id)
         select $1, r.id from public.roles r where r.code = 'owner'
         on conflict do nothing`,
        [id]
      );
    }
    await pool.query('commit');

    const bundle = await loadUserBundle(id);
    const token = signToken({ sub: id, roles: bundle.roles });
    res.status(201).json({ token, ...bundle });
  } catch (err) {
    await pool.query('rollback').catch(() => {});
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }
    const { rows } = await pool.query('select * from public.users where lower(email) = lower($1)', [email]);
    const user = rows[0];
    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const ok = await bcrypt.compare(password, user.password_hash || '');
    if (!ok) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const bundle = await loadUserBundle(user.id);
    const token = signToken({ sub: user.id, roles: bundle.roles });
    res.json({ token, ...bundle });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authMiddleware, requireAuth, async (req, res, next) => {
  try {
    const bundle = await loadUserBundle(req.user.sub);
    if (!bundle) return res.status(404).json({ error: 'User not found' });
    res.json(bundle);
  } catch (err) {
    next(err);
  }
});

router.patch('/profile', authMiddleware, requireAuth, async (req, res, next) => {
  try {
    const { display_name, bio, phone, city, is_public } = req.body || {};
    await pool.query(
      `update public.profiles set
        display_name = coalesce($2, display_name),
        bio = coalesce($3, bio),
        phone = coalesce($4, phone),
        city = coalesce($5, city),
        is_public = coalesce($6, is_public),
        updated_at = now()
       where user_id = $1`,
      [req.user.sub, display_name, bio, phone, city, is_public]
    );
    const bundle = await loadUserBundle(req.user.sub);
    res.json(bundle);
  } catch (err) {
    next(err);
  }
});

export default router;
