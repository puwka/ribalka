import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import {
  sendMail,
  publicSiteUrl,
  passwordResetEmail,
  isMailConfigured,
} from './mail.js';

const TOKEN_TTL_MS = 60 * 60 * 1000;

async function ensureResetTable() {
  await pool.query(`
    create table if not exists public.password_reset_tokens (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references public.users (id) on delete cascade,
      token_hash text not null unique,
      expires_at timestamptz not null,
      used_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);
}

function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

/**
 * Always resolves OK for existing/non-existing emails (anti-enumeration).
 */
export async function requestPasswordReset(emailRaw) {
  await ensureResetTable();
  const email = String(emailRaw || '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    const err = new Error('Укажите корректный email');
    err.status = 400;
    throw err;
  }

  const { rows } = await pool.query(
    `select u.id, u.email, u.status, p.display_name
     from public.users u
     left join public.profiles p on p.user_id = u.id
     where lower(u.email) = $1
     limit 1`,
    [email]
  );
  const user = rows[0];

  // Same response whether or not user exists
  const okPayload = {
    ok: true,
    message:
      'Если аккаунт с таким email есть, мы отправили ссылку для восстановления пароля.',
    mailConfigured: isMailConfigured(),
  };

  if (!user || user.status !== 'active') {
    return okPayload;
  }

  // Invalidate previous unused tokens
  await pool.query(
    `update public.password_reset_tokens
     set used_at = coalesce(used_at, now())
     where user_id = $1 and used_at is null`,
    [user.id]
  );

  const token = randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

  await pool.query(
    `insert into public.password_reset_tokens (user_id, token_hash, expires_at)
     values ($1, $2, $3)`,
    [user.id, tokenHash, expiresAt]
  );

  const resetUrl = `${publicSiteUrl()}/reset-password?token=${encodeURIComponent(token)}`;
  const mail = passwordResetEmail({
    resetUrl,
    displayName: user.display_name,
  });

  try {
    await sendMail({
      to: user.email,
      subject: mail.subject,
      html: mail.html,
      text: mail.text,
    });
  } catch (err) {
    console.error('[password-reset] mail failed', err.message);
    // Still return OK to client; log for ops
  }

  // Local/dev without Resend: surface the link so QA can finish the flow
  if (!isMailConfigured() && process.env.NODE_ENV !== 'production') {
    okPayload.devResetUrl = resetUrl;
    console.info('[password-reset] dev link:', resetUrl);
  }

  return okPayload;
}

export async function resetPasswordWithToken(tokenRaw, newPassword) {
  await ensureResetTable();
  const token = String(tokenRaw || '').trim();
  const password = String(newPassword || '');
  if (!token) {
    const err = new Error('Ссылка недействительна');
    err.status = 400;
    throw err;
  }
  if (password.length < 6) {
    const err = new Error('Пароль должен быть не короче 6 символов');
    err.status = 400;
    throw err;
  }

  const tokenHash = hashToken(token);
  const { rows } = await pool.query(
    `select * from public.password_reset_tokens
     where token_hash = $1
     limit 1`,
    [tokenHash]
  );
  const row = rows[0];
  if (!row || row.used_at || new Date(row.expires_at).getTime() <= Date.now()) {
    const err = new Error('Ссылка устарела или уже использована. Запросите новую.');
    err.status = 400;
    throw err;
  }

  const hash = await bcrypt.hash(password, 12);
  await pool.query('begin');
  try {
    await pool.query(`update public.users set password_hash = $2 where id = $1`, [
      row.user_id,
      hash,
    ]);
    await pool.query(
      `update public.password_reset_tokens set used_at = now() where id = $1`,
      [row.id]
    );
    await pool.query(
      `update public.password_reset_tokens
       set used_at = coalesce(used_at, now())
       where user_id = $1 and used_at is null`,
      [row.user_id]
    );
    await pool.query('commit');
  } catch (err) {
    await pool.query('rollback');
    throw err;
  }

  return { ok: true, message: 'Пароль обновлён. Можно войти.' };
}
