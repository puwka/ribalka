/**
 * Directory placement pricing (Конструктор + сервисы).
 */

export const DIRECTORY_PERIODS = [3, 6, 12];

export const DEFAULT_CONSTRUCTOR = {
  title: 'Тариф Конструктор',
  baseAmount: 2900,
  includedPhotos: 1,
  includedVideos: 1,
  addonTop: 1000,
  addonFrame: 390,
  addonPhoto: 100,
  addonVideo: 100,
  discount3: 10,
  discount6: 20,
  discount12: 30,
  enabled: true,
};

export const DEFAULT_SERVICE_TARIFF = {
  title: 'Тариф для сервисов',
  amountPerMonth: 590,
  addonFrame: 100,
  enabled: true,
};

export function normalizeConstructor(raw = {}) {
  return {
    ...DEFAULT_CONSTRUCTOR,
    ...raw,
    baseAmount: Number(raw.baseAmount ?? DEFAULT_CONSTRUCTOR.baseAmount),
    addonTop: Number(raw.addonTop ?? DEFAULT_CONSTRUCTOR.addonTop),
    addonFrame: Number(raw.addonFrame ?? DEFAULT_CONSTRUCTOR.addonFrame),
    addonPhoto: Number(raw.addonPhoto ?? DEFAULT_CONSTRUCTOR.addonPhoto),
    addonVideo: Number(raw.addonVideo ?? DEFAULT_CONSTRUCTOR.addonVideo),
    discount3: Number(raw.discount3 ?? DEFAULT_CONSTRUCTOR.discount3),
    discount6: Number(raw.discount6 ?? DEFAULT_CONSTRUCTOR.discount6),
    discount12: Number(raw.discount12 ?? DEFAULT_CONSTRUCTOR.discount12),
    enabled: raw.enabled !== false,
  };
}

export function normalizeServiceTariff(raw = {}) {
  return {
    ...DEFAULT_SERVICE_TARIFF,
    ...raw,
    amountPerMonth: Number(raw.amountPerMonth ?? DEFAULT_SERVICE_TARIFF.amountPerMonth),
    addonFrame: Number(raw.addonFrame ?? DEFAULT_SERVICE_TARIFF.addonFrame),
    enabled: raw.enabled !== false,
  };
}

export function discountPercentForMonths(tariff, months) {
  if (months === 3) return Number(tariff.discount3) || 0;
  if (months === 6) return Number(tariff.discount6) || 0;
  if (months === 12) return Number(tariff.discount12) || 0;
  return 0;
}

/** Monthly package before period discount */
export function calcConstructorMonthly(tariff, options = {}) {
  const t = normalizeConstructor(tariff);
  const top = options.top ? t.addonTop : 0;
  const frame = options.frame ? t.addonFrame : 0;
  const extraPhotos = Math.max(0, Number(options.extraPhotos) || 0);
  const extraVideos = Math.max(0, Number(options.extraVideos) || 0);
  return (
    t.baseAmount +
    top +
    frame +
    extraPhotos * t.addonPhoto +
    extraVideos * t.addonVideo
  );
}

export function calcConstructorTotal(tariff, options = {}) {
  const months = Number(options.months) || 3;
  const monthly = calcConstructorMonthly(tariff, options);
  const full = monthly * months;
  const discountPct = discountPercentForMonths(tariff, months);
  const discountAmount = Math.round((full * discountPct) / 100);
  const total = Math.max(0, full - discountAmount);
  return {
    months,
    monthly,
    full,
    discountPct,
    discountAmount,
    total,
  };
}

export function calcServiceTotal(tariff, options = {}) {
  const t = normalizeServiceTariff(tariff);
  const months = Number(options.months) || 3;
  const monthly = t.amountPerMonth + (options.frame ? t.addonFrame : 0);
  const total = monthly * months;
  return { months, monthly, full: total, discountPct: 0, discountAmount: 0, total };
}

export function formatRub(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`;
}
