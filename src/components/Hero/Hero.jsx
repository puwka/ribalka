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
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 3c-1.8 3.2-5 5.4-8.5 6.2.6 4.8 3.7 9 8.5 11.3 4.8-2.3 7.9-6.5 8.5-11.3C17 8.4 13.8 6.2 12 3z"
      />
    </svg>
  );
}

function IconFree() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 18c2.5-1.2 4.2-3.5 5-6.2.6 1.4 1.7 2.6 3.1 3.4C13.5 11 16 8.2 20 6c-.8 4.2-2.8 7.6-6 10.2-1.5 1.2-3.3 2.1-5.3 2.6C6.7 19.2 5.2 18.7 4 18z"
      />
    </svg>
  );
}

function IconMap() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7zm0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5z"
      />
    </svg>
  );
}

function IconShop() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4 7h16l-1.2 12.2A2 2 0 0 1 16.81 21H7.19a2 2 0 0 1-1.99-1.8L4 7zm3.5-4h9l1 2H6.5l1-2z"
      />
    </svg>
  );
}

function IconService() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.1 12.6a7.5 7.5 0 0 0 .1-1.2 7.5 7.5 0 0 0-.1-1.2l2-1.6-1.9-3.3-2.4 1a7.7 7.7 0 0 0-2.1-1.2l-.4-2.6H9.7l-.4 2.6a7.7 7.7 0 0 0-2.1 1.2l-2.4-1-1.9 3.3 2 1.6a7.5 7.5 0 0 0-.1 1.2c0 .4 0 .8.1 1.2l-2 1.6 1.9 3.3 2.4-1c.6.5 1.3.9 2.1 1.2l.4 2.6h4.6l.4-2.6c.8-.3 1.5-.7 2.1-1.2l2.4 1 1.9-3.3-2-1.6zM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5z"
      />
    </svg>
  );
}

function IconGuide() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-3.3 0-8 1.7-8 5v1h16v-1c0-3.3-4.7-5-8-5z"
      />
    </svg>
  );
}

const STAT_TILES = [
  {
    key: 'paid',
    label: 'Платных',
    to: '/paid-waters',
    tone: 'paid',
    Icon: IconPaid,
  },
  {
    key: 'free',
    label: 'Бесплатных',
    to: '/free-waters',
    tone: 'free',
    Icon: IconFree,
  },
  {
    key: 'total',
    label: 'На карте',
    to: '/map',
    tone: 'map',
    Icon: IconMap,
  },
  {
    key: 'shops',
    label: 'Магазины',
    to: '/directory/shops',
    tone: 'shop',
    Icon: IconShop,
  },
  {
    key: 'services',
    label: 'Сервисы',
    to: '/directory/services',
    tone: 'service',
    Icon: IconService,
  },
  {
    key: 'guides',
    label: 'Гиды',
    to: '/directory/guides',
    tone: 'guide',
    Icon: IconGuide,
  },
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
              {STAT_TILES.map(({ key, label, to, tone, Icon }) => (
                <Link
                  key={key}
                  to={to}
                  role="listitem"
                  className={`hero-stat hero-stat--${tone}`}
                >
                  <span className="hero-stat__icon">
                    <Icon />
                  </span>
                  <span className="hero-stat__value">{Number(stats[key]) || 0}</span>
                  <span className="hero-stat__label">{label}</span>
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
