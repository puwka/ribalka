import { socialDb, CONTENT_STATUS } from '../lib/socialDb';
import { supabase, supabaseDataEnabled } from '../lib/supabase';
import { unwrap } from '../lib/apiError';
import { mapReportToUi } from '../lib/mappers';
import { ApiError } from '../lib/apiError';
import { assertAdmin } from '../lib/assertAdmin';
import { gamificationService } from './gamificationService';
import { notificationService } from './notificationService';
import { engagementDb } from '../lib/engagementDb';

const REPORT_SELECT = `
  *,
  report_images ( id, storage_path, external_url, provider, sort_order ),
  report_videos ( id, storage_path, external_url, provider, sort_order )
`;

function isRemoteReports() {
  return supabaseDataEnabled && Boolean(supabase);
}

function voterKey(userId, anonId) {
  return userId ? String(userId) : anonId ? `anon:${anonId}` : null;
}

function avgStars(report) {
  if (!report.starCount) return 0;
  return Math.round((report.starSum / report.starCount) * 10) / 10;
}

function localShapeFromRemote(row, rels = {}) {
  const ui = mapReportToUi(row, rels);
  return {
    id: String(row.id),
    author: ui.author,
    authorUserId: row.user_id || null,
    place: ui.place,
    baseId: row.base_id ? String(row.base_id) : null,
    baseName: null,
    date: ui.date,
    fish: ui.fish,
    bait: ui.bait,
    weight: ui.weight,
    description: ui.description,
    extra: '',
    images: ui.images,
    videos: ui.videos,
    rating: ui.rating || 0,
    likedBy: [],
    starSum: 0,
    starCount: 0,
    starBy: {},
    comments: ui.comments || [],
    status: row.status || CONTENT_STATUS.PENDING,
    moderationNote: row.moderation_note || null,
    moderatedAt: row.moderated_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    _source: 'supabase',
  };
}

function enrichRemoteRow(row) {
  const images = (row.report_images ?? []).map((img) => img.external_url || img.storage_path).filter(Boolean);
  const videos = (row.report_videos ?? []).map((vid) => vid.external_url || vid.storage_path).filter(Boolean);
  return localShapeFromRemote(row, {
    images: images.map((url, i) => ({ external_url: url, sort_order: i })),
    videos: videos.map((url, i) => ({ external_url: url, sort_order: i })),
    comments: [],
    votedBy: [],
  });
}

function publicReport(report, viewerKey) {
  if (!report) return null;
  const likedBy = Array.isArray(report.likedBy) ? report.likedBy : [];
  return {
    ...report,
    rating: likedBy.length,
    likedBy,
    starAvg: avgStars(report),
    hasLiked: viewerKey ? likedBy.includes(viewerKey) : false,
    myStar: viewerKey && report.starBy ? report.starBy[viewerKey] || 0 : 0,
    comments: (report.comments || []).filter((c) => c.status !== 'hidden' && c.status !== 'rejected'),
  };
}

async function getRemoteReport(id) {
  if (!isRemoteReports()) return null;
  const key = String(id);
  try {
    let row = unwrap(
      await supabase.from('fishing_reports').select('*').eq('id', key).maybeSingle()
    );
    if (!row) return null;

    try {
      const withMedia = unwrap(
        await supabase.from('fishing_reports').select(REPORT_SELECT).eq('id', key).maybeSingle()
      );
      if (withMedia) row = withMedia;
    } catch {
      /* use row without nested media */
    }

    return enrichRemoteRow(row);
  } catch {
    return null;
  }
}

async function listRemoteReports({ status } = {}) {
  if (!isRemoteReports()) return [];
  try {
    let query = supabase.from('fishing_reports').select(REPORT_SELECT).order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);
    const rows = unwrap(await query);
    return (rows ?? []).map(enrichRemoteRow);
  } catch {
    return [];
  }
}

async function updateRemoteStatus(reportId, status, note) {
  if (!isRemoteReports()) return false;
  try {
    unwrap(
      await supabase
        .from('fishing_reports')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('id', reportId)
    );
    return true;
  } catch (err) {
    throw new ApiError(err.message || 'Не удалось обновить отчёт в базе');
  }
}

function reportTimestamp(row) {
  return String(row?.moderatedAt || row?.updatedAt || row?.createdAt || '');
}

/** Prefer the copy with the latest moderation/update timestamp (local CMS wins ties). */
function mergeReportPair(a, b) {
  const left = { ...a, id: String(a.id) };
  const right = { ...b, id: String(b.id) };
  if (reportTimestamp(left) >= reportTimestamp(right)) {
    return { ...right, ...left, id: String(left.id) };
  }
  return { ...left, ...right, id: String(right.id) };
}

function mergeReports(localRows, remoteRows) {
  const byId = new Map();
  for (const row of localRows) {
    byId.set(String(row.id), { ...row, id: String(row.id) });
  }
  for (const row of remoteRows) {
    const key = String(row.id);
    const prev = byId.get(key);
    byId.set(key, prev ? mergeReportPair(prev, row) : { ...row, id: key });
  }
  return Array.from(byId.values());
}

async function resolveReport(id) {
  const key = String(id);
  if (!key) return null;

  const local = await socialDb.getReport(key);
  const remote = await getRemoteReport(key);
  if (local || remote) {
    const row =
      local && remote ? mergeReportPair(local, remote) : { ...(local || remote), id: key };
    return row;
  }

  const allLocal = await socialDb.listReports();
  const fromLocal = allLocal.find((r) => String(r.id) === key);
  if (fromLocal) return { ...fromLocal, id: key };

  const allRemote = await listRemoteReports({ status: 'all' });
  const fromRemote = allRemote.find((r) => String(r.id) === key);
  if (fromRemote) return { ...fromRemote, id: key };

  return null;
}

export const reportSocialService = {
  statuses: CONTENT_STATUS,

  async list({ status = 'approved', sortBy = 'date', viewerKey = null, includeAll = false } = {}) {
    const localRows = await socialDb.listReports();
    const remoteRows = isRemoteReports()
      ? await listRemoteReports({ status: includeAll ? 'all' : status })
      : [];
    let rows = mergeReports(localRows, remoteRows);

    if (!includeAll) {
      rows = rows.filter((r) => r.status === status);
    } else if (status !== 'all') {
      rows = rows.filter((r) => r.status === status);
    }

    const mapped = rows.map((r) => publicReport(r, viewerKey));
    if (sortBy === 'rating') {
      mapped.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.starAvg || 0) - (a.starAvg || 0));
    } else if (sortBy === 'comments') {
      mapped.sort((a, b) => (b.comments?.length || 0) - (a.comments?.length || 0));
    } else if (sortBy === 'stars') {
      mapped.sort((a, b) => (b.starAvg || 0) - (a.starAvg || 0));
    } else {
      mapped.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    }
    return mapped;
  },

  async get(id, { viewerKey = null, isAdmin = false, authorUserId = null, allowPending = false } = {}) {
    const row = await resolveReport(id);
    if (!row) throw new ApiError('Отчёт не найден', { status: 404 });

    const isAuthor =
      authorUserId && row.authorUserId != null && String(row.authorUserId) === String(authorUserId);
    const canViewPending = isAdmin || allowPending || isAuthor;

    if (!canViewPending && row.status !== CONTENT_STATUS.APPROVED) {
      throw new ApiError('Отчёт недоступен', { status: 404 });
    }
    return publicReport(row, viewerKey);
  },

  /** Admin/moderation lookup — always returns pending reports when they exist */
  async getForModeration(id) {
    const row = await resolveReport(id);
    if (!row) throw new ApiError('Отчёт не найден', { status: 404 });
    return publicReport(row, null);
  },

  async listByAuthor(authorUserId, { viewerKey = null } = {}) {
    const rows = await this.list({ status: CONTENT_STATUS.APPROVED, viewerKey });
    return rows
      .filter((r) => r.authorUserId === authorUserId)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  async create(payload) {
    const {
      author,
      authorUserId = null,
      place,
      baseId = null,
      baseName = null,
      date,
      fish,
      bait = '',
      weight = '',
      description,
      extra = '',
      images = [],
      videos = [],
      requireAuth = false,
    } = payload;

    if (requireAuth && !authorUserId) throw new ApiError('Войдите, чтобы опубликовать отчёт');
    if (!author?.trim()) throw new ApiError('Укажите имя');
    if (!place?.trim() && !baseId) throw new ApiError('Укажите место');
    if (!fish?.trim()) throw new ApiError('Укажите улов');
    if (!description?.trim()) throw new ApiError('Добавьте описание');
    if (images.length > 5) throw new ApiError('Максимум 5 фото');
    if (videos.length > 2) throw new ApiError('Максимум 2 видео');

    const report = {
      id: crypto.randomUUID(),
      author: author.trim(),
      authorUserId,
      place: (baseName || place || '').trim(),
      baseId: baseId ? String(baseId) : null,
      baseName: baseName || null,
      date: date || new Date().toISOString().slice(0, 10),
      fish: fish.trim(),
      bait: bait.trim(),
      weight: weight.trim(),
      description: description.trim(),
      extra: (extra || '').trim(),
      images,
      videos,
      rating: 0,
      likedBy: [],
      starSum: 0,
      starCount: 0,
      starBy: {},
      comments: [],
      status: CONTENT_STATUS.PENDING,
      moderationNote: null,
      moderatedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (isRemoteReports() && authorUserId) {
      try {
        const inserted = unwrap(
          await supabase
            .from('fishing_reports')
            .insert({
              user_id: authorUserId,
              author_name: report.author,
              base_id: baseId || null,
              place_name: report.place,
              trip_date: report.date,
              fish_caught: report.fish,
              bait: report.bait,
              weight_label: report.weight,
              description: report.description,
              status: CONTENT_STATUS.PENDING,
            })
            .select('*')
            .single()
        );
        report.id = inserted.id;
        report._source = 'supabase';

        const imageRows = images
          .filter((url) => url && !String(url).startsWith('data:'))
          .map((url, i) => ({
            report_id: inserted.id,
            external_url: url,
            provider: 'external',
            sort_order: i,
          }));
        if (imageRows.length) {
          unwrap(await supabase.from('report_images').insert(imageRows));
        }

        const videoRows = videos.map((url, i) => ({
          report_id: inserted.id,
          external_url: url,
          provider: 'youtube',
          sort_order: i,
        }));
        if (videoRows.length) {
          unwrap(await supabase.from('report_videos').insert(videoRows));
        }
      } catch (err) {
        console.warn('Supabase report insert failed, saving locally:', err.message);
      }
    }

    await socialDb.putReport(report);

    try {
      if (authorUserId) {
        await gamificationService.onReportCreated(authorUserId);
        notificationService.notifyReport(
          authorUserId,
          'Отчёт отправлен на модерацию',
          `«${report.place}» появится после проверки администратором`,
          `/reports/${report.id}`
        );
      }
    } catch {
      /* optional */
    }

    return publicReport(report, null);
  },

  async like(id, { userId = null, anonId = null }) {
    const key = voterKey(userId, anonId);
    if (!key) throw new ApiError('Не удалось определить голосующего');
    const row = (await socialDb.getReport(id)) || (await getRemoteReport(id));
    if (!row || row.status !== CONTENT_STATUS.APPROVED) throw new ApiError('Отчёт не найден');
    const likedBy = Array.isArray(row.likedBy) ? [...row.likedBy] : [];
    if (likedBy.includes(key)) {
      return { success: false, message: 'Вы уже поставили лайк', report: publicReport(row, key) };
    }
    likedBy.push(key);
    row.likedBy = likedBy;
    row.rating = likedBy.length;
    await socialDb.putReport(row);
    try {
      if (userId) await gamificationService.onLikeGiven(userId);
      if (row.authorUserId) await gamificationService.onLikeReceived(row.authorUserId);
    } catch {
      /* optional */
    }
    return { success: true, message: 'Лайк учтён', report: publicReport(row, key) };
  },

  async rateStars(id, stars, { userId = null, anonId = null }) {
    const key = voterKey(userId, anonId);
    if (!key) throw new ApiError('Войдите или обновите страницу');
    const value = Number(stars);
    if (!Number.isFinite(value) || value < 1 || value > 5) {
      throw new ApiError('Оценка должна быть от 1 до 5');
    }
    const row = (await socialDb.getReport(id)) || (await getRemoteReport(id));
    if (!row || row.status !== CONTENT_STATUS.APPROVED) throw new ApiError('Отчёт не найден');
    const starBy = { ...(row.starBy || {}) };
    const prev = starBy[key];
    if (prev) {
      row.starSum = (row.starSum || 0) - prev + value;
    } else {
      row.starSum = (row.starSum || 0) + value;
      row.starCount = (row.starCount || 0) + 1;
    }
    starBy[key] = value;
    row.starBy = starBy;
    await socialDb.putReport(row);
    return publicReport(row, key);
  },

  async addComment(id, { author, authorUserId = null, text, parentId = null }) {
    if (!author?.trim() || !text?.trim()) throw new ApiError('Заполните имя и текст');
    const row = (await socialDb.getReport(id)) || (await getRemoteReport(id));
    if (!row || row.status !== CONTENT_STATUS.APPROVED) throw new ApiError('Отчёт не найден');
    const comment = {
      id: crypto.randomUUID(),
      author: author.trim(),
      authorUserId,
      text: text.trim(),
      date: new Date().toISOString(),
      parentId: parentId != null ? String(parentId) : null,
      status: CONTENT_STATUS.APPROVED,
    };
    row.comments = [...(row.comments || []), comment];
    await socialDb.putReport(row);
    try {
      if (authorUserId) await gamificationService.onCommentCreated(authorUserId);
    } catch {
      /* optional */
    }
    return { comment, report: publicReport(row, null) };
  },

  async moderate(adminId, reportId, { action, note = '' }) {
    await assertAdmin(adminId);

    const row = await resolveReport(reportId);
    if (!row) throw new ApiError('Отчёт не найден');

    if (action === 'approve') row.status = CONTENT_STATUS.APPROVED;
    else if (action === 'reject') row.status = CONTENT_STATUS.REJECTED;
    else if (action === 'hide') row.status = CONTENT_STATUS.HIDDEN;
    else if (action === 'pending') row.status = CONTENT_STATUS.PENDING;
    else throw new ApiError('Неизвестное действие');

    row.moderationNote = note || null;
    row.moderatedAt = new Date().toISOString();
    row.updatedAt = row.moderatedAt;

    if (isRemoteReports()) {
      try {
        await updateRemoteStatus(String(reportId), row.status, note);
      } catch {
        /* report exists only locally — local status is source of truth */
      }
    }
    await socialDb.putReport({ ...row, id: String(row.id) });

    try {
      if (row.authorUserId) {
        notificationService.notify(row.authorUserId, {
          type: 'moderation',
          title: `Отчёт: ${row.status}`,
          body: note || 'Статус изменён администратором',
          link_path: row.status === 'approved' ? `/reports/${row.id}` : '/reports',
        });
      }
    } catch {
      /* optional */
    }

    if (action === 'approve') {
      try {
        await notificationService.notifyFavoritePlaceOwnersAboutReport(row, {
          listFavoritesByTarget: (targetId) => engagementDb.listByTarget(targetId),
        });
      } catch {
        /* optional */
      }
    }
    return row;
  },

  async listForModeration(status = 'pending') {
    const localRows = await socialDb.listReports();
    const remoteRows = await listRemoteReports({ status });
    const merged = mergeReports(localRows, remoteRows);
    const filtered = status === 'all' ? merged : merged.filter((r) => r.status === status);
    return filtered.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },
};
