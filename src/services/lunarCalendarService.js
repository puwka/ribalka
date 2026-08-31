/**
 * Lunar fishing calendar — computed (not static mock tables).
 * Moon age uses synodic month from a known new-moon epoch (UTC).
 */

const SYNODIC = 29.53058867;
/** Known new moon: 2000-01-06 18:14 UTC */
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

const PHASES = [
  { id: 'new', name: 'Новолуние', emoji: '🌑', from: 0, to: 0.03 },
  { id: 'waxing_crescent', name: 'Растущий серп', emoji: '🌒', from: 0.03, to: 0.22 },
  { id: 'first_quarter', name: 'Первая четверть', emoji: '🌓', from: 0.22, to: 0.28 },
  { id: 'waxing_gibbous', name: 'Растущая', emoji: '🌔', from: 0.28, to: 0.47 },
  { id: 'full', name: 'Полнолуние', emoji: '🌕', from: 0.47, to: 0.53 },
  { id: 'waning_gibbous', name: 'Убывающая', emoji: '🌖', from: 0.53, to: 0.72 },
  { id: 'last_quarter', name: 'Последняя четверть', emoji: '🌗', from: 0.72, to: 0.78 },
  { id: 'waning_crescent', name: 'Стареющий серп', emoji: '🌘', from: 0.78, to: 1 },
];

/** Bite score weight by moon phase (0–100 base). */
const PHASE_BITE = {
  new: 88,
  waxing_crescent: 62,
  first_quarter: 48,
  waxing_gibbous: 70,
  full: 92,
  waning_gibbous: 68,
  last_quarter: 45,
  waning_crescent: 60,
};

const BEST_TIMES_BY_PHASE = {
  new: [
    { id: 'dawn', label: 'Рассвет', range: '04:30–07:00', score: 95 },
    { id: 'dusk', label: 'Закат', range: '19:00–21:30', score: 90 },
    { id: 'night', label: 'Ночь', range: '22:00–02:00', score: 80 },
  ],
  full: [
    { id: 'night', label: 'Ночь', range: '21:00–03:00', score: 95 },
    { id: 'dawn', label: 'Рассвет', range: '04:00–07:00', score: 85 },
    { id: 'dusk', label: 'Закат', range: '18:30–21:00', score: 82 },
  ],
  first_quarter: [
    { id: 'morning', label: 'Утро', range: '07:00–11:00', score: 70 },
    { id: 'evening', label: 'Вечер', range: '16:00–19:00', score: 65 },
  ],
  last_quarter: [
    { id: 'morning', label: 'Утро', range: '06:00–10:00', score: 68 },
    { id: 'afternoon', label: 'День', range: '13:00–16:00', score: 55 },
  ],
  default: [
    { id: 'dawn', label: 'Рассвет', range: '05:00–08:00', score: 75 },
    { id: 'dusk', label: 'Закат', range: '18:00–21:00', score: 78 },
    { id: 'day', label: 'День', range: '11:00–15:00', score: 50 },
  ],
};

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toDateKey(date) {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function getMoonAge(date = new Date()) {
  const t = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    12,
    0,
    0
  );
  const days = (t - KNOWN_NEW_MOON) / 86400000;
  const age = ((days % SYNODIC) + SYNODIC) % SYNODIC;
  return age;
}

export function getMoonPhase(date = new Date()) {
  const age = getMoonAge(date);
  const fraction = age / SYNODIC;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  const phase =
    PHASES.find((p) => fraction >= p.from && fraction < p.to) || PHASES[0];

  return {
    age: Number(age.toFixed(2)),
    fraction: Number(fraction.toFixed(4)),
    illumination: Math.round(illumination * 100),
    phase: phase.id,
    name: phase.name,
    emoji: phase.emoji,
    isGrowing: fraction < 0.5,
  };
}

function seasonModifier(month) {
  // Perm region rough season boost
  if ([5, 6, 9].includes(month)) return 12;
  if ([4, 7, 8, 10].includes(month)) return 5;
  if ([11, 3].includes(month)) return -5;
  return -12;
}

function weekdayModifier(day) {
  // weekends slightly more pressure / activity
  if (day === 0 || day === 6) return -3;
  return 2;
}

export function getBiteForecast(date = new Date()) {
  const moon = getMoonPhase(date);
  const base = PHASE_BITE[moon.phase] ?? 60;
  const month = date.getMonth() + 1;
  const score = clamp(
    Math.round(base + seasonModifier(month) + weekdayModifier(date.getDay())),
    5,
    98
  );

  let level = 'average';
  let label = 'Средний клёв';
  if (score >= 80) {
    level = 'excellent';
    label = 'Отличный клёв';
  } else if (score >= 65) {
    level = 'good';
    label = 'Хороший клёв';
  } else if (score < 45) {
    level = 'poor';
    label = 'Слабый клёв';
  }

  return { score, level, label, moon };
}

export function getActivityLevel(date = new Date()) {
  const { score, moon } = getBiteForecast(date);
  const activity = clamp(
    Math.round(score * 0.7 + moon.illumination * 0.3),
    0,
    100
  );
  let label = 'Умеренная';
  if (activity >= 75) label = 'Высокая';
  else if (activity < 40) label = 'Низкая';
  return { value: activity, label };
}

export function getBestTimes(date = new Date()) {
  const moon = getMoonPhase(date);
  const key =
    moon.phase === 'new' || moon.phase === 'full' || moon.phase === 'first_quarter' || moon.phase === 'last_quarter'
      ? moon.phase
      : 'default';
  const list = BEST_TIMES_BY_PHASE[key] || BEST_TIMES_BY_PHASE.default;
  return list.map((t) => ({ ...t })).sort((a, b) => b.score - a.score);
}

export function getRecommendations(date = new Date()) {
  const forecast = getBiteForecast(date);
  const times = getBestTimes(date);
  const tips = [];

  if (forecast.moon.phase === 'full' || forecast.moon.phase === 'new') {
    tips.push('Сильные фазы луны — планируйте выход на зорях и ночью.');
  }
  if (forecast.level === 'excellent') {
    tips.push('Благоприятный день для хищника: щука, судак, окунь.');
  } else if (forecast.level === 'poor') {
    tips.push('Слабый клёв: уменьшите размер приманки и темп проводки.');
  }
  if (forecast.moon.isGrowing) {
    tips.push('Растущая луна — хорошо работают активные приманки.');
  } else {
    tips.push('Убывающая луна — упор на пассивную подачу и донную ловлю.');
  }
  tips.push(`Лучшее окно: ${times[0].label} (${times[0].range}).`);

  const month = date.getMonth() + 1;
  if (month >= 5 && month <= 6) {
    tips.push('Учитывайте местные нерестовые запреты Пермского края.');
  }

  return {
    forecast,
    activity: getActivityLevel(date),
    bestTimes: times,
    tips,
  };
}

export function getDayLunarInfo(date = new Date()) {
  const forecast = getBiteForecast(date);
  return {
    dateKey: toDateKey(date),
    date,
    moon: forecast.moon,
    forecast,
    activity: getActivityLevel(date),
    bestTimes: getBestTimes(date),
    recommendations: getRecommendations(date).tips,
  };
}

export function buildMonthDays(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const last = new Date(year, monthIndex + 1, 0);
  const days = [];
  const pad = first.getDay() === 0 ? 6 : first.getDay() - 1;

  for (let i = pad - 1; i >= 0; i -= 1) {
    const d = new Date(year, monthIndex, -i);
    days.push({ ...getDayLunarInfo(d), inMonth: false });
  }
  for (let i = 1; i <= last.getDate(); i += 1) {
    const d = new Date(year, monthIndex, i);
    days.push({ ...getDayLunarInfo(d), inMonth: true });
  }
  while (days.length % 7 !== 0 || days.length < 42) {
    const lastDay = days[days.length - 1].date;
    const d = new Date(lastDay);
    d.setDate(d.getDate() + 1);
    days.push({ ...getDayLunarInfo(d), inMonth: false });
    if (days.length >= 42) break;
  }
  return days;
}

export const lunarCalendarService = {
  getMoonPhase,
  getBiteForecast,
  getActivityLevel,
  getBestTimes,
  getRecommendations,
  getDayLunarInfo,
  buildMonthDays,
  toDateKey,
  parseLocalDate,
  monthNames: [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ],
  dayNames: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
};
