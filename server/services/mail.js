/**
 * Transactional email via Resend HTTP API (no extra deps).
 * If RESEND_API_KEY is missing, logs to console (dev-safe).
 */

const RESEND_URL = 'https://api.resend.com/emails';

export function isMailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && String(process.env.RESEND_API_KEY).trim());
}

function fromAddress() {
  return (
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    'Рыбалка Прикамье <onboarding@resend.dev>'
  );
}

export function publicSiteUrl() {
  return String(process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
}

/**
 * @param {{ to: string, subject: string, html: string, text?: string }} opts
 */
export async function sendMail({ to, subject, html, text }) {
  const recipient = String(to || '').trim().toLowerCase();
  if (!recipient) {
    const err = new Error('Email получателя не указан');
    err.status = 400;
    throw err;
  }

  if (!isMailConfigured()) {
    console.log('[mail:dev]', { to: recipient, subject, text: text || html?.slice(0, 200) });
    return { id: 'dev-log', mocked: true };
  }

  const res = await fetch(RESEND_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromAddress(),
      to: [recipient],
      subject,
      html,
      text: text || undefined,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data?.message || data?.error || `Resend HTTP ${res.status}`);
    err.status = 502;
    err.details = data;
    throw err;
  }
  return data;
}

export function passwordResetEmail({ resetUrl, displayName }) {
  const name = displayName || 'пользователь';
  const subject = 'Восстановление пароля — Рыбалка Прикамье';
  const text = `Здравствуйте, ${name}!\n\nЧтобы задать новый пароль, откройте ссылку (действует 1 час):\n${resetUrl}\n\nЕсли вы не запрашивали сброс — просто проигнорируйте это письмо.`;
  const html = `
    <p>Здравствуйте, ${escapeHtml(name)}!</p>
    <p>Чтобы задать новый пароль, нажмите кнопку ниже. Ссылка действует <strong>1 час</strong>.</p>
    <p><a href="${escapeAttr(resetUrl)}" style="display:inline-block;padding:12px 18px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px">Восстановить пароль</a></p>
    <p style="color:#64748b;font-size:13px">Или скопируйте ссылку:<br/>${escapeHtml(resetUrl)}</p>
    <p style="color:#64748b;font-size:13px">Если вы не запрашивали сброс — проигнорируйте это письмо.</p>
  `;
  return { subject, html, text };
}

export function paymentReminderEmail({
  displayName,
  entityTitle,
  entityKind,
  paidUntilLabel,
  daysLeft,
  renewUrl,
}) {
  const name = displayName || 'владелец';
  const kindRu =
    entityKind === 'directory' ? 'карточки в справочнике' : 'размещения базы';
  let when;
  if (daysLeft < 0) when = `срок ${kindRu} истёк ${paidUntilLabel}`;
  else if (daysLeft === 0) when = `срок ${kindRu} истекает сегодня (${paidUntilLabel})`;
  else if (daysLeft === 1) when = `срок ${kindRu} истекает завтра (${paidUntilLabel})`;
  else when = `срок ${kindRu} истекает через ${daysLeft} дн. (${paidUntilLabel})`;

  const subject =
    daysLeft < 0
      ? `Продлите «${entityTitle}» — срок истёк`
      : `Напоминание: продлите «${entityTitle}»`;

  const text = `Здравствуйте, ${name}!\n\n${when}: «${entityTitle}».\nПродлить: ${renewUrl}\n\nРыбалка Прикамье`;
  const html = `
    <p>Здравствуйте, ${escapeHtml(name)}!</p>
    <p>${escapeHtml(when)}: <strong>${escapeHtml(entityTitle)}</strong>.</p>
    <p><a href="${escapeAttr(renewUrl)}" style="display:inline-block;padding:12px 18px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px">Продлить размещение</a></p>
    <p style="color:#64748b;font-size:13px">Письмо отправлено автоматически. Отключить напоминания можно в настройках уведомлений кабинета.</p>
  `;
  return { subject, html, text };
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}
