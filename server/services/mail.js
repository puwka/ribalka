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
    'Aktiv59 <noreply@aktiv59.ru>'
  );
}

/** Safe for logs / health — no secrets */
export function fromAddressForLog() {
  const raw = fromAddress();
  const m = String(raw).match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim();
}

export function publicSiteUrl() {
  return String(process.env.PUBLIC_SITE_URL || 'http://localhost:5173').replace(/\/$/, '');
}

/** Admin inbox for moderation alerts */
export function adminNotifyEmail() {
  return String(
    process.env.ADMIN_NOTIFY_EMAIL || 'mokrushinmix@yandex.ru'
  )
    .trim()
    .toLowerCase();
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
    console.log('[mail:dev] RESEND_API_KEY не задан — письмо не отправлено', {
      to: recipient,
      subject,
      text: text || html?.slice(0, 200),
    });
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
    console.error('[mail] Resend error', res.status, data, {
      from: fromAddress(),
      to: recipient,
      subject,
    });
    const err = new Error(data?.message || data?.error || `Resend HTTP ${res.status}`);
    err.status = 502;
    err.details = data;
    throw err;
  }
  console.log('[mail] sent', { id: data?.id, to: recipient, subject });
  return data;
}

/** Never throws — safe to fire-and-forget from routes. */
export async function sendMailSafe(opts) {
  try {
    return await sendMail(opts);
  } catch (err) {
    console.error('[mail] send failed', err.message);
    return null;
  }
}

export async function sendAdminMail({ subject, html, text }) {
  return sendMailSafe({ to: adminNotifyEmail(), subject, html, text });
}

function wrapHtml(body) {
  return `
    <div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#0f172a;max-width:560px">
      ${body}
      <p style="margin-top:28px;color:#94a3b8;font-size:12px">Рыбалка Прикамье · автоматическое уведомление</p>
    </div>
  `;
}

function cta(href, label) {
  return `<p><a href="${escapeAttr(href)}" style="display:inline-block;padding:12px 18px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:8px">${escapeHtml(label)}</a></p>`;
}

export function passwordResetEmail({ resetUrl, displayName }) {
  const name = displayName || 'пользователь';
  const subject = 'Восстановление пароля — Рыбалка Прикамье';
  const text = `Здравствуйте, ${name}!\n\nЧтобы задать новый пароль, откройте ссылку (действует 1 час):\n${resetUrl}\n\nЕсли вы не запрашивали сброс — просто проигнорируйте это письмо.`;
  const html = wrapHtml(`
    <p>Здравствуйте, ${escapeHtml(name)}!</p>
    <p>Чтобы задать новый пароль, нажмите кнопку ниже. Ссылка действует <strong>1 час</strong>.</p>
    ${cta(resetUrl, 'Восстановить пароль')}
    <p style="color:#64748b;font-size:13px">Или скопируйте ссылку:<br/>${escapeHtml(resetUrl)}</p>
    <p style="color:#64748b;font-size:13px">Если вы не запрашивали сброс — проигнорируйте это письмо.</p>
  `);
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
  const html = wrapHtml(`
    <p>Здравствуйте, ${escapeHtml(name)}!</p>
    <p>${escapeHtml(when)}: <strong>${escapeHtml(entityTitle)}</strong>.</p>
    ${cta(renewUrl, 'Продлить размещение')}
  `);
  return { subject, html, text };
}

/** Admin: something needs moderation */
export function adminModerationEmail({ kindLabel, title, detail, adminUrl }) {
  const subject = `Модерация: ${kindLabel} — ${title}`;
  const text = `${kindLabel} ждёт проверки.\n\n${title}\n${detail || ''}\n\nОткрыть: ${adminUrl}`;
  const html = wrapHtml(`
    <p><strong>${escapeHtml(kindLabel)}</strong> ждёт проверки.</p>
    <p><strong>${escapeHtml(title)}</strong></p>
    ${detail ? `<p style="color:#475569">${escapeHtml(detail)}</p>` : ''}
    ${cta(adminUrl, 'Открыть в админке')}
  `);
  return { subject, html, text };
}

/** Owner/user: content published or rejected */
export function publicationEmail({ displayName, entityTitle, entityKind, approved, note, siteUrl }) {
  const name = displayName || 'пользователь';
  const kindRu =
    entityKind === 'directory'
      ? 'карточка справочника'
      : entityKind === 'report'
        ? 'отчёт'
        : entityKind === 'comment'
          ? 'комментарий'
          : entityKind === 'review'
            ? 'отзыв'
            : entityKind === 'ad'
              ? 'реклама'
              : 'база / водоём';
  const subject = approved
    ? `Опубликовано: «${entityTitle}»`
    : `Отклонено: «${entityTitle}»`;
  const lead = approved
    ? `Ваша ${kindRu} «${entityTitle}» опубликована на сайте.`
    : `Ваша ${kindRu} «${entityTitle}» отклонена модератором.`;
  const text = `Здравствуйте, ${name}!\n\n${lead}${note ? `\nКомментарий: ${note}` : ''}\n\n${siteUrl}`;
  const html = wrapHtml(`
    <p>Здравствуйте, ${escapeHtml(name)}!</p>
    <p>${escapeHtml(lead)}</p>
    ${note ? `<p style="color:#64748b">Комментарий модератора: ${escapeHtml(note)}</p>` : ''}
    ${cta(siteUrl, approved ? 'Смотреть на сайте' : 'Открыть кабинет')}
  `);
  return { subject, html, text };
}

/** Owner: placement paid / sent to moderation */
export function placementEmail({ displayName, entityTitle, entityKind, pending, paidUntilLabel, cabinetUrl }) {
  const name = displayName || 'владелец';
  const kindRu =
    entityKind === 'directory'
      ? 'карточки в справочнике'
      : entityKind === 'ad'
        ? 'рекламного баннера'
        : 'базы';
  const subject = pending
    ? entityKind === 'ad'
      ? `Баннер «${entityTitle}» оплачен — на модерации`
      : `Размещение «${entityTitle}» оплачено — на модерации`
    : entityKind === 'ad'
      ? `Баннер «${entityTitle}» оплачен`
      : `Размещение «${entityTitle}» оплачено`;
  const lead = pending
    ? `Оплата ${kindRu} «${entityTitle}» прошла успешно. Заявка отправлена на модерацию.`
    : `Оплата ${kindRu} «${entityTitle}» прошла успешно.${paidUntilLabel ? ` Размещение до ${paidUntilLabel}.` : ''}`;
  const text = `Здравствуйте, ${name}!\n\n${lead}\n\nКабинет: ${cabinetUrl}`;
  const html = wrapHtml(`
    <p>Здравствуйте, ${escapeHtml(name)}!</p>
    <p>${escapeHtml(lead)}</p>
    ${cta(cabinetUrl, 'Открыть кабинет')}
  `);
  return { subject, html, text };
}

/** User: banner sent/resubmitted to moderation (no payment wording) */
export function adModerationEmail({ displayName, title, days, surface, cabinetUrl }) {
  const name = displayName || 'пользователь';
  const where = surface === 'forum' ? 'форуме' : 'новостях';
  const d = Math.max(1, Number(days) || 1);
  const subject = `Баннер «${title}» на модерации`;
  const lead = `Ваш рекламный баннер «${title}» отправлен на модерацию (${d} сут., раздел: ${where}). После проверки он появится на сайте.`;
  const text = `Здравствуйте, ${name}!\n\n${lead}\n\nКабинет: ${cabinetUrl}`;
  const html = wrapHtml(`
    <p>Здравствуйте, ${escapeHtml(name)}!</p>
    <p>${escapeHtml(lead)}</p>
    ${cta(cabinetUrl, 'Открыть кабинет')}
  `);
  return { subject, html, text };
}

/** Owner: new review on their base (pending or published) */
export function ownerReviewEmail({ displayName, baseTitle, authorName, rating, body, siteUrl }) {
  const name = displayName || 'владелец';
  const subject = `Новый отзыв о «${baseTitle}»`;
  const text = `Здравствуйте, ${name}!\n\nНовый отзыв (${rating}/5) от ${authorName} о «${baseTitle}»:\n${body}\n\n${siteUrl}`;
  const html = wrapHtml(`
    <p>Здравствуйте, ${escapeHtml(name)}!</p>
    <p>Новый отзыв (<strong>${Number(rating)}/5</strong>) от ${escapeHtml(authorName)} о <strong>${escapeHtml(baseTitle)}</strong>:</p>
    <blockquote style="margin:12px 0;padding:12px;background:#f8fafc;border-left:3px solid #94a3b8">${escapeHtml(body)}</blockquote>
    ${cta(siteUrl, 'Открыть карточку')}
  `);
  return { subject, html, text };
}

/** Report author: new comment on their report */
export function reportCommentEmail({ displayName, reportTitle, authorName, body, reportUrl, pending }) {
  const name = displayName || 'пользователь';
  const title = reportTitle || 'ваш отчёт';
  const subject = `Новый комментарий к отчёту «${title}»`;
  const lead = pending
    ? `К вашему отчёту «${title}» оставили комментарий. После проверки модератором он появится на странице.`
    : `К вашему отчёту «${title}» появился новый комментарий.`;
  const text = `Здравствуйте, ${name}!\n\n${lead}\n\n${authorName}:\n${body}\n\n${reportUrl}`;
  const html = wrapHtml(`
    <p>Здравствуйте, ${escapeHtml(name)}!</p>
    <p>${escapeHtml(lead)}</p>
    <p><strong>${escapeHtml(authorName)}</strong>:</p>
    <blockquote style="margin:12px 0;padding:12px;background:#f8fafc;border-left:3px solid #94a3b8">${escapeHtml(body)}</blockquote>
    ${cta(reportUrl, 'Открыть отчёт')}
  `);
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
