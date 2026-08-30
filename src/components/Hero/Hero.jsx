import { Link } from 'react-router-dom';
import { CMS_PAGES } from '../../services/cmsService';
import { useCmsPage } from '../../hooks/useCms';
import './Hero.css';

export default function Hero({ stats = { paid: 0, free: 0, total: 0 } }) {
  const { data: cms } = useCmsPage(CMS_PAGES.HOME);
  const hero = cms?.hero || {};

  const title = hero.title || 'Водоёмы и места для рыбалки в Пермском крае';
  const description =
    hero.description ||
    (stats.total > 0
      ? `В каталоге ${stats.total} водоёмов: ${stats.paid} платных и ${stats.free} бесплатных. Карта, отчёты рыбаков и лунный календарь.`
      : hero.descriptionFallback ||
        'Найдите платный водоём или бесплатное место, спланируйте поездку и читайте отчёты местных рыбаков.');

  const image = hero.image || '/img/hero/header-img.jpeg';
  const showStats = hero.showStats !== false;

  return (
    <section className="hero" id="home">
      <div className="hero__inner section-inner">
        <div className="hero__main">
          <h1 className="hero__title">{title}</h1>
          <p className="hero__lead">{description}</p>

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

          <div className="hero__actions">
            <Link to={hero.ctaPrimary?.url || '/map'} className="btn btn--primary">
              {hero.ctaPrimary?.label || 'Открыть карту'}
            </Link>
            <Link to={hero.ctaSecondary?.url || '/paid-waters'} className="btn btn--secondary">
              {hero.ctaSecondary?.label || 'Платные водоёмы'}
            </Link>
            <Link to={hero.ctaTertiary?.url || '/free-waters'} className="btn btn--ghost">
              {hero.ctaTertiary?.label || 'Бесплатные'}
            </Link>
          </div>
        </div>

        <figure className="hero__figure">
          <img src={image} alt="Природа Пермского края" width={560} height={380} />
        </figure>
      </div>
    </section>
  );
}
