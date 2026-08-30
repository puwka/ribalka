import { cmsDb } from '../lib/cmsDb';
import { assertAdmin } from '../lib/assertAdmin';
import {
  CATALOG_OWNER_ID,
  getCatalogRecords,
  recordToUi,
  findCatalogById,
} from '../lib/catalogSeed';
import { basesService } from './basesService';
import { auditService } from './auditService';

const WATER_STATUSES = ['published', 'draft', 'archived'];

function emptyWaterForm() {
  return {
    name: '',
    slug: '',
    description: '',
    short_description: '',
    region: 'Пермский край',
    address: '',
    lat: '',
    lng: '',
    type: 'paid',
    price_label: '',
    price_from: '',
    fish_species: '',
    conditions: '',
    features: '',
    work_hours: '',
    rules: '',
    access: '',
    imagesText: '',
    videosText: '',
    seo_title: '',
    seo_description: '',
    status: 'published',
  };
}

function formToRecord(form, existing) {
  const lat = form.lat === '' ? null : Number(form.lat);
  const lng = form.lng === '' ? null : Number(form.lng);
  const images = String(form.imagesText || '')
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const videos = String(form.videosText || '')
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    id: existing?.id || `water-${crypto.randomUUID().slice(0, 8)}`,
    owner_id: CATALOG_OWNER_ID,
    source: 'admin',
    type: form.type || 'paid',
    status: form.status || 'published',
    name: form.name.trim(),
    slug: form.slug?.trim() || form.name.trim().toLowerCase().replace(/\s+/g, '-'),
    short_description: (form.short_description || form.description || '').slice(0, 180),
    description: form.description?.trim() || '',
    region: form.region?.trim() || 'Пермский край',
    address: form.address?.trim() || '',
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    price_label: form.price_label?.trim() || null,
    price_from: form.price_from === '' ? null : Number(form.price_from),
    fish_species: form.fish_species?.trim() || null,
    conditions: form.conditions?.trim() || null,
    features: form.features?.trim() || null,
    work_hours: form.work_hours?.trim() || null,
    rules: form.rules?.trim() || null,
    access: form.access?.trim() || null,
    images,
    videos,
    seo_title: form.seo_title?.trim() || null,
    seo_description: form.seo_description?.trim() || null,
    published_at: existing?.published_at || new Date().toISOString(),
    created_at: existing?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    archived_at: form.status === 'archived' ? new Date().toISOString() : null,
  };
}

function recordToForm(record) {
  return {
    name: record.name || '',
    slug: record.slug || '',
    description: record.description || '',
    short_description: record.short_description || '',
    region: record.region || '',
    address: record.address || '',
    lat: record.lat ?? '',
    lng: record.lng ?? '',
    type: record.type || 'paid',
    price_label: record.price_label || '',
    price_from: record.price_from ?? '',
    fish_species: record.fish_species || '',
    conditions: record.conditions || '',
    features: record.features || '',
    work_hours: record.work_hours || '',
    rules: record.rules || '',
    access: record.access || '',
    imagesText: (record.images || []).join('\n'),
    videosText: (record.videos || []).join('\n'),
    seo_title: record.seo_title || '',
    seo_description: record.seo_description || '',
    status: record.status || 'published',
  };
}

async function getOverridesMap() {
  const overrides = await cmsDb.listWaters();
  return Object.fromEntries(overrides.map((w) => [String(w.id), w]));
}

export const catalogAdminService = {
  statuses: WATER_STATUSES,
  emptyForm: emptyWaterForm,
  recordToForm,

  async listAll(filters = {}) {
    const overrides = await getOverridesMap();
    const hidden = new Set(
      Object.values(overrides)
        .filter((w) => w.status === 'archived' && w._seedHidden)
        .map((w) => String(w.id))
    );

    let items = getCatalogRecords()
      .filter((r) => !hidden.has(String(r.id)))
      .map((r) => {
        const o = overrides[String(r.id)];
        if (o) return { ...r, ...o, _isSeed: true, _hasOverride: true };
        return { ...r, _isSeed: true, _hasOverride: false };
      });

    const adminCreated = Object.values(overrides).filter(
      (w) => w.source === 'admin' && w.status !== 'archived'
    );
    for (const w of adminCreated) {
      if (!items.find((i) => String(i.id) === String(w.id))) {
        items.push(w);
      }
    }

    if (filters.type) items = items.filter((w) => w.type === filters.type);
    if (filters.status) items = items.filter((w) => w.status === filters.status);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      items = items.filter(
        (w) =>
          w.name?.toLowerCase().includes(q) ||
          w.region?.toLowerCase().includes(q) ||
          w.address?.toLowerCase().includes(q)
      );
    }

    return items
      .map((r) => ({ ...r, ...recordToUi(r) }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  },

  async getById(id) {
    const override = await cmsDb.getWater(id);
    if (override) return { ...override, ...recordToUi(override) };

    const seed = findCatalogById(id);
    if (seed) return seed;

    return null;
  },

  async save(adminId, form, existingId, adminName) {
    await assertAdmin(adminId);
    const existing = existingId ? await this.getById(existingId) : null;
    const record = formToRecord(form, existing);

    if (existingId && existing?._isSeed && !existing?._hasOverride) {
      record.id = String(existingId);
      record._seedHidden = false;
    }

    await cmsDb.putWater(record);

    await auditService.log({
      adminId,
      adminName,
      action: existingId ? 'update' : 'create',
      entity: 'water',
      entityId: record.id,
      summary: `${existingId ? 'Обновлён' : 'Создан'} водоём «${record.name}»`,
    });

    return { ...record, ...recordToUi(record) };
  },

  async archive(adminId, id, adminName) {
    await assertAdmin(adminId);
    const existing = await this.getById(id);
    if (!existing) throw new Error('Водоём не найден');

    const record = {
      ...existing,
      status: 'archived',
      archived_at: new Date().toISOString(),
      _seedHidden: Boolean(existing._isSeed || findCatalogById(id)),
    };
    await cmsDb.putWater(record);

    await auditService.log({
      adminId,
      adminName,
      action: 'archive',
      entity: 'water',
      entityId: id,
      summary: `Архивирован водоём «${existing.name}»`,
    });

    return record;
  },

  /** Hard-delete admin-created waters; hide seed catalog entries. */
  async remove(adminId, id, adminName) {
    await assertAdmin(adminId);
    const key = String(id);
    const override = await cmsDb.getWater(key);
    const seed = findCatalogById(key);
    const existing = override || seed;

    if (!existing) {
      const deleted = await basesService.adminDelete(adminId, key);
      if (!deleted) throw new Error('Водоём не найден');
      await auditService.log({
        adminId,
        adminName,
        action: 'delete',
        entity: 'water',
        entityId: key,
        summary: `Удалена база ${key}`,
      });
      return;
    }

    const isAdminCreated =
      Boolean(override) &&
      (override.source === 'admin' || key.startsWith('water-')) &&
      !seed;

    if (isAdminCreated) {
      await cmsDb.deleteWater(key);
    } else {
      await this.archive(adminId, id, adminName);
      return existing;
    }

    try {
      await basesService.adminDelete(adminId, key);
    } catch {
      /* no linked Supabase row */
    }

    await auditService.log({
      adminId,
      adminName,
      action: 'delete',
      entity: 'water',
      entityId: key,
      summary: `Удалён водоём «${existing.name || key}»`,
    });
  },

  async publish(adminId, id, adminName) {
    const existing = await this.getById(id);
    if (!existing) throw new Error('Водоём не найден');
    return this.save(
      adminId,
      { ...recordToForm(existing), status: 'published' },
      id,
      adminName
    );
  },

  /** Merge admin overrides into public catalog list */
  async mergeIntoPublicList(items) {
    const overrides = await getOverridesMap();
    const hidden = new Set(
      Object.values(overrides)
        .filter((w) => w.status === 'archived')
        .map((w) => String(w.id))
    );

    const merged = items
      .filter((item) => !hidden.has(String(item.id)))
      .map((item) => {
        const o = overrides[String(item.id)];
        if (!o || o.status === 'archived') return item;
        const merged = recordToUi({ ...item, ...o });
        const images =
          merged.images?.length > 0
            ? merged.images
            : item.images?.length
              ? item.images
              : merged.images;
        return { ...item, ...merged, images };
      });

    const adminOnly = Object.values(overrides).filter(
      (w) => w.source === 'admin' && w.status === 'published' && !items.find((i) => String(i.id) === String(w.id))
    );

    for (const w of adminOnly) {
      merged.push(recordToUi(w));
    }

    return merged.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  },
};
