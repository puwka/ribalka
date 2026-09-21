/**
 * Project support (donate) persistence + admin stats.
 */
import { pool } from '../db.js';
import * as yookassa from './yookassa.js';

let ensured = false;

export async function ensureDonationsTable() {
  if (ensured) return;
  await pool.query(`
    create table if not exists public.project_donations (
      id uuid primary key default gen_random_uuid(),
      user_id uuid references public.users (id) on delete set null,
      email text,
      amount numeric(12, 2) not null,
      currency char(3) not null default 'RUB',
      status text not null default 'pending'
        check (status in ('pending', 'succeeded', 'canceled')),
      provider text not null default 'yookassa',
      provider_payment_id text,
      confirmation_url text,
      meta jsonb not null default '{}'::jsonb,
      paid_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `);
  await pool.query(`
    create unique index if not exists project_donations_provider_payment_uidx
      on public.project_donations (provider_payment_id)
      where provider_payment_id is not null
  `);
  await pool.query(`
    create index if not exists project_donations_status_created_idx
      on public.project_donations (status, created_at desc)
  `);
  ensured = true;
}

function mapDonation(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    email: row.email,
    amount: Number(row.amount) || 0,
    currency: row.currency || 'RUB',
    status: row.status,
    providerPaymentId: row.provider_payment_id,
    confirmationUrl: row.confirmation_url,
    paidAt: row.paid_at,
    createdAt: row.created_at,
    meta: row.meta || {},
  };
}

export async function recordDonationPending({
  userId = null,
  email,
  amount,
  currency = 'RUB',
  providerPaymentId,
  confirmationUrl,
  meta = {},
}) {
  await ensureDonationsTable();
  const { rows } = await pool.query(
    `insert into public.project_donations
      (user_id, email, amount, currency, status, provider, provider_payment_id, confirmation_url, meta)
     values ($1, $2, $3, $4, 'pending', 'yookassa', $5, $6, $7::jsonb)
     on conflict (provider_payment_id) where (provider_payment_id is not null)
     do update set
       updated_at = now(),
       confirmation_url = coalesce(excluded.confirmation_url, public.project_donations.confirmation_url)
     returning *`,
    [
      userId || null,
      String(email || '').trim().toLowerCase() || null,
      amount,
      currency,
      providerPaymentId,
      confirmationUrl || null,
      JSON.stringify(meta),
    ]
  );
  return mapDonation(rows[0]);
}

export async function markDonationSucceededByPaymentId(providerPaymentId, payment = null) {
  await ensureDonationsTable();
  if (!providerPaymentId) return null;
  const { rows } = await pool.query(
    `update public.project_donations
        set status = 'succeeded',
            paid_at = coalesce(paid_at, now()),
            updated_at = now(),
            meta = case
              when $2::jsonb is null then meta
              else meta || $2::jsonb
            end
      where provider = 'yookassa'
        and provider_payment_id = $1
      returning *`,
    [
      providerPaymentId,
      payment
        ? JSON.stringify({
            yookassa_status: payment.status,
            paid: Boolean(payment.paid),
          })
        : null,
    ]
  );
  return mapDonation(rows[0]);
}

export async function markDonationCanceledByPaymentId(providerPaymentId) {
  await ensureDonationsTable();
  if (!providerPaymentId) return null;
  const { rows } = await pool.query(
    `update public.project_donations
        set status = 'canceled', updated_at = now()
      where provider = 'yookassa'
        and provider_payment_id = $1
        and status = 'pending'
      returning *`,
    [providerPaymentId]
  );
  return mapDonation(rows[0]);
}

export async function findDonationByPaymentId(providerPaymentId) {
  await ensureDonationsTable();
  if (!providerPaymentId) return null;
  const { rows } = await pool.query(
    `select * from public.project_donations
     where provider = 'yookassa' and provider_payment_id = $1
     limit 1`,
    [providerPaymentId]
  );
  return mapDonation(rows[0]);
}

/** Re-check pending rows against YooKassa (webhook may be delayed). */
export async function syncPendingDonations({ limit = 40 } = {}) {
  await ensureDonationsTable();
  if (!yookassa.isYooKassaConfigured()) return { synced: 0 };
  const { rows } = await pool.query(
    `select provider_payment_id from public.project_donations
     where status = 'pending' and provider_payment_id is not null
     order by created_at desc
     limit $1`,
    [limit]
  );
  let synced = 0;
  for (const row of rows) {
    try {
      const payment = await yookassa.getPayment(row.provider_payment_id);
      if (payment?.status === 'succeeded' && payment.paid) {
        await markDonationSucceededByPaymentId(row.provider_payment_id, payment);
        synced += 1;
      } else if (payment?.status === 'canceled') {
        await markDonationCanceledByPaymentId(row.provider_payment_id);
      }
    } catch (err) {
      console.warn('[donations] sync failed', row.provider_payment_id, err.message);
    }
  }
  return { synced };
}

export async function getDonationStats() {
  await ensureDonationsTable();
  await syncPendingDonations().catch(() => {});

  const { rows: summaryRows } = await pool.query(`
    select
      count(*) filter (where status = 'succeeded')::int as paid_count,
      coalesce(sum(amount) filter (where status = 'succeeded'), 0)::float as paid_total,
      count(*) filter (where status = 'pending')::int as pending_count,
      count(distinct lower(email)) filter (where status = 'succeeded' and email is not null)::int as unique_emails
    from public.project_donations
  `);

  const { rows } = await pool.query(`
    select d.*, u.email as user_email
    from public.project_donations d
    left join public.users u on u.id = d.user_id
    order by
      case d.status when 'succeeded' then 0 when 'pending' then 1 else 2 end,
      coalesce(d.paid_at, d.created_at) desc
    limit 200
  `);

  const summary = summaryRows[0] || {};
  return {
    summary: {
      paidCount: Number(summary.paid_count) || 0,
      paidTotal: Number(summary.paid_total) || 0,
      pendingCount: Number(summary.pending_count) || 0,
      uniqueEmails: Number(summary.unique_emails) || 0,
    },
    items: rows.map((r) => ({
      ...mapDonation(r),
      email: r.email || r.user_email || null,
    })),
  };
}
