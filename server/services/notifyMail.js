/**
 * Fire-and-forget email notifications for moderation / publication / reviews.
 */
import { pool } from '../db.js';
import * as mail from './mail.js';

async function loadUserContact(userId) {
  if (!userId) return null;
  const { rows } = await pool.query(
    `select u.id, u.email, p.display_name
     from public.users u
     left join public.profiles p on p.user_id = u.id
     where u.id = $1 and u.status <> 'deleted'
     limit 1`,
    [userId]
  );
  return rows[0] || null;
}

function site() {
  return mail.publicSiteUrl();
}

/** @param {() => Promise<void>} fn */
function run(fn) {
  Promise.resolve()
    .then(fn)
    .catch((err) => console.error('[notifyMail]', err.message));
}

export function notifyAdminModeration({ kindLabel, title, detail, adminPath }) {
  run(async () => {
    const adminUrl = `${site()}${adminPath.startsWith('/') ? adminPath : `/${adminPath}`}`;
    const tpl = mail.adminModerationEmail({ kindLabel, title, detail, adminUrl });
    await mail.sendAdminMail(tpl);
  });
}

export function notifyUserPublication({
  userId,
  entityTitle,
  entityKind,
  approved,
  note,
  path,
}) {
  run(async () => {
    const user = await loadUserContact(userId);
    if (!user?.email) return;
    const siteUrl = `${site()}${path?.startsWith('/') ? path : `/${path || ''}`}`;
    const tpl = mail.publicationEmail({
      displayName: user.display_name,
      entityTitle,
      entityKind,
      approved,
      note,
      siteUrl,
    });
    await mail.sendMailSafe({ to: user.email, ...tpl });
  });
}

export function notifyUserPlacement({
  userId,
  entityTitle,
  entityKind,
  pending,
  paidUntilLabel,
  cabinetPath,
}) {
  run(async () => {
    const user = await loadUserContact(userId);
    if (!user?.email) return;
    const cabinetUrl = `${site()}${cabinetPath?.startsWith('/') ? cabinetPath : `/${cabinetPath || '/owner'}`}`;
    const tpl = mail.placementEmail({
      displayName: user.display_name,
      entityTitle,
      entityKind,
      pending,
      paidUntilLabel,
      cabinetUrl,
    });
    await mail.sendMailSafe({ to: user.email, ...tpl });
  });
}

/** User: banner went to moderation (after pay or re-edit) */
export function notifyUserAdModeration({ userId, title, days, surface }) {
  run(async () => {
    const user = await loadUserContact(userId);
    if (!user?.email) return;
    const tpl = mail.adModerationEmail({
      displayName: user.display_name,
      title,
      days,
      surface,
      cabinetUrl: `${site()}/cabinet/advertising`,
    });
    await mail.sendMailSafe({ to: user.email, ...tpl });
  });
}

export function notifyOwnerNewReview({
  ownerId,
  baseTitle,
  baseId,
  authorName,
  rating,
  body,
}) {
  run(async () => {
    const user = await loadUserContact(ownerId);
    if (!user?.email) return;
    const tpl = mail.ownerReviewEmail({
      displayName: user.display_name,
      baseTitle,
      authorName,
      rating,
      body,
      siteUrl: `${site()}/waters/${baseId}`,
    });
    await mail.sendMailSafe({ to: user.email, ...tpl });
  });
}

/**
 * Email + in-app notice for report author when someone comments.
 * Skips if commenter is the report author.
 */
export function notifyReportAuthorNewComment({
  reportAuthorId,
  commenterUserId,
  reportId,
  reportTitle,
  authorName,
  body,
  pending = true,
}) {
  if (!reportAuthorId) return;
  if (commenterUserId && String(reportAuthorId) === String(commenterUserId)) return;

  run(async () => {
    const user = await loadUserContact(reportAuthorId);
    if (!user) return;

    const reportUrl = `${site()}/reports/${reportId}`;
    const title = reportTitle || 'Отчёт';

    try {
      await pool.query(
        `insert into public.notifications (user_id, type, title, body, link_path, payload)
         values ($1, 'comment', $2, $3, $4, $5::jsonb)`,
        [
          reportAuthorId,
          'Новый комментарий к отчёту',
          `${authorName || 'Рыболов'}: ${(body || '').slice(0, 160)}`,
          `/reports/${reportId}`,
          JSON.stringify({ report_id: reportId, kind: 'report_comment' }),
        ]
      );
    } catch (err) {
      console.error('[notifyMail] in-app comment notice', err.message);
    }

    if (!user.email) return;
    const tpl = mail.reportCommentEmail({
      displayName: user.display_name,
      reportTitle: title,
      authorName: authorName || 'Рыболов',
      body: body || '',
      reportUrl,
      pending,
    });
    await mail.sendMailSafe({ to: user.email, ...tpl });
  });
}

/**
 * When CMS directory page is saved, email owners whose items became published.
 */
export function notifyDirectoryPublishTransitions(prevValue, nextValue) {
  run(async () => {
    const prevItems = Array.isArray(prevValue?.items) ? prevValue.items : [];
    const nextItems = Array.isArray(nextValue?.items) ? nextValue.items : [];
    const prevById = new Map(prevItems.map((i) => [String(i.id), i]));

    for (const item of nextItems) {
      if (!item?.id || !item.ownerUserId) continue;
      const prev = prevById.get(String(item.id));
      const wasPending = !prev || prev.status === 'pending' || prev.status === 'draft';
      const nowPublished = item.status === 'published' || item.status === 'approved';
      const nowRejected = item.status === 'rejected';
      if (wasPending && nowPublished) {
        notifyUserPublication({
          userId: item.ownerUserId,
          entityTitle: item.name || 'Карточка',
          entityKind: 'directory',
          approved: true,
          path: '/owner/directory',
        });
      } else if (prev && prev.status !== 'rejected' && nowRejected) {
        notifyUserPublication({
          userId: item.ownerUserId,
          entityTitle: item.name || 'Карточка',
          entityKind: 'directory',
          approved: false,
          path: '/owner/directory',
        });
      }
    }
  });
}
