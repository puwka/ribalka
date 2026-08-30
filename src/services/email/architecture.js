/**
 * Architecture notes for production email delivery.
 *
 * Flow:
 * 1. App / cron calls digestBuilder.* → notificationService.queueEmail / emailOutbox.enqueue
 * 2. Worker (Supabase Edge Function `send-email`) reads outbox (DB table preferred) and sends via Resend/SMTP
 * 3. Respect user notificationSettings.email.* flags
 *
 * Suggested SQL (apply later):
 *   create table public.email_outbox (
 *     id uuid primary key default gen_random_uuid(),
 *     user_id uuid references public.users(id),
 *     campaign text not null,
 *     payload jsonb not null default '{}',
 *     status text not null default 'queued',
 *     attempts int not null default 0,
 *     last_error text,
 *     created_at timestamptz default now(),
 *     sent_at timestamptz
 *   );
 *
 * Env (server-only):
 *   RESEND_API_KEY / SMTP_* / EMAIL_FROM
 */

export const EMAIL_ARCHITECTURE = {
  provider: 'resend_or_smtp',
  edgeFunction: 'send-email',
  campaigns: ['weeklyDigest', 'newBases', 'biteForecast', 'news'],
  cronHints: {
    weeklyDigest: '0 7 * * 1',
    biteForecast: '0 6 * * *',
    newBases: 'on base approve',
    news: 'on news publish',
  },
};
