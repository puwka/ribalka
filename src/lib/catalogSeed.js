/**
 * Original project catalog — src/data/bases.js
 * 20 paid bases + 3 free places (Perm region).
 * Single source for seed / fallback when DB is empty.
 */

import { paidBases, freePlaces } from '../data/bases';
import { mapBaseToUi } from './mappers';
import { resolveCatalogImages } from './catalogImages';

export const CATALOG_OWNER_ID = 'catalog-seed';

function parseCoords(coordsStr) {
  if (!coordsStr) return { lat: null, lng: null };
  const parts = String(coordsStr).split(',').map((s) => parseFloat(s.trim()));
  return {
    lat: Number.isFinite(parts[0]) ? parts[0] : null,
    lng: Number.isFinite(parts[1]) ? parts[1] : null,
  };
}

function extractRegion(address = '') {
  const m = address.match(/Пермский край,\s*([^,]+)/i);
  return m ? m[1].trim() : 'Пермский край';
}

/** DB-shaped record from legacy bases.js item */
export function legacyItemToRecord(item, type) {
  const { lat, lng } = parseCoords(item.coords);
  return {
    id: String(item.id),
    catalog_legacy_id: item.id,
    owner_id: CATALOG_OWNER_ID,
    type,
    status: 'approved',
    source: 'catalog',
    name: item.name,
    short_description: item.short || '',
    description: item.description || '',
    region: extractRegion(item.address),
    address: item.address || '',
    lat,
    lng,
    phone: item.phone || '',
    contacts: '',
    website_url: null,
    social_links: {},
    price_label: item.price || null,
    price_from: null,
    fish_species: item.fish || '',
    conditions: item.howToGet || '',
    features: item.weather || '',
    work_hours: item.workHours || '',
    transport: item.transport || '',
    services: Array.isArray(item.services) ? item.services : [],
    images: resolveCatalogImages(item),
    videos: item.videos || (item.video ? [item.video] : []),
    rejection_reason: null,
    submitted_at: null,
    reviewed_at: null,
    reviewed_by: null,
    published_at: '2024-01-01T00:00:00.000Z',
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-01T00:00:00.000Z',
  };
}

export function getCatalogRecords() {
  return [
    ...paidBases.map((b) => legacyItemToRecord(b, 'paid')),
    ...freePlaces.map((b) => legacyItemToRecord(b, 'free')),
  ];
}

export function recordToUi(record) {
  const ui = mapBaseToUi(
    {
      ...record,
      how_to_get: record.conditions,
      weather_notes: record.features,
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
      services: (record.services || []).map((name, i) => ({ name, sort_order: i })),
    }
  );
  return {
    ...ui,
    status: record.status,
    region: record.region,
    owner_id: record.owner_id,
    ownerId: record.owner_id,
    source: record.source,
    transport: record.transport || '',
    price_from: record.price_from,
  };
}

export function getCatalogUiList(filters = {}) {
  let list = getCatalogRecords().map(recordToUi);
  if (filters.type) list = list.filter((b) => b.type === filters.type);
  return list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
}

export function findCatalogById(id) {
  if (id == null || id === '') return null;
  const needle = String(id);
  const record = getCatalogRecords().find(
    (r) => String(r.id) === needle || String(r.catalog_legacy_id) === needle
  );
  return record ? recordToUi(record) : null;
}

export function catalogStats() {
  const all = getCatalogUiList();
  return {
    total: all.length,
    paid: all.filter((b) => b.type === 'paid').length,
    free: all.filter((b) => b.type === 'free').length,
  };
}
