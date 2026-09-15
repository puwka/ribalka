import { Link } from 'react-router-dom';
import { CMS_PAGES } from '../../services/cmsService';
import { useCmsPage } from '../../hooks/useCms';
import './Hero.css';

const DEFAULT_HERO_TITLE = 'Активный отдых и рыбалка в Пермском крае';
const DEFAULT_HERO_LEAD =
  'Платные базы с комфортом и дикие водоёмы с невероятной природой. Найдите своё место для незабываемого отдыха на природе в сердце Урала.';

const LEGACY_HERO_TITLES = new Set([
  'Водоёмы и места для рыбалки в Пермском крае',
]);

function IconPaid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 9.5h16v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-9Z"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M4 9.5 6.2 5.8A2 2 0 0 1 7.9 5h8.2a2 2 0 0 1 1.7.8L20 9.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M12 13.5v3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

function IconFree() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 14c2.2-1 3.8-2.8 4.6-5 .7 1.2 1.8 2.2 3.2 2.8C13.5 9.2 16 6.8 20 5c-.7 3.6-2.5 6.6-5.4 8.9-1.4 1.1-3 1.9-4.8 2.4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 18.5c1.5.4 3 .6 4.6.6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 21s6.5-5.4 6.5-11a6.5 6.5 0 1 0-13 0c0 5.6 6.5 11 6.5 11Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.25" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

function IconShop() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 9h14l-1 11H6L5 9Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9 9V7a3 3 0 0 1 6 0v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconService() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14.7 6.3a4 4 0 0 0-5.4 5.4L4 17v3h3l5.3-5.3a4 4 0 0 0 5.4-5.4l-2.2 2.2-1.8-.4-.4-1.8 2.2-2.2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGuide() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 19.5c1.2-3 3.5-4.5 6.5-4.5s5.3 1.5 6.5 4.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

const STAT_TILES = [
  { key: 'paid', label: 'Платных', to: '/paid-waters', Icon: IconPaid },
  { key: 'free', label: 'Бесплатных', to: '/free-waters', Icon: IconFree },
  { key: 'total', label: 'На карте', to: '/map', Icon: IconMap },
  { key: 'shops', label: 'Магазины', to: '/directory/shops', Icon: IconShop },
  { key: 'services', label: 'Сервисы', to: '/directory/services', Icon: IconService },
  { key: 'guides', label: 'Гиды', to: '/directory/guides', Icon: IconGuide },
];

export default function Hero({
  stats = { paid: 0, free: 0, total: 0, shops: 0, services: 0, guides: 0 },
}) {
  const { data: cms } = useCmsPage(CMS_PAGES.HOME);
  const hero = cms?.hero || {};

  const rawTitle = hero.title || '';
  const title =
    !rawTitle || LEGACY_HERO_TITLES.has(rawTitle) ? DEFAULT_HERO_TITLE : rawTitle;

  const rawLead = (hero.description || hero.descriptionFallback || '').trim();
  const description =
    !rawLead ||
    rawLead.startsWith('В каталоге') ||
    rawLead.startsWith('Найдите платный водоём')
      ? DEFAULT_HERO_LEAD
      : rawLead;

  const image = hero.image || '/img/hero/header-img.jpeg';
  const showStats = hero.showStats !== false;

  const primaryLabel = hero.ctaPrimary?.label || 'Платные водоёмы';
  const primaryUrl = hero.ctaPrimary?.url || '/paid-waters';
  const secondaryLabel = hero.ctaSecondary?.label || 'Бесплатные места';
  const secondaryUrl = hero.ctaSecondary?.url || '/free-waters';

  const hasAnyStat = STAT_TILES.some((tile) => Number(stats[tile.key]) > 0);

  return (
    <section className="hero" id="home">
      <div className="hero__inner section-inner section-inner--wide">
        <div className="hero__main">
          <h1 className="hero__title">{title}</h1>
          <p className="hero__lead">{description}</p>

          <div className="hero__actions">
            <Link to={primaryUrl} className="btn btn--primary">
              {primaryLabel}
            </Link>
            <Link to={secondaryUrl} className="btn btn--secondary">
              {secondaryLabel}
            </Link>
          </div>

          {showStats && hasAnyStat && (
            <div className="hero__stats" role="list" aria-label="Статистика каталога">
              {STAT_TILES.map(({ key, label, to, Icon }) => (
                <Link key={key} to={to} role="listitem" className="hero-stat">
                  <span className="hero-stat__icon">
                    <Icon />
                  </span>
                  <span className="hero-stat__text">
                    <span className="hero-stat__value">{Number(stats[key]) || 0}</span>
                    <span className="hero-stat__label">{label}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <figure className="hero__figure">
          <img src={image} alt="Природа Пермского края" width={640} height={480} />
        </figure>
      </div>
    </section>
  );
}
