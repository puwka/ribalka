/**
 * Supabase Edge Function stub: send-email
 *
 * Deploy later as supabase/functions/send-email/index.ts
 * Env: RESEND_API_KEY, EMAIL_FROM
 *
 * Pseudocode:
 *   1. Auth with service role
 *   2. Select email_outbox where status = 'queued' limit 20
 *   3. For each: render template from payload.campaign, POST Resend
 *   4. Mark sent / failed
 *
 * Cron (pg_cron or GitHub Action):
 *   - Mondays 07:00 → weeklyDigest
 *   - Daily 06:00 → biteForecast
 *   - On base approve → newBases
 *   - On news publish → news
 */

export const SEND_EMAIL_EDGE_STUB = {
  name: 'send-email',
  provider: 'resend',
  endpoint: '/functions/v1/send-email',
};
