import { api, apiDataEnabled } from '../lib/apiClient';
import { unwrap, resolveMediaUrl, ApiError } from '../lib/apiError';
import { mapBaseToUi } from '../lib/mappers';
import { basesLocalDb } from '../lib/basesLocalDb';
import {
  CATALOG_OWNER_ID,
  findCatalogById,
  getCatalogUiList,
} from '../lib/catalogSeed';
import { authService } from './authService';
import { notificationService } from './notificationService';
import { catalogAdminService } from './catalogAdminService';
import { localAuthStore } from '../lib/localAuthStore';

export const BASE_STATUSES = Object.freeze({
  DRAFT: 'draft',
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  ARCHIVED: 'archived',
});

const BASE_SELECT = `
  *,
  base_images ( id, storage_path, external_url, provider, sort_order, is_cover ),
  base_videos ( id, storage_path, external_url, provider, sort_order, title ),
  base_services ( id, name, sort_order )
`;

function isRemoteDb() {
  return apiDataEnabled && authService.mode() === 'api';
}

function nowIso() {
  return new Date().toISOString();
}

function emptyForm() {
  return {
    name: '',
    description: '',
    region: 'Пермский край',
    address: '',
    lat: '',
    lng: '',
    phone: '',
    contacts: '',
    website_url: '',
    social_vk: '',
    social_telegram: '',
    social_max: '',
    social_other: '',
    servicesText: '',
    price_label: '',
    price_from: '',
    conditions: '',
    features: '',
    work_hours: '',
    imagesText: '',
    videosText: '',
    type: 'paid',
    short_description: '',
    fish_species: '',
  };
}

function formToRecord(form, { ownerId, existing }) {
  const lat = form.lat === '' || form.lat == null ? null : Number(form.lat);
  const lng = form.lng === '' || form.lng == null ? null : Number(form.lng);
  const services = String(form.servicesText || '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
  const images = String(form.imagesText || '')
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const videos = String(form.videosText || '')
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    id: existing?.id,
    owner_id: ownerId,
    type: form.type || 'paid',
    status: existing?.status || BASE_STATUSES.DRAFT,
    name: form.name.trim(),
    short_description:
      (form.short_description || form.description || '').trim().slice(0, 180),
    description: form.description.trim(),
    region: form.region.trim(),
    address: form.address.trim(),
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    phone: form.phone.trim(),
    contacts: form.contacts.trim(),
    website_url: form.website_url.trim() || null,
    social_links: {
      vk: form.social_vk.trim() || null,
      telegram: form.social_telegram.trim() || null,
      max: form.social_max.trim() || null,
      other: form.social_other.trim() || null,
    },
    price_label: form.price_label.trim() || null,
    price_from:
      form.price_from === '' || form.price_from == null
        ? null
        : Number(form.price_from),
    fish_species: (form.fish_species || '').trim() || null,
    conditions: form.conditions.trim() || null,
    features: form.features.trim() || null,
    work_hours: form.work_hours.trim() || null,
    services,
    images,
    videos,
    rejection_reason: existing?.rejection_reason ?? null,
    submitted_at: existing?.submitted_at ?? null,
    reviewed_at: existing?.reviewed_at ?? null,
    reviewed_by: existing?.reviewed_by ?? null,
    published_at: existing?.published_at ?? null,
    created_at: existing?.created_at || nowIso(),
    updated_at: nowIso(),
  };
}

function mediaUrls(items = []) {
  return items
    .map((item) => {
      if (!item) return '';
      if (typeof item === 'string') return item;
      return item.public_url || item.external_url || item.storage_path || '';
    })
    .filter(Boolean);
}

function recordToForm(record) {
  const social = record.social_links || {};
  const images = mediaUrls(record.images);
  const videos = mediaUrls(record.videos);
  const services = Array.isArray(record.services)
    ? record.services.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
    : [];
  return {
    name: record.name || '',
    description: record.description || '',
    region: record.region || 'Пермский край',
    address: record.address || '',
    lat: record.lat ?? '',
    lng: record.lng ?? '',
    phone: record.phone || '',
    contacts: record.contacts || '',
    website_url: record.website_url || '',
    social_vk: social.vk || '',
    social_telegram: social.telegram || '',
    social_max: social.max || '',
    social_other: social.other || '',
    servicesText: services.join(', '),
    price_label: record.price_label || '',
    price_from: record.price_from ?? '',
    conditions: record.conditions || '',
    features: record.features || '',
    work_hours: record.work_hours || '',
    imagesText: images.join('\n'),
    videosText: videos.join('\n'),
    type: record.type || 'paid',
    short_description: record.short_description || '',
    fish_species: record.fish_species || '',
  };
}

function toUi(record) {
  return mapBaseToUi(
    {
      ...record,
      weather_notes: record.features || record.weather_notes || '',
      how_to_get: record.conditions || record.how_to_get || '',
    },
    {
      images: (record.images || []).map((url, i) => ({
        external_url: url,
        sort_order: i,
        public_url: url,
      })),
      videos: (record.videos || []).map((url, i) => ({
        external_url: url,
        sort_order: i,
        public_url: url,
      })),
      services: (record.services || []).map((name, i) => ({
        name,
        sort_order: i,
      })),
    }
  );
}

function enrichRemote(row) {
  const images = (row.base_images ?? []).map((img) => ({
    ...img,
    public_url: resolveMediaUrl(null, 'base-images', img.storage_path, img.external_url),
  }));
  const videos = (row.base_videos ?? []).map((vid) => ({
    ...vid,
    public_url: resolveMediaUrl(null, 'base-videos', vid.storage_path, vid.external_url),
  }));
  const mapped = mapBaseToUi(row, {
    images,
    videos,
    services: row.base_services ?? [],
  });
  return {
    ...mapped,
    status: row.status,
    region: row.region,
    contacts: row.contacts,
    social_links: row.social_links || {},
    conditions: row.conditions,
    features: row.features,
    rejection_reason: row.rejection_reason,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
    owner_id: row.owner_id,
    price_from: row.price_from,
    updated_at: row.updated_at,
    raw: row,
  };
}

function normalizeModerationRow(row) {
  const ui = row.images?.length && typeof row.images[0] === 'string' ? row : toUi(row);
  return {
    ...row,
    ...ui,
    images: mediaUrls(ui.images || row.images),
    videos: mediaUrls(ui.videos || row.videos),
    services: Array.isArray(row.services)
      ? row.services.map((s) => (typeof s === 'string' ? s : s?.name)).filter(Boolean)
      : ui.services || [],
  };
}

function mergeBasesById(localRows, remoteRows) {
  const map = new Map();
  for (const row of localRows) map.set(String(row.id), normalizeModerationRow(row));
  for (const row of remoteRows) {
    const key = String(row.id);
    const prev = map.get(key);
    map.set(key, normalizeModerationRow(prev ? { ...prev, ...row } : row));
  }
  return Array.from(map.values());
}

async function listLocalForModeration(statusFilter) {
  const all = await basesLocalDb.getAll();
  return all
    .filter((b) => !statusFilter || statusFilter === 'all' || b.status === statusFilter)
    .sort((a, b) =>
      String(b.submitted_at || b.updated_at).localeCompare(String(a.submitted_at || a.updated_at))
    )
    .map((r) => normalizeModerationRow(r));
}

async function listRemoteForModeration(statusFilter) {
  if (!isRemoteDb()) return [];
  try {
    const qs =
      statusFilter && statusFilter !== 'all'
        ? `?status=${encodeURIComponent(statusFilter)}`
        : '?status=all';
    const rows = await api.get(`/api/bases/moderation${qs}`);
    return (rows || []).map((r) => normalizeModerationRow(enrichRemote(r)));
  } catch {
    return [];
  }
}

async function fetchRemoteById(id) {
  if (!isRemoteDb()) return null;
  try {
    const row = await api.get(`/api/bases/${id}`);
    return row ? normalizeModerationRow(enrichRemote(row)) : null;
  } catch {
    return null;
  }
}

function validateForm(form) {
  if (!form.name?.trim()) throw new ApiError('Укажите название базы');
  if (!form.description?.trim()) throw new ApiError('Укажите описание');
  if (!form.address?.trim()) throw new ApiError('Укажите адрес');
  if (!form.phone?.trim()) throw new ApiError('Укажите телефон');
}

async function replaceRemoteMedia() {
  throw new ApiError('Запись медиа баз через API — в следующем обновлении');
}

function remotePayload(record) {
  return {
    owner_id: record.owner_id,
    type: record.type,
    status: record.status,
    name: record.name,
    short_description: record.short_description,
    description: record.description,
    region: record.region,
    address: record.address,
    lat: record.lat,
    lng: record.lng,
    phone: record.phone,
    contacts: record.contacts,
    website_url: record.website_url,
    social_links: record.social_links,
    price_label: record.price_label,
    price_from: record.price_from,
    fish_species: record.fish_species,
    conditions: record.conditions,
    features: record.features,
    work_hours: record.work_hours,
    rejection_reason: record.rejection_reason,
    submitted_at: record.submitted_at,
    reviewed_at: record.reviewed_at,
    reviewed_by: record.reviewed_by,
    published_at: record.published_at,
  };
}

function mergePublicList(catalogItems, ownerItems) {
  const map = new Map();
  for (const item of catalogItems) map.set(String(item.id), item);
  for (const item of ownerItems) {
    if (item.source === 'catalog' || item.owner_id === CATALOG_OWNER_ID) continue;
    map.set(String(item.id), item);
  }
  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, 'ru')
  );
}

export const basesService = {
  emptyForm,
  recordToForm,
  statuses: BASE_STATUSES,

  isRemote: () => isRemoteDb(),

  isEnabled: () => true,

  async listPublic(filters = {}) {
    // Always start from seed catalog, then layer remote/owner bases and CMS overrides.
    // Previously a single approved Supabase row replaced the whole catalog.
    const catalog = getCatalogUiList(filters);

    if (isRemoteDb()) {
      const qs = filters.type ? `?type=${encodeURIComponent(filters.type)}` : '';
      const rows = await api.get(`/api/bases${qs}`);
      const remote = (rows ?? []).map(enrichRemote);
      return catalogAdminService.mergeIntoPublicList(mergePublicList(catalog, remote));
    }

    const rows = await basesLocalDb.listApproved(filters.type);
    const ownerItems = rows
      .filter((r) => r.source !== 'catalog' && r.owner_id !== CATALOG_OWNER_ID)
      .map((r) => ({
        ...toUi(r),
        status: r.status,
        rejection_reason: r.rejection_reason,
        owner_id: r.owner_id,
        price_from: r.price_from,
      }));

    return catalogAdminService.mergeIntoPublicList(mergePublicList(catalog, ownerItems));
  },

  async listMine(ownerId) {
    if (!ownerId) throw new ApiError('Нужна авторизация');

    if (isRemoteDb()) {
      const rows = await api.get('/api/bases/mine');
      return (rows ?? []).map((row) => {
        const ui = enrichRemote(row);
        return {
          ...row,
          ...ui,
          images: ui.images,
          videos: ui.videos,
          services: ui.services,
        };
      });
    }

    const rows = await basesLocalDb.listByOwner(ownerId);
    return rows
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .map((r) => ({ ...r, ...toUi(r) }));
  },

  async listForModeration(statusFilter) {
    const [local, remote] = await Promise.all([
      listLocalForModeration(statusFilter),
      listRemoteForModeration(statusFilter),
    ]);
    return mergeBasesById(local, remote).sort((a, b) =>
      String(b.submitted_at || b.updated_at).localeCompare(String(a.submitted_at || a.updated_at))
    );
  },

  async getById(id, { ownerId, isAdmin } = {}) {
    const remote = await fetchRemoteById(id);
    const local = await basesLocalDb.getById(id);
    const row = remote || (local ? normalizeModerationRow(local) : null);
    if (!row) return null;
    if (
      row.status !== BASE_STATUSES.APPROVED &&
      !isAdmin &&
      row.owner_id !== ownerId
    ) {
      throw new ApiError('Нет доступа к этой базе', { status: 403 });
    }
    return row;
  },

  /** Public catalog detail — catalog seed + approved owner listings + CMS overrides. */
  async getPublic(id) {
    const cmsItem = await catalogAdminService.getById(id);
    if (cmsItem && cmsItem.status !== 'archived') {
      if (cmsItem.source === 'admin' || cmsItem._hasOverride) return cmsItem;
    }

    const catalog = findCatalogById(id);
    try {
      if (isRemoteDb()) {
        const row = await this.getById(id);
        if (row && row.status === BASE_STATUSES.APPROVED) return row;
        return catalog;
      }
      const row = await basesLocalDb.getById(id);
      if (
        row &&
        row.status === BASE_STATUSES.APPROVED &&
        row.source !== 'catalog' &&
        row.owner_id !== CATALOG_OWNER_ID
      ) {
        return { ...row, ...toUi(row) };
      }
    } catch {
      /* fall through to catalog */
    }
    return catalog;
  },

  async saveDraft(ownerId, form, existingId) {
    validateForm(form);
    if (isRemoteDb()) {
      const payload = {
        ...form,
        images: String(form.imagesText || '')
          .split(/\n/)
          .map((s) => s.trim())
          .filter(Boolean),
        videos: String(form.videosText || '')
          .split(/\n/)
          .map((s) => s.trim())
          .filter(Boolean),
        services: String(form.servicesText || '')
          .split(/[,;\n]/)
          .map((s) => s.trim())
          .filter(Boolean),
        social_links: {
          vk: form.social_vk?.trim() || null,
          telegram: form.social_telegram?.trim() || null,
          max: form.social_max?.trim() || null,
          other: form.social_other?.trim() || null,
        },
      };
      const row = existingId
        ? await api.patch(`/api/bases/${existingId}`, payload)
        : await api.post('/api/bases', payload);
      const ui = enrichRemote(row);
      return { ...row, ...ui, images: ui.images, videos: ui.videos, services: ui.services };
    }

    const existing = existingId ? await basesLocalDb.getById(existingId) : null;
    if (existing && existing.owner_id !== ownerId) {
      throw new ApiError('Нет доступа', { status: 403 });
    }
    if (existing && ![BASE_STATUSES.DRAFT, BASE_STATUSES.REJECTED].includes(existing.status)) {
      throw new ApiError('Редактирование доступно только для draft/rejected');
    }

    const record = formToRecord(form, { ownerId, existing });
    record.id = existing?.id || crypto.randomUUID();
    record.status =
      existing?.status === BASE_STATUSES.REJECTED
        ? BASE_STATUSES.REJECTED
        : BASE_STATUSES.DRAFT;
    if (record.status === BASE_STATUSES.DRAFT) {
      record.rejection_reason = null;
    }
    await basesLocalDb.put(record);
    return { ...record, ...toUi(record) };
  },

  /**
   * Start paid placement: navigate to checkout (API) or free submit (local / zero price).
   */
  async startPlacement(ownerId, baseId) {
    if (isRemoteDb()) {
      const { listingPaymentService } = await import('./listingPaymentService.js');
      return listingPaymentService.checkout(baseId);
    }
    return { order: null, localSubmit: true, base: await this.submitForReview(ownerId, baseId) };
  },

  async submitForReview(ownerId, baseId) {
    if (isRemoteDb()) {
      // Remote: payment flow sets status to pending after paid verify
      throw new ApiError('Для размещения базы нужна оплата — откройте экран оплаты');
    }

    const row = await basesLocalDb.getById(baseId);
    if (!row || row.owner_id !== ownerId) throw new ApiError('Нет доступа', { status: 403 });
    if (![BASE_STATUSES.DRAFT, BASE_STATUSES.REJECTED].includes(row.status)) {
      throw new ApiError('На модерацию можно отправить только draft/rejected');
    }
    row.status = BASE_STATUSES.PENDING;
    row.submitted_at = nowIso();
    row.rejection_reason = null;
    row.updated_at = nowIso();
    await basesLocalDb.put(row);
    return { ...row, ...toUi(row) };
  },

  async adminUpdate(adminId, baseId, form) {
    validateForm(form);
    if (isRemoteDb()) {
      throw new ApiError('Редактирование баз через API — в следующем обновлении');
    }

    const existing = await basesLocalDb.getById(baseId);
    if (!existing) throw new ApiError('База не найдена');
    const record = formToRecord(form, { ownerId: existing.owner_id, existing });
    record.id = existing.id;
    record.status = existing.status;
    record.updated_at = nowIso();
    await basesLocalDb.put(record);
    return { ...record, ...toUi(record) };
  },

  async moderate(adminId, baseId, { action, reason, form }) {
    if (form) {
      await this.adminUpdate(adminId, baseId, form);
    }

    if (isRemoteDb()) {
      const row = await api.post(`/api/bases/${baseId}/moderate`, { action, reason });
      return enrichRemote(row);
    }

    const row = await basesLocalDb.getById(baseId);
    if (!row) throw new ApiError('База не найдена');

    if (action === 'approve') {
      row.status = BASE_STATUSES.APPROVED;
      row.published_at = nowIso();
      row.rejection_reason = null;
    } else if (action === 'reject') {
      if (!reason?.trim()) throw new ApiError('Укажите причину отказа');
      row.status = BASE_STATUSES.REJECTED;
      row.rejection_reason = reason.trim();
    } else if (action === 'archive') {
      row.status = BASE_STATUSES.ARCHIVED;
    } else if (action === 'pending') {
      row.status = BASE_STATUSES.PENDING;
      row.submitted_at = nowIso();
    } else {
      throw new ApiError('Неизвестное действие');
    }
    row.reviewed_at = nowIso();
    row.reviewed_by = adminId;
    row.updated_at = nowIso();
    await basesLocalDb.put(row);

    try {
      if (action === 'approve') {
        notificationService.notify(row.owner_id, {
          type: 'moderation',
          title: 'База опубликована',
          body: `«${row.name}» одобрена и доступна на сайте`,
          link_path: '/owner/bases',
        });
        for (const uid of localAuthStore.listUserIds()) {
          if (uid === row.owner_id) continue;
          notificationService.queueEmail(uid, 'newBases', {
            baseId: row.id,
            name: row.name,
          });
        }
      } else if (action === 'reject') {
        notificationService.notify(row.owner_id, {
          type: 'moderation',
          title: 'База отклонена',
          body: reason || row.name,
          link_path: '/owner/bases',
        });
      }
    } catch {
      /* optional */
    }

    return { ...row, ...toUi(row) };
  },

  /** Permanently remove a base listing (admin). Returns true if a row was deleted. */
  async adminDelete(adminId, baseId) {
    if (!adminId) throw new ApiError('Нужна авторизация', { status: 403 });
    const key = String(baseId);

    if (isRemoteDb()) {
      throw new ApiError('Удаление баз через API — в следующем обновлении');
    }

    const existing = await basesLocalDb.getById(key);
    if (!existing) return false;
    await basesLocalDb.delete(key);
    return true;
  },

  // backward-compatible aliases
  async list(filters = {}) {
    return this.listPublic(filters);
  },

  async recordView() {},
  async toggleFavorite() {
    throw new ApiError('Избранное пока недоступно для этой базы');
  },
};
