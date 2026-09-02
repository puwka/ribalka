import pg from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.warn('[db] DATABASE_URL is not set — server will fail on queries');
}

export const pool = new pg.Pool({
  connectionString,
  max: 20,
});
