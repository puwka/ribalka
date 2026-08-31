import { cmsDb } from '../lib/cmsDb';
import { supabase, supabaseDataEnabled } from '../lib/supabase';
import { unwrap } from '../lib/apiError';
import { assertAdmin } from '../lib/assertAdmin';
import { DIRECTORY_PAGE_DEFAULTS } from '../data/directorySeed';

export const CMS_PAGES = {
  HOME: 'home',
  PAID_WATERS: 'paid-waters',
  FREE_WATERS: 'free-waters',
  DIRECTORY: 'directory',
  ABOUT: 'about',
};

const DEFAULT_SETTINGS = {
  siteName: 'Рыбалка в Прикамье',
  tagline: 'Всё о рыбалке и отдыхе в Пермском крае. Найдите своё идеальное место для незабываемого отдыха на природе.',
  logoUrl: '',
  faviconUrl: '/favicon.ico',
  contactEmail: 'info@rybalka-perm.ru',
  contactPhone: '',
  legalOgrnip: 'ОГРНИП 123456789012345',
  legalInn: 'ИНН 123456789012',
  sponsors: [
    { label: 'cash-boom.live', url: 'https://cash-boom.live' },
    { label: 'Енот-мани', url: 'https://енот-мани.рф' },
  ],
  social: {
    max: 'https://max.ru',
    telegram: 'https://t.me/',
    vk: 'https://vk.com',
  },
  cookieText:
    'Мы используем cookie для улучшения работы сайта. Продолжая пользоваться сайтом, вы соглашаетесь с политикой конфиденциальности.',
  privacyText: '',
  termsText: '',
};

const DEFAULT_PAGES = {
  [CMS_PAGES.HOME]: {
    hero: {
      title: 'Активный отдых и рыбалка в Пермском крае',
      description:
        'Платные базы с комфортом и дикие водоёмы с невероятной природой. Найдите своё место для незабываемого отдыха на природе в сердце Урала.',
      descriptionFallback:
        'Платные базы с комфортом и дикие водоёмы с невероятной природой. Найдите своё место для незабываемого отдыха на природе в сердце Урала.',
      image: '/img/hero/header-img.jpeg',
      ctaPrimary: { label: 'Платные водоёмы', url: '/paid-waters' },
      ctaSecondary: { label: 'Бесплатные места', url: '/free-waters' },
      ctaTertiary: { label: 'Карта', url: '/map' },
      showStats: true,
    },
    blocks: {
      navStrip: { enabled: true },
      watersSection: { enabled: true, title: 'Водоёмы', subtitle: '' },
      newsSection: { enabled: true, title: 'Новости', subtitle: '' },
      cta: {
        enabled: true,
        title: 'Планируете рыбалку в Пермском крае?',
        description:
          'Соберите маршрут на карте, выберите водоём и сохраните понравившиеся места в избранное.',
        actions: [
          { label: 'Карта', url: '/map' },
          { label: 'Платные', url: '/paid-waters' },
          { label: 'Бесплатные', url: '/free-waters' },
        ],
      },
    },
    blockOrder: ['navStrip', 'watersSection', 'newsSection', 'cta'],
  },
  [CMS_PAGES.PAID_WATERS]: {
    title: 'Платные водоёмы',
    description:
      'Водоёмы Пермского края с оплатой за рыбалку: пруды, хозяйства и специализированные места.',
    intro: '',
    extraBlocks: [],
  },
  [CMS_PAGES.FREE_WATERS]: {
    title: 'Бесплатные водоёмы',
    description: 'Реки, озёра и дикие места Прикамья без платы за въезд или сутки.',
    intro: '',
    extraBlocks: [],
  },
  [CMS_PAGES.DIRECTORY]: {
    ...DIRECTORY_PAGE_DEFAULTS,
  },
  [CMS_PAGES.ABOUT]: {
    title: 'О проекте',
    description: '',
    content: '',
  },
};

const DEFAULT_SEO = {
  '/': {
    title: 'Рыбалка в Прикамье — водоёмы, отчёты и карта',
    description:
      'Каталог платных и бесплатных водоёмов Пермского края, карта, отчёты рыбаков и лунный календарь.',
    keywords: '',
    canonical: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
  },
  '/paid-waters': {
    title: 'Платные водоёмы Пермского края — Рыбалка в Прикамье',
    description:
      'Каталог платных водоёмов Прикамья: цены, регионы, карта и подробные описания. Рыбалка с оплатой за сутки или вылов.',
    keywords: '',
    canonical: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
  },
  '/free-waters': {
    title: 'Бесплатные водоёмы Пермского края — Рыбалка в Прикамье',
    description:
      'Бесплатные места для рыбалки в Пермском крае: реки, озёра, карта и описания водоёмов без платы.',
    keywords: '',
    canonical: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
  },
  '/map': {
    title: 'Карта водоёмов — Рыбалка в Прикамье',
    description: 'Интерактивная карта платных и бесплатных водоёмов Пермского края.',
    keywords: '',
    canonical: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
  },
  '/directory': {
    title: 'Справочник рыболова — Рыбалка в Прикамье',
    description:
      'Магазины, сервисы, гиды и егеря Пермского края: контакты, адреса и описание.',
    keywords: '',
    canonical: '',
    ogTitle: '',
    ogDescription: '',
    ogImage: '',
  },
  robots: 'User-agent: *\nAllow: /',
  sitemapEnabled: true,
  schemaOrg: '',
};

const DEFAULT_FOOTER = {
  brandText:
    'Всё о рыбалке и отдыхе в Пермском крае. Найдите своё идеальное место для незабываемого отдыха на природе.',
  menuLinks: [
    { label: 'Главная', url: '/' },
    { label: 'Платные водоёмы', url: '/paid-waters' },
    { label: 'Бесплатные водоёмы', url: '/free-waters' },
    { label: 'Карта', url: '/map' },
    { label: 'Отчёты', url: '/reports' },
    { label: 'Новости', url: '/news/all' },
    { label: 'О проекте', url: '/about' },
  ],
  serviceLinks: [
    { label: 'Справочник', url: '/directory' },
    { label: 'Лунный календарь', url: '/lunar' },
    { label: 'Форум', url: '/forum' },
  ],
  legalLinks: [
    { label: 'Политика конфиденциальности', modal: 'privacy' },
    { label: 'Пользовательское соглашение', modal: 'terms' },
  ],
  showSponsors: true,
  showSocial: true,
  showDateTime: true,
};

function deepMerge(base, patch) {
  if (!patch || typeof patch !== 'object') return base;
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && !Array.isArray(out[k])) {
      out[k] = deepMerge(out[k], v);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out;
}

async function remoteGetKv(key) {
  if (!supabaseDataEnabled || !supabase) return null;
  const row = unwrap(
    await supabase.from('cms_kv').select('value').eq('key', key).maybeSingle()
  );
  return row?.value ?? null;
}

async function remoteSetKv(key, value, adminId) {
  if (!supabaseDataEnabled || !supabase) return value;
  unwrap(
    await supabase.from('cms_kv').upsert({
      key,
      value,
      updated_by: adminId || null,
      updated_at: new Date().toISOString(),
    })
  );
  return value;
}

export const cmsService = {
  pages: CMS_PAGES,

  async getSettings() {
    const stored = (await remoteGetKv('settings')) ?? (await cmsDb.getKv('settings'));
    return deepMerge(DEFAULT_SETTINGS, stored || {});
  },

  async saveSettings(adminId, patch) {
    await assertAdmin(adminId);
    const current = await this.getSettings();
    const next = deepMerge(current, patch);
    await remoteSetKv('settings', next, adminId);
    await cmsDb.setKv('settings', next);
    return next;
  },

  async getPage(pageKey) {
    const defaults = DEFAULT_PAGES[pageKey] || {};
    const stored =
      (await remoteGetKv(`page:${pageKey}`)) ?? (await cmsDb.getKv(`page:${pageKey}`));
    return deepMerge(defaults, stored || {});
  },

  async savePage(adminId, pageKey, patch) {
    await assertAdmin(adminId);
    const current = await this.getPage(pageKey);
    const next = deepMerge(current, patch);
    await remoteSetKv(`page:${pageKey}`, next, adminId);
    await cmsDb.setKv(`page:${pageKey}`, next);
    return next;
  },

  async getFooter() {
    const stored = (await remoteGetKv('footer')) ?? (await cmsDb.getKv('footer'));
    return deepMerge(DEFAULT_FOOTER, stored || {});
  },

  async saveFooter(adminId, patch) {
    await assertAdmin(adminId);
    const current = await this.getFooter();
    const next = deepMerge(current, patch);
    await remoteSetKv('footer', next, adminId);
    await cmsDb.setKv('footer', next);
    return next;
  },

  async getSeo() {
    const stored = (await remoteGetKv('seo')) ?? (await cmsDb.getKv('seo'));
    return deepMerge(DEFAULT_SEO, stored || {});
  },

  async getSeoForPath(path) {
    const all = await this.getSeo();
    return all[path] || null;
  },

  async saveSeo(adminId, patch) {
    await assertAdmin(adminId);
    const current = await this.getSeo();
    const next = deepMerge(current, patch);
    await remoteSetKv('seo', next, adminId);
    await cmsDb.setKv('seo', next);
    return next;
  },

  async saveSeoPage(adminId, path, patch) {
    await assertAdmin(adminId);
    const all = await this.getSeo();
    const next = deepMerge(all, { [path]: deepMerge(all[path] || {}, patch) });
    await remoteSetKv('seo', next, adminId);
    await cmsDb.setKv('seo', next);
    return next;
  },

  defaults: {
    settings: DEFAULT_SETTINGS,
    pages: DEFAULT_PAGES,
    seo: DEFAULT_SEO,
    footer: DEFAULT_FOOTER,
  },
};
