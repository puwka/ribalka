#!/usr/bin/env node
/**
 * Create admin user in standalone Postgres.
 * Usage: node database/scripts/seed-admin.mjs admin@example.com demo1234
 */
import pg from 'pg';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';

const email = process.argv[2] || 'admin@demo.local';
const password = process.argv[3] || 'demo1234';
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function main() {
  await client.connect();
  const hash = await bcrypt.hash(password, 12);
  const id = randomUUID();
  const code = id.replace(/-/g, '').slice(0, 10).toLowerCase();

  const existing = await client.query('select id from public.users where lower(email) = lower($1)', [email]);
  if (existing.rows[0]) {
    await client.query(
      `update public.users set password_hash = $1, primary_role = 'admin', status = 'active' where id = $2`,
      [hash, existing.rows[0].id]
    );
    await client.query(
      `insert into public.user_roles (user_id, role_id)
       select $1, r.id from public.roles r where r.code = 'admin'
       on conflict do nothing`,
      [existing.rows[0].id]
    );
    console.log(`Updated admin: ${email}`);
  } else {
    await client.query(
      `insert into public.users (id, email, password_hash, primary_role, referral_code)
       values ($1, $2, $3, 'admin', $4)`,
      [id, email, hash, code]
    );
    await client.query(
      `insert into public.profiles (user_id, display_name) values ($1, $2)`,
      [id, 'Администратор']
    );
    await client.query(
      `insert into public.user_roles (user_id, role_id)
       select $1, r.id from public.roles r where r.code in ('user', 'admin')`,
      [id]
    );
    console.log(`Created admin: ${email}`);
  }
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
