/**
 * Aggregated money stats for admin dashboard.
 * Includes listing bases, directory, sidebar ads, and project donations.
 */
import { pool } from '../db.js';
import { ensureDonationsTable } from './donations.js';

async function safeQuery(sql, params = []) {
  try {
    return await pool.query(sql, params);
  } catch (err) {
    console.warn('[moneySummary]', err.message);
    return { rows: [{ c: 0, s: 0 }] };
  }
}

export async function getAdminMoneySummary() {
  await ensureDonationsTable().catch(() => {});

  const [listing, directory, donations, ads] = await Promise.all([
    safeQuery(`
      select count(*)::int as c, coalesce(sum(amount), 0)::float as s
      from public.listing_orders
      where status = 'paid'
    `),
    safeQuery(`
      select count(*)::int as c, coalesce(sum(amount), 0)::float as s
      from public.directory_listing_orders
      where status = 'paid'
    `),
    safeQuery(`
      select count(*)::int as c, coalesce(sum(amount), 0)::float as s
      from public.project_donations
      where status = 'succeeded'
    `),
    // Ads: payment rows linked to sidebar (succeeded, or still pending but ad already paid_at)
    safeQuery(`
      select count(*)::int as c, coalesce(sum(p.amount), 0)::float as s
      from public.payments p
      where (
          coalesce(p.meta->>'kind', '') in ('sidebar_ad', 'sidebar_ad_renew')
          or (p.meta ? 'ad_id' and coalesce(p.meta->>'kind', '') not in ('donate'))
        )
        and (
          p.status = 'succeeded'
          or (
            p.status = 'pending'
            and exists (
              select 1 from public.advertising a
              where a.id::text = p.meta->>'ad_id'
                and a.paid_at is not null
            )
          )
        )
    `),
  ]);

  const breakdown = {
    listing: {
      count: Number(listing.rows[0]?.c) || 0,
      total: Number(listing.rows[0]?.s) || 0,
    },
    directory: {
      count: Number(directory.rows[0]?.c) || 0,
      total: Number(directory.rows[0]?.s) || 0,
    },
    ads: {
      count: Number(ads.rows[0]?.c) || 0,
      total: Number(ads.rows[0]?.s) || 0,
    },
    donations: {
      count: Number(donations.rows[0]?.c) || 0,
      total: Number(donations.rows[0]?.s) || 0,
    },
  };

  const paymentsTotal =
    breakdown.listing.count +
    breakdown.directory.count +
    breakdown.ads.count +
    breakdown.donations.count;
  const revenue =
    breakdown.listing.total +
    breakdown.directory.total +
    breakdown.ads.total +
    breakdown.donations.total;

  return { paymentsTotal, revenue, breakdown };
}
