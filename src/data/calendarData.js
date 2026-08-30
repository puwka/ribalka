// ============================================
// КАЛЕНДАРЬ РЫБОЛОВА ПЕРМСКОГО КРАЯ
// ============================================

const currentYear = new Date().getFullYear();

// Нерестовые запреты на ВЫЛОВ РЫБЫ (без раков)
export const getFishingBans = (year = currentYear) => [
  {
    id: 1,
    name: 'Щука',
    startDate: `${year}-03-01`,
    endDate: `${year}-04-15`,
    fish: 'Щука',
    description: 'Запрет на ловлю щуки в период нереста. Щука нерестится одной из первых при прогреве воды до 6-8°C.',
    region: 'Все водоёмы Пермского края',
    severity: 'high'
  },
  {
    id: 2,
    name: 'Судак',
    startDate: `${year}-04-01`,
    endDate: `${year}-05-15`,
    fish: 'Судак',
    description: 'Запрет на ловлю судака в период нереста. Нерест происходит при температуре воды 12-15°C.',
    region: 'Все водоёмы Пермского края',
    severity: 'high'
  },
  {
    id: 3,
    name: 'Сом',
    startDate: `${year}-05-15`,
    endDate: `${year}-07-15`,
    fish: 'Сом',
    description: 'Запрет на ловлю сома в период нереста. Нерест сома происходит при температуре воды 18-22°C.',
    region: 'Река Кама и её притоки',
    severity: 'high'
  },
  {
    id: 4,
    name: 'Хариус',
    startDate: `${year}-05-20`,
    endDate: `${year}-06-20`,
    fish: 'Хариус',
    description: 'Запрет на ловлю хариуса в период нереста. Хариус нерестится в мае-июне на перекатах.',
    region: 'Реки Сылва, Чусовая, Усьва, Вишера',
    severity: 'high'
  },
  {
    id: 5,
    name: 'Таймень',
    startDate: `${year}-05-01`,
    endDate: `${year}-06-15`,
    fish: 'Таймень',
    description: 'Полный запрет на ловлю тайменя. Таймень занесён в Красную книгу Пермского края.',
    region: 'Реки Вишера, Язьва, Колва',
    severity: 'critical'
  },
  {
    id: 6,
    name: 'Лещ',
    startDate: `${year}-04-15`,
    endDate: `${year}-05-20`,
    fish: 'Лещ',
    description: 'Запрет на ловлю леща в период нереста. Лещ нерестится на мелководье с растительностью.',
    region: 'Все водоёмы Пермского края',
    severity: 'medium'
  },
  {
    id: 7,
    name: 'Карп',
    startDate: `${year}-05-01`,
    endDate: `${year}-06-10`,
    fish: 'Карп',
    description: 'Запрет на ловлю карпа в период нереста. Нерест карпа происходит при температуре воды 18-20°C.',
    region: 'Озёра и пруды Пермского края',
    severity: 'medium'
  },
  {
    id: 8,
    name: 'Окунь',
    startDate: `${year}-04-20`,
    endDate: `${year}-05-30`,
    fish: 'Окунь',
    description: 'Запрет на ловлю окуня в период нереста. Окунь нерестится на мелководье среди растительности.',
    region: 'Все водоёмы Пермского края',
    severity: 'medium'
  }
];

// Сезоны клёва
export const fishingSeasons = {
  pike: {
    name: 'Щука',
    latin: 'Esox lucius',
    bestMonths: [3, 4, 5, 9, 10],
    goodMonths: [6, 8],
    poorMonths: [7, 11, 12, 1, 2],
    notes: 'Активный клёв весной и осенью'
  },
  perch: {
    name: 'Окунь',
    latin: 'Perca fluviatilis',
    bestMonths: [4, 5, 9, 10],
    goodMonths: [3, 6, 8],
    poorMonths: [7, 11, 12, 1, 2],
    notes: 'Лучший клёв при температуре 12-18°C'
  },
  zander: {
    name: 'Судак',
    latin: 'Sander lucioperca',
    bestMonths: [5, 6, 9, 10],
    goodMonths: [4, 7, 8],
    poorMonths: [11, 12, 1, 2, 3],
    notes: 'Предпочитает глубину, активен утром и вечером'
  },
  grayling: {
    name: 'Хариус',
    latin: 'Thymallus thymallus',
    bestMonths: [6, 7, 8, 9],
    goodMonths: [5, 10],
    poorMonths: [11, 12, 1, 2, 3, 4],
    notes: 'Ловится на мушки и нимфы'
  },
  carp: {
    name: 'Карп',
    latin: 'Cyprinus carpio',
    bestMonths: [6, 7, 8],
    goodMonths: [5, 9],
    poorMonths: [10, 11, 12, 1, 2, 3, 4],
    notes: 'Теплолюбивая рыба, активен при t > 18°C'
  },
  bream: {
    name: 'Лещ',
    latin: 'Abramis brama',
    bestMonths: [5, 6, 7, 8, 9],
    goodMonths: [4, 10],
    poorMonths: [11, 12, 1, 2, 3],
    notes: 'Предпочитает глубокие ямы'
  }
};

// События
export const getEvents = (year = currentYear) => [
  {
    id: 1,
    name: 'Фестиваль зимней рыбалки',
    date: `${year}-02-08`,
    location: 'Камское водохранилище',
    description: 'Ежегодный фестиваль с конкурсами и призами',
    organizer: 'Федерация рыболовного спорта'
  },
  {
    id: 2,
    name: 'Открытие сезона хариуса',
    date: `${year}-06-21`,
    location: 'Река Сылва',
    description: 'Официальное открытие сезона после запрета',
    organizer: 'Общество охотников и рыболовов'
  },
  {
    id: 3,
    name: 'Турнир «Пермский окунь»',
    date: `${year}-06-15`,
    location: 'Озеро Чаньва',
    description: 'Спортивный турнир. Призовой фонд — 100 000 ₽',
    organizer: 'Федерация рыболовного спорта'
  },
  {
    id: 4,
    name: 'День рыболова',
    date: `${year}-07-12`,
    location: 'г. Пермь',
    description: 'Городской праздник с мастер-классами',
    organizer: 'Администрация г. Перми'
  },
  {
    id: 5,
    name: 'Турнир по ловле щуки',
    date: `${year}-09-20`,
    location: 'Река Чусовая',
    description: 'Release-only формат',
    organizer: 'Клуб спиннингистов'
  },
  {
    id: 6,
    name: 'Кубок Пермского края',
    date: `${year}-10-11`,
    location: 'Камское водохранилище',
    description: 'Финальный этап Кубка',
    organizer: 'Министерство спорта'
  }
];

// Фазы луны (автоматический расчёт)
export const getMoonPhases = (year = currentYear) => {
  const phases = {};
  const knownNewMoon = new Date(2026, 0, 18);
  const lunarCycle = 29.5305882;

  for (let month = 0; month < 12; month++) {
    for (let day = 1; day <= 31; day++) {
      const date = new Date(year, month, day);
      if (date.getMonth() !== month) break;

      const daysSinceKnown = (date - knownNewMoon) / (1000 * 60 * 60 * 24);
      const moonAge = ((daysSinceKnown % lunarCycle) + lunarCycle) % lunarCycle;

      if (Math.abs(moonAge - 14.76) < 1) {
        phases[date.toISOString().split('T')[0]] = { phase: 'full', name: 'Полнолуние' };
      } else if (moonAge < 1 || moonAge > 28.53) {
        phases[date.toISOString().split('T')[0]] = { phase: 'new', name: 'Новолуние' };
      }
    }
  }

  return phases;
};

export const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
];

export const monthNamesShort = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
export const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const getCurrentYear = () => currentYear;