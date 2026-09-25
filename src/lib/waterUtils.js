/** Helpers for water catalog filtering, sorting, display */

export const WATER_TYPE = {
  PAID: 'paid',
  PAID_FISHING: 'paid_fishing',
  FREE: 'free',
};

/** Commercial listings that require payment to publish */
export function isCommercialWaterType(type) {
  return type === WATER_TYPE.PAID || type === WATER_TYPE.PAID_FISHING;
}

export function catalogPathForWaterType(type) {
  if (type === WATER_TYPE.FREE) return '/free-waters';
  if (type === WATER_TYPE.PAID_FISHING) return '/paid-fishing';
  return '/paid-waters';
}

/** Yandex Maps placemark options by listing type */
export function mapMarkerOptionsForType(type) {
  if (type === WATER_TYPE.PAID_FISHING) {
    // Dark yellow / gold for paid fishing spots
    return { preset: 'islands#circleDotIcon', iconColor: '#A16207' };
  }
  if (type === WATER_TYPE.PAID) {
    return { preset: 'islands#blueCircleDotIcon' };
  }
  return { preset: 'islands#greenCircleDotIcon' };
}

export function parsePriceValue(priceLabel) {
  if (!priceLabel) return null;
  const m = String(priceLabel).match(/(\d[\d\s]*)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/\s/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function formatPaidPrice(item) {
  const isFishing = item?.type === WATER_TYPE.PAID_FISHING;
  const prefix = isFishing ? 'Рыбалка' : 'Отдых';
  if (item.price) {
    return item.price.startsWith('от') ? `${prefix} ${item.price}` : `${prefix} от ${item.price}`;
  }
  const from = parsePriceValue(item.price_label);
  if (from) return `${prefix} от ${from.toLocaleString('ru-RU')} ₽`;
  return 'Цена не указана';
}

export function extractLocality(address = '') {
  const parts = String(address)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 1];
  if (parts.length >= 2) return parts[1];
  return '';
}

export function inferWaterBodyKind(item) {
  const name = (item.name || '').toLowerCase();
  if (name.includes('пруд') || name.includes('озер')) return 'Пруд/озеро';
  if (name.includes('река') || name.includes('устье')) return 'Река';
  if (name.includes('база')) return 'База отдыха';
  if (name.includes('водоём') || name.includes('водоем')) return 'Водоём';
  if (item.type === WATER_TYPE.FREE || item.type === WATER_TYPE.PAID_FISHING) return 'Водоём';
  return 'База отдыха';
}

/** Filter: object has a fishing water body vs recreation base without water focus */
export function listingHasWater(item) {
  if (item?.hasWater === true || item?.has_water === true) return true;
  if (item?.hasWater === false || item?.has_water === false) return false;

  // Legacy cards without explicit flag — infer from text
  const blob = `${item.name || ''} ${item.short || ''} ${item.description || ''} ${item.fish || ''} ${item.waterKind || ''}`.toLowerCase();
  if (/пруд|озёр|озер|река|водоём|водоем|карьер|стариц|проток/.test(blob)) return true;
  if ((item.fish || '').trim().length > 0) return true;
  if (/база/.test(blob) && !/пруд|озёр|озер|река|водоём|водоем/.test(blob)) return false;
  const kind = item.waterKind || inferWaterBodyKind(item);
  if (kind === 'База отдыха' || kind === 'База') return false;
  return item.type === WATER_TYPE.FREE;
}

export function matchesWaterSearch(item, query) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const locality = extractLocality(item.address);
  return (
    (item.name || '').toLowerCase().includes(q) ||
    (item.short || '').toLowerCase().includes(q) ||
    (item.description || '').toLowerCase().includes(q) ||
    (item.fish || '').toLowerCase().includes(q) ||
    (item.address || '').toLowerCase().includes(q) ||
    (item.region || '').toLowerCase().includes(q) ||
    locality.toLowerCase().includes(q)
  );
}

export function filterWaters(items, { region, priceMin, priceMax, kind, hasWater } = {}) {
  return items.filter((item) => {
    if (region && item.region !== region) return false;
    if (kind && inferWaterBodyKind(item) !== kind) return false;
    if (hasWater === 'yes' && !listingHasWater(item)) return false;
    if (hasWater === 'no' && listingHasWater(item)) return false;
    if (isCommercialWaterType(item.type) && (priceMin != null || priceMax != null)) {
      const p = parsePriceValue(item.price || item.price_label);
      if (p == null) return false;
      if (priceMin != null && p < priceMin) return false;
      if (priceMax != null && p > priceMax) return false;
    }
    return true;
  });
}

export function sortWaters(items, sortBy, type) {
  const list = [...items];
  const isTop = (x) => Boolean(x.isTop || x.is_top || x.top);
  const byTopThen = (cmp) => (a, b) => {
    const ta = isTop(a) ? 0 : 1;
    const tb = isTop(b) ? 0 : 1;
    if (ta !== tb) return ta - tb;
    return cmp(a, b);
  };
  const byName = (a, b) => a.name.localeCompare(b.name, 'ru');
  const ratingOf = (x) => Number(x.ratingAvg ?? x.rating_avg) || 0;
  const ratingCountOf = (x) => Number(x.ratingCount ?? x.rating_count) || 0;

  switch (sortBy) {
    case 'rating':
      return list.sort(
        byTopThen((a, b) => {
          const ra = ratingOf(a);
          const rb = ratingOf(b);
          if (rb !== ra) return rb - ra;
          const ca = ratingCountOf(a);
          const cb = ratingCountOf(b);
          if (cb !== ca) return cb - ca;
          return byName(a, b);
        })
      );
    case 'price':
      if (!isCommercialWaterType(type)) return list.sort(byTopThen(byName));
      return list.sort(
        byTopThen((a, b) => {
          const pa = parsePriceValue(a.price || a.price_label) ?? Infinity;
          const pb = parsePriceValue(b.price || b.price_label) ?? Infinity;
          return pa - pb;
        })
      );
    case 'region':
      return list.sort(
        byTopThen(
          (a, b) => (a.region || '').localeCompare(b.region || '', 'ru') || byName(a, b)
        )
      );
  }
  return list.sort(byTopThen(byName));
}

/** Sort directory / catalog items: active TOP first (daily before monthly), then name */
export function sortPromoFirst(items, nameKey = 'name') {
  const topRank = (x) => {
    const active = Boolean(x.isTop || x.is_top || x.top);
    if (!active) return 2;
    const kind = x.top_kind || x.topKind || '';
    return kind === 'daily' ? 0 : 1;
  };
  const topUntilMs = (x) => {
    const t = x.top_until || x.topUntil;
    if (!t) return Number.POSITIVE_INFINITY;
    const ms = new Date(t).getTime();
    return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
  };
  return [...items].sort((a, b) => {
    const ra = topRank(a);
    const rb = topRank(b);
    if (ra !== rb) return ra - rb;
    if (ra < 2) {
      const ua = topUntilMs(a);
      const ub = topUntilMs(b);
      if (ua !== ub) return ua - ub;
    }
    return String(a[nameKey] || '').localeCompare(String(b[nameKey] || ''), 'ru');
  });
}

export function enrichWaterItem(item) {
  const ratingAvg = Number(item.ratingAvg ?? item.rating_avg) || 0;
  const ratingCount = Number(item.ratingCount ?? item.rating_count) || 0;
  return {
    ...item,
    locality: extractLocality(item.address),
    waterKind: inferWaterBodyKind(item),
    priceValue: parsePriceValue(item.price || item.price_label),
    ratingAvg,
    ratingCount,
    hasWater: listingHasWater({ ...item, waterKind: inferWaterBodyKind(item) }),
  };
}

/** Ensure external links open correctly even if owner omitted https:// */
export function normalizeExternalUrl(url) {
  const s = String(url || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^\/\//.test(s)) return `https:${s}`;
  return `https://${s}`;
}

/**
 * Website + social links from a public base/water item.
 * Owners often put a VK group only in social_vk — that must still be visible on the site.
 */
export function getBaseWebLinks(item) {
  const social = item?.social || item?.social_links || {};
  return {
    website: normalizeExternalUrl(item?.website || item?.website_url),
    vk: normalizeExternalUrl(social.vk),
    telegram: normalizeExternalUrl(social.telegram),
    max: normalizeExternalUrl(social.max),
    other: normalizeExternalUrl(social.other),
  };
}

/** Primary «На сайт» URL: own site, else VK / other social. */
export function getPrimarySiteUrl(item) {
  const links = getBaseWebLinks(item);
  return links.website || links.vk || links.other || links.telegram || links.max || '';
}
