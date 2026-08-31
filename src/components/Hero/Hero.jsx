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

export default function Hero({ stats = { paid: 0, free: 0, total: 0 } }) {
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

          {showStats && stats.total > 0 && (
            <dl className="hero__stats">
              <div>
                <dt>Платных</dt>
                <dd>{stats.paid}</dd>
              </div>
              <div>
                <dt>Бесплатных</dt>
                <dd>{stats.free}</dd>
              </div>
              <div>
                <dt>На карте</dt>
                <dd>{stats.total}</dd>
              </div>
            </dl>
          )}
        </div>

        <figure className="hero__figure">
          <img src={image} alt="Природа Пермского края" width={640} height={480} />
        </figure>
      </div>
    </section>
  );
}
