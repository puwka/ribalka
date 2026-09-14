/** Resolve and sort directory listings by district / region. */

export function getItemRegion(item) {
  const explicit = String(item?.region || item?.district || '').trim();
  if (explicit) return explicit;
  return '';
}

export function collectRegions(items, districtNames = []) {
  const set = new Set(
    [...districtNames, ...items.map(getItemRegion)].filter(Boolean)
  );
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
}

/** TOP first, then by region (empty last), then by name. */
export function sortDirectoryItems(items, { byRegion = true } = {}) {
  return [...items].sort((a, b) => {
    const topA = a.isTop || a.top ? 0 : 1;
    const topB = b.isTop || b.top ? 0 : 1;
    if (topA !== topB) return topA - topB;
    if (byRegion) {
      const ra = getItemRegion(a) || 'яяя';
      const rb = getItemRegion(b) || 'яяя';
      const cmp = ra.localeCompare(rb, 'ru');
      if (cmp !== 0) return cmp;
    }
    return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
  });
}

/** Group sorted items into [{ region, items }] for section headings. */
export function groupByRegion(items) {
  const groups = [];
  const map = new Map();
  for (const item of items) {
    const key = getItemRegion(item) || 'Район не указан';
    if (!map.has(key)) {
      const g = { region: key, items: [] };
      map.set(key, g);
      groups.push(g);
    }
    map.get(key).items.push(item);
  }
  return groups;
}
