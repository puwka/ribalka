import { catalogStats, getCatalogUiList } from '../lib/catalogSeed';
import { api, apiDataEnabled } from '../lib/apiClient';
import { cmsDb } from '../lib/cmsDb';
import { DIRECTORY_PAGE_DEFAULTS } from '../data/directorySeed';

const CACHE_KEY = 'rybalka_home_stats_v2';
const CACHE_TTL_MS = 5 * 60 * 1000;

function seedStats() {
  const seed = catalogStats();
  return {
    paid: seed.paid,
    free: seed.free,
    total: seed.total,
    shops: 0,
    services: 0,
    guides: 0,
  };
}

function countDirectoryItems(items) {
  const now = Date.now();
  const published = (items || []).filter((i) => {
    if ((i.status || 'published') !== 'published') return false;
    if (i.paidUntil && new Date(i.paidUntil).getTime() <= now) return false;
    return true;
  });
  return {
    shops: published.filter((i) => i.category === 'shop').length,
    services: published.filter((i) => i.category === 'service').length,
    guides: published.filter((i) => i.category === 'guide').length,
  };
}

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.stats || !parsed?.at) return null;
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.stats;
  } catch {
    return null;
  }
}

function writeCache(stats) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), stats }));
  } catch {
    /* ignore */
  }
}

async function loadDirectoryCounts() {
  try {
    const local = await cmsDb.getKv('page:directory');
    if (local && Array.isArray(local.items)) {
      return countDirectoryItems(local.items);
    }
  } catch {
    /* fall through */
  }

  if (!apiDataEnabled) {
    return countDirectoryItems(DIRECTORY_PAGE_DEFAULTS.items);
  }

  try {
    const remote = await api.get(`/api/cms/kv?key=${encodeURIComponent('page:directory')}`);
    const value = remote?.value ?? remote;
    const items = Array.isArray(value?.items) ? value.items : [];
    if (items.length) {
      void cmsDb.setKv('page:directory', value).catch(() => {});
    }
    return countDirectoryItems(items);
  } catch {
    return countDirectoryItems(DIRECTORY_PAGE_DEFAULTS.items);
  }
}

async function loadWaterCounts() {
  const seed = catalogStats();
  if (!apiDataEnabled) return seed;

  try {
    const rows = await api.get('/api/bases');
    const catalogIds = new Set(getCatalogUiList().map((i) => String(i.id)));
    let extraPaid = 0;
    let extraFree = 0;
    for (const row of rows || []) {
      if (catalogIds.has(String(row.id))) continue;
      if (row.type === 'free') extraFree += 1;
      else extraPaid += 1;
    }
    return {
      paid: seed.paid + extraPaid,
      free: seed.free + extraFree,
      total: seed.total + extraPaid + extraFree,
    };
  } catch {
    return seed;
  }
}

/** Instant value for first paint (cache or seed). */
export function getHomeStatsSync() {
  return readCache() || seedStats();
}

/** Refresh home hero counts without heavy catalog merges. */
export async function loadHomeStats() {
  const [waters, directory] = await Promise.all([loadWaterCounts(), loadDirectoryCounts()]);
  const stats = {
    paid: waters.paid,
    free: waters.free,
    total: waters.total,
    shops: directory.shops,
    services: directory.services,
    guides: directory.guides,
  };
  writeCache(stats);
  return stats;
}
