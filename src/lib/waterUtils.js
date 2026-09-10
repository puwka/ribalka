/** Helpers for water catalog filtering, sorting, display */

export const WATER_TYPE = {
  PAID: 'paid',
  FREE: 'free',
};

export function parsePriceValue(priceLabel) {
  if (!priceLabel) return null;
  const m = String(priceLabel).match(/(\d[\d\s]*)/);
  if (!m) return null;
  const n = parseInt(m[1].replace(/\s/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

export function formatPaidPrice(item) {
  if (item.price) return item.price.startsWith('от') ? `Рыбалка ${item.price}` : `Рыбалка от ${item.price}`;
  const from = parsePriceValue(item.price_label);
  if (from) return `Рыбалка от ${from.toLocaleString('ru-RU')} ₽`;
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
  if (name.includes('река') || name.includes('река ') || name.includes('устье')) return 'Река';
  if (name.includes('база') || name.includes('водоём')) return 'База';
  return item.type === WATER_TYPE.FREE ? 'Водоём' : 'Платный водоём';
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

export function filterWaters(items, { region, priceMin, priceMax, kind } = {}) {
  return items.filter((item) => {
    if (region && item.region !== region) return false;
    if (kind && inferWaterBodyKind(item) !== kind) return false;
    if (item.type === WATER_TYPE.PAID && (priceMin != null || priceMax != null)) {
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

  switch (sortBy) {
    case 'price':
      if (type !== WATER_TYPE.PAID) return list.sort(byTopThen(byName));
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

/** Sort directory / catalog items: TOP first, then original order / name */
export function sortPromoFirst(items, nameKey = 'name') {
  return [...items].sort((a, b) => {
    const ta = a.isTop || a.is_top || a.top ? 0 : 1;
    const tb = b.isTop || b.is_top || b.top ? 0 : 1;
    if (ta !== tb) return ta - tb;
    return String(a[nameKey] || '').localeCompare(String(b[nameKey] || ''), 'ru');
  });
}

export function enrichWaterItem(item) {
  return {
    ...item,
    locality: extractLocality(item.address),
    waterKind: inferWaterBodyKind(item),
    priceValue: parsePriceValue(item.price || item.price_label),
  };
}
