import {
  WATER_TYPE,
  inferWaterBodyKind,
  parsePriceValue,
} from './waterUtils';

/**
 * Curated local photos for detail pages.
 * They are generated from the project's own scenic illustrations
 * (public/img/details/*.jpg) and used only when a listing has no usable photo.
 */
export const DETAIL_PHOTO_LIBRARY = [
  '/img/details/detail-lake-cabin.jpg',
  '/img/details/detail-sunset.jpg',
  '/img/details/detail-river.jpg',
  '/img/details/detail-forest.jpg',
  '/img/details/detail-kingfisher.jpg',
  '/img/details/detail-lake.jpg',
  '/img/details/detail-sup.jpg',
  '/img/details/detail-cliff.jpg',
  '/img/details/detail-porch.jpg',
  '/img/details/detail-shore.jpg',
];

const VALID_LEGACY_BASE = new Set([
  '/img/bases/base-6-1.jpg',
  '/img/bases/base-12-2.jpg',
  '/img/bases/base-20-3.jpg',
  '/img/bases/git-rybak.jpg',
  '/img/bases/git-saby.jpg',
  '/img/bases/lf-1.jpg',
  '/img/bases/test-dl.jpg',
]);

const VALID_LEGACY_FREE = new Set([
  '/img/free/free-101-1.jpg',
  '/img/free/free-101-2.jpg',
]);

const VALID_LEGACY_POOL = new Set([
  '/img/_pool/fishing-rod-and-reel.jpg',
  '/img/_pool/gitlab-header.jpeg',
  '/img/_pool/gitlab-rybak.jpg',
  '/img/_pool/gitlab-saby.jpg',
  '/img/_pool/burst-5.jpg',
]);

function pathOnly(url) {
  return String(url || '').split(/[?#]/)[0];
}

/** Seed catalogue contains legacy `.jpg` files that are really HTML placeholders. */
export function isUsableDetailPhoto(url) {
  if (!url || typeof url !== 'string') return false;
  if (/^data:image\//i.test(url)) return true;
  if (/\.svg(?:[?#]|$)/i.test(url)) return false;

  const path = pathOnly(url);
  if (/^\/img\/catalog\//i.test(path)) return false;
  if (/^\/img\/bases\//i.test(path)) return VALID_LEGACY_BASE.has(path);
  if (/^\/img\/free\//i.test(path)) return VALID_LEGACY_FREE.has(path);
  if (/^\/img\/_pool\//i.test(path)) return VALID_LEGACY_POOL.has(path);
  return true;
}

function hashString(value) {
  let hash = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Real listing photos first, then scenic fallbacks so the gallery never looks broken. */
export function getDetailPhotos(item) {
  const source = Array.isArray(item?.images) ? item.images : [];
  const used = new Set();
  const photos = [];

  source.forEach((url) => {
    if (isUsableDetailPhoto(url) && !used.has(url)) {
      used.add(url);
      photos.push(url);
    }
  });

  const target = photos.length ? 4 : 6;
  const start = hashString(`${item?.id || ''}:${item?.name || ''}`) % DETAIL_PHOTO_LIBRARY.length;

  for (let i = 0; photos.length < target && i < DETAIL_PHOTO_LIBRARY.length; i += 1) {
    const url = DETAIL_PHOTO_LIBRARY[(start + i) % DETAIL_PHOTO_LIBRARY.length];
    if (!used.has(url)) {
      used.add(url);
      photos.push(url);
    }
  }

  return photos;
}

export function getDetailAtmosphereImage(item) {
  const photos = getDetailPhotos(item);
  return photos[1] || photos[0] || '/img/details/detail-sunset.jpg';
}

export function getWaterTypeLabel(item) {
  if (item?.type === WATER_TYPE.FREE) return 'Бесплатный водоём';
  if (item?.type === WATER_TYPE.PAID_FISHING) return 'Платная рыбалка';

  const kind = item?.waterKind || inferWaterBodyKind(item || {});
  if (kind === 'База отдыха') return 'База отдыха';
  return 'Платный водоём';
}

export function getWaterTypeModifier(item) {
  if (item?.type === WATER_TYPE.FREE) return 'free';
  if (item?.type === WATER_TYPE.PAID_FISHING) return 'paid-fishing';
  return 'paid';
}

function getServices(item) {
  if (!Array.isArray(item?.services)) return [];
  return item.services
    .map((service) => (typeof service === 'string' ? service : service?.name))
    .filter(Boolean);
}

function getTextBlob(item) {
  return [
    item?.description,
    item?.short,
    item?.features,
    item?.weather,
    item?.conditions,
    item?.howToGet,
  ]
    .filter(Boolean)
    .join(' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getPriceUnit(item) {
  const raw = `${item?.price || ''} ${item?.price_label || ''}`.toLowerCase();
  if (/час/.test(raw)) return 'час';
  if (/сут/.test(raw)) return 'сутки';
  if (/день|дня|днев/.test(raw)) return 'день';
  if (/рыбалк/.test(raw)) return 'рыбалка';
  return item?.type === WATER_TYPE.PAID_FISHING ? 'день' : 'сутки';
}

export function getDetailPrice(item) {
  if (item?.type === WATER_TYPE.FREE) {
    return { prefix: '', amount: 'Бесплатно', unit: '', isFree: true };
  }

  const value = Number(
    item?.priceValue ?? item?.price_from ?? parsePriceValue(item?.price || item?.price_label)
  );

  if (!Number.isFinite(value) || value <= 0) {
    return { prefix: '', amount: 'Цена по запросу', unit: '', isFree: false };
  }

  return {
    prefix: 'От',
    amount: `${value.toLocaleString('ru-RU')} ₽`,
    unit: `/ ${getPriceUnit(item)}`,
    isFree: false,
  };
}

function parseCapacity(blob) {
  const match = blob.match(
    /(?:вместимость|рассчитан[аы]?|размещает|принимает|до)\s*(?:до\s*)?(\d{1,3}(?:\s*[-–]\s*\d{1,3})?)\s*(?:человек|чел\.?|гостей)/i
  );
  if (!match) return '';
  return match[1].replace(/\s*[-–]\s*/g, '–');
}

function parseClock(blob, label) {
  const match = blob.match(new RegExp(`${label}[^0-9]{0,24}(\\d{1,2}[:.]\\d{2})`, 'i'));
  return match ? match[1].replace('.', ':') : '';
}

function firstService(services, pattern) {
  return services.find((service) => pattern.test(service)) || '';
}

/** Short, honest facts derived from the listing — never invent check-in times etc. */
export function getDetailConditions(item) {
  const services = getServices(item);
  const blob = getTextBlob(item);
  const list = [];
  const push = (icon, text) => {
    if (text && !list.some((row) => row.text === text)) list.push({ icon, text });
  };

  const capacity = parseCapacity(blob);
  if (capacity) push('users', `Вместимость: ${capacity}`);

  const sauna = firstService(services, /саун/i);
  const banya = firstService(services, /бан/i);
  if (sauna) push('bath', 'Сауна: есть');
  else if (banya) push('bath', 'Баня: есть');

  const cottages = blob.match(/(\d+)\s*(?:коттедж|домик)/i);
  if (cottages) {
    push('home', `Коттеджи: ${cottages[1]}`);
  }

  const checkIn = parseClock(blob, 'заезд');
  const checkOut = parseClock(blob, 'выезд');
  if (checkIn) push('clock', `Время заезда: ${checkIn}`);
  if (checkOut) push('clock', `Время выезда: ${checkOut}`);

  if (list.length < 5 && /парков/i.test(services.join(' '))) {
    push('car', 'Парковка: есть');
  }
  if (list.length < 5 && /wi-?fi|вай-?фай/i.test(services.join(' '))) {
    push('wifi', 'Wi-Fi: есть');
  }
  if (list.length < 5 && item?.workHours) {
    push('clock', `Режим работы: ${item.workHours}`);
  }
  if (list.length < 5 && item?.fish) {
    push('fish', `Рыба: ${String(item.fish).split(',').slice(0, 2).join(', ').trim()}`);
  }
  if (list.length < 5 && item?.type === WATER_TYPE.FREE) {
    push('leaf', 'Бесплатное посещение');
  }
  if (list.length < 5 && item?.transport) {
    push('car', `Транспорт: ${String(item.transport).slice(0, 54)}`);
  }
  if (!list.length) push('check', 'Уточните условия у базы');

  return list.slice(0, 5);
}

/** Four feature tiles under the title, based on real listing attributes. */
export function getDetailHighlights(item) {
  const services = getServices(item);
  const servicesText = services.join(' ').toLowerCase();
  const blob = getTextBlob(item).toLowerCase();
  const list = [];
  const add = (icon, title, subtitle) => {
    if (!list.some((row) => row.title === title)) list.push({ icon, title, subtitle });
  };

  if (item?.type === WATER_TYPE.FREE) add('leaf', 'Бесплатно', 'для всех');
  if (/бан|саун/.test(servicesText)) add('bath', 'Баня', 'на территории');
  if (/парков/.test(servicesText)) {
    add('car', 'Парковка', 'для автомобиля');
  }
  if (item?.fish || item?.hasWater) {
    add('fish', 'Рыбалка', item?.type === WATER_TYPE.FREE ? 'бесплатно' : 'на водоёме');
  }
  if (/wi-?fi|вай-?фай/.test(servicesText)) add('wifi', 'Wi-Fi', 'на территории');
  if (/кухн|кафе|ресторан/.test(servicesText)) add('utensils', 'Кухня', 'для гостей');
  if (/бассейн/.test(servicesText) || /бассейн/.test(blob)) {
    add('waves', 'Бассейн', 'на территории');
  }
  if (/детск|семейн/.test(blob)) add('users', 'Семейный отдых', 'для детей');
  if (item?.workHours && /кругл|24/.test(String(item.workHours))) {
    add('clock', 'Круглосуточно', 'без выходных');
  }

  const locality = item?.locality || '';
  if (locality) add('pin', 'Удобное расположение', locality);
  if (item?.region) add('leaf', 'Природа', item.region);
  add('home', 'Уютный отдых', 'на природе');
  add('users', 'Для компании', 'большой компанией');
  add('fish', 'Рыбалка', 'рядом с водоёмом');
  add('leaf', 'Свежий воздух', 'Пермский край');

  return list.slice(0, 4);
}

export function getDetailAmenities(item) {
  const services = getServices(item);
  if (services.length) return services;

  const raw = String(item?.features || item?.weather || '')
    .replace(/<[^>]+>/g, ' ')
    .trim();
  if (!raw) return [];

  return raw
    .split(/[,;\n•]+/)
    .map((value) => value.trim())
    .filter((value) => value.length >= 2 && value.length <= 42)
    .slice(0, 12);
}

export function getDetailTravel(item) {
  return {
    text: item?.howToGet || item?.conditions || '',
    transport: item?.transport || '',
  };
}

export function getTelHref(phone) {
  const normalized = String(phone || '').replace(/[^\d+]/g, '');
  return normalized ? `tel:${normalized}` : '';
}
