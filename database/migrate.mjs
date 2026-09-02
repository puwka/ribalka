#!/usr/bin/env node
/**
 * Apply SQL migrations to PostgreSQL (standalone, no Supabase CLI).
 *
 * Usage:
 *   DATABASE_URL=postgresql://user:pass@localhost:5432/rybalka node database/migrate.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function ensureMigrationsTable() {
  await client.query(`
    create table if not exists public.schema_migrations (
      id serial primary key,
      filename text not null unique,
      applied_at timestamptz not null default now()
    );
  `);
}

async function appliedFiles() {
  const { rows } = await client.query('select filename from public.schema_migrations order by filename');
  return new Set(rows.map((r) => r.filename));
}

async function applyMigration(filename, sql) {
  await client.query('begin');
  try {
    await client.query(sql);
    await client.query('insert into public.schema_migrations (filename) values ($1)', [filename]);
    await client.query('commit');
    console.log(`✓ ${filename}`);
  } catch (err) {
    await client.query('rollback');
    throw err;
  }
}

async function main() {
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  await client.connect();
  await ensureMigrationsTable();
  const done = await appliedFiles();

  let count = 0;
  for (const file of files) {
    if (done.has(file)) {
      console.log(`· ${file} (skip)`);
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    await applyMigration(file, sql);
    count += 1;
  }

  await client.end();
  console.log(count ? `Applied ${count} migration(s).` : 'Database is up to date.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
