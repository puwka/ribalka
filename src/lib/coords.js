/**
 * Parse and normalize map coordinates (lat/lng).
 * Accepts: numbers, "58.5", "58,5", "58.5, 56.2", coords string.
 */

export function parseCoordNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(',', '.');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

/** Extract { lat, lng } from record or UI item */
export function resolveLatLng(item) {
  if (!item) return { lat: null, lng: null };

  let lat = parseCoordNumber(item.lat);
  let lng = parseCoordNumber(item.lng);

  if ((lat == null || lng == null) && item.coords) {
    const parts = String(item.coords)
      .split(/[,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      if (lat == null) lat = parseCoordNumber(parts[0]);
      if (lng == null) lng = parseCoordNumber(parts[1]);
    }
  }

  return { lat, lng };
}

/** Yandex Maps placemark: [lat, lng] */
export function toYandexCoords(item) {
  const { lat, lng } = resolveLatLng(item);
  if (lat == null || lng == null) return null;
  return [lat, lng];
}

export function toCoordsString(item) {
  const { lat, lng } = resolveLatLng(item);
  if (lat == null || lng == null) return null;
  return `${lat}, ${lng}`;
}
