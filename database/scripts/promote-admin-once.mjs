#!/usr/bin/env node
/**
 * Promote existing user to admin (no password change), or create admin if missing.
 * Usage: node database/scripts/promote-admin-once.mjs email@example.com
 */
import 'dotenv/config';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID, randomBytes } from 'node:crypto';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node database/scripts/promote-admin-once.mjs email@example.com');
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function main() {
  await client.connect();
  const existing = await client.query(
    'select id, email, primary_role, status from public.users where lower(email) = lower($1)',
    [email]
  );

  if (existing.rows[0]) {
    const id = existing.rows[0].id;
    await client.query(
      `update public.users set primary_role = 'admin', status = 'active', updated_at = now() where id = $1`,
      [id]
    );
    await client.query(
      `insert into public.user_roles (user_id, role_id)
       select $1, r.id from public.roles r where r.code = 'admin'
       on conflict do nothing`,
      [id]
    );
    console.log(`Promoted to admin (password unchanged): ${email}`);
  } else {
    const id = randomUUID();
    const password = randomBytes(9).toString('base64url');
    const hash = await bcrypt.hash(password, 12);
    const code = id.replace(/-/g, '').slice(0, 10).toLowerCase();
    await client.query(
      `insert into public.users (id, email, password_hash, primary_role, status, referral_code)
       values ($1, $2, $3, 'admin', 'active', $4)`,
      [id, email, hash, code]
    );
    await client.query(`insert into public.profiles (user_id, display_name) values ($1, $2)`, [
      id,
      'Администратор',
    ]);
    await client.query(
      `insert into public.user_roles (user_id, role_id)
       select $1, r.id from public.roles r where r.code in ('user', 'admin')`,
      [id]
    );
    console.log(`Created admin: ${email}`);
    console.log(`Temporary password: ${password}`);
    console.log('Change it after first login.');
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
