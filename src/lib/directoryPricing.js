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
  addonTopDaily: 300,
  addonFrame: 390,
  addonPhoto: 100,
  addonVideo: 100,
  discount3: 10,
  discount6: 20,
  discount12: 30,
  enabled: true,
};

export const DEFAULT_SERVICE_TARIFF = {
  title: 'Тариф справочника',
  amountPerMonth: 590,
  addonTop: 500,
  addonTopDaily: 300,
  addonFrame: 100,
  discount3: 10,
  discount6: 20,
  discount12: 30,
  enabled: true,
};

export function normalizeConstructor(raw = {}) {
  return {
    ...DEFAULT_CONSTRUCTOR,
    ...raw,
    baseAmount: Number(
      raw.baseAmount ?? raw.amount ?? DEFAULT_CONSTRUCTOR.baseAmount
    ),
    includedPhotos: Number(raw.includedPhotos ?? DEFAULT_CONSTRUCTOR.includedPhotos),
    includedVideos: Number(raw.includedVideos ?? DEFAULT_CONSTRUCTOR.includedVideos),
    addonTop: Number(raw.addonTop ?? DEFAULT_CONSTRUCTOR.addonTop),
    addonTopDaily: Number(raw.addonTopDaily ?? DEFAULT_CONSTRUCTOR.addonTopDaily),
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
    addonTop: Number(raw.addonTop ?? DEFAULT_SERVICE_TARIFF.addonTop),
    addonTopDaily: Number(
      raw.addonTopDaily ?? raw.addonTop ?? DEFAULT_SERVICE_TARIFF.addonTopDaily
    ),
    addonFrame: Number(raw.addonFrame ?? DEFAULT_SERVICE_TARIFF.addonFrame),
    discount3: Number(raw.discount3 ?? DEFAULT_SERVICE_TARIFF.discount3),
    discount6: Number(raw.discount6 ?? DEFAULT_SERVICE_TARIFF.discount6),
    discount12: Number(raw.discount12 ?? DEFAULT_SERVICE_TARIFF.discount12),
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
  const frame = options.frame ? t.addonFrame : 0;
  const extraPhotos = Math.max(0, Number(options.extraPhotos) || 0);
  const extraVideos = Math.max(0, Number(options.extraVideos) || 0);
  return (
    t.baseAmount +
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
  const full = monthly * months;
  const discountPct = discountPercentForMonths(t, months);
  const discountAmount = Math.round((full * discountPct) / 100);
  const total = Math.max(0, full - discountAmount);
  return { months, monthly, full, discountPct, discountAmount, total };
}

export function formatRub(n) {
  return `${Math.round(Number(n) || 0).toLocaleString('ru-RU')} ₽`;
}

/** Whole months left until paidUntil (min 1 if still active). */
export function remainingMonthsCeil(paidUntilIso) {
  if (!paidUntilIso) return 0;
  const ms = new Date(paidUntilIso).getTime() - Date.now();
  if (!(ms > 0)) return 0;
  return Math.max(1, Math.ceil(ms / (30 * 86400000)));
}

/**
 * Mid-period base upgrade quote (client preview; server is source of truth).
 * Media: flat +N ₽ for the rest of the period. TOP/frame: × remaining months.
 */
export function calcListingUpgradeTotal(tariff, base, options = {}) {
  const t = normalizeConstructor(tariff);
  const paidUntil = base?.paid_until || base?.paidUntil;
  const rem = remainingMonthsCeil(paidUntil);
  if (!rem) {
    return {
      canUpgrade: false,
      reason: 'no_active_period',
      total: 0,
      remainingMonths: 0,
      deltaPhotos: 0,
      deltaVideos: 0,
      addTop: false,
      addFrame: false,
    };
  }
  const paidPhotos = Math.max(0, Number(base.paid_extra_photos) || 0);
  const paidVideos = Math.max(0, Number(base.paid_extra_videos) || 0);
  const wantPhotos = Math.max(0, Number(options.extraPhotos) || 0);
  const wantVideos = Math.max(0, Number(options.extraVideos) || 0);
  const deltaPhotos = Math.max(0, wantPhotos - paidPhotos);
  const deltaVideos = Math.max(0, wantVideos - paidVideos);
  const hasFrame = Boolean(base.yellow_frame || base.yellowFrame);
  const addTop = false;
  const addFrame = Boolean(options.frame) && !hasFrame;
  const total = Math.max(
    0,
    Math.round(
      deltaPhotos * t.addonPhoto +
        deltaVideos * t.addonVideo +
        (addFrame ? t.addonFrame * rem : 0)
    )
  );
  return {
    canUpgrade: total > 0,
    reason: total > 0 ? null : 'nothing_new',
    total,
    remainingMonths: rem,
    deltaPhotos,
    deltaVideos,
    addTop,
    addFrame,
  };
}

/** Mid-period directory frame upgrade preview (TOP — only daily). */
export function calcDirectoryUpgradeTotal(tariff, item, options = {}) {
  const t = normalizeServiceTariff(tariff);
  const rem = remainingMonthsCeil(item?.paidUntil);
  if (!rem) {
    return { canUpgrade: false, reason: 'no_active_period', total: 0, remainingMonths: 0 };
  }
  const hasFrame = Boolean(item.yellowFrame || item.highlight);
  const addTop = false;
  const addFrame = Boolean(options.frame) && !hasFrame;
  const total = Math.max(0, Math.round((addFrame ? t.addonFrame : 0) * rem));
  return {
    canUpgrade: total > 0,
    reason: total > 0 ? null : 'nothing_new',
    total,
    remainingMonths: rem,
    addTop,
    addFrame,
  };
}

