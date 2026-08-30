import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import Hero from '../components/Hero/Hero';
import WatersHomeSection from '../components/home/WatersHomeSection';
import News from '../components/News/News';
import { catalogStats } from '../lib/catalogSeed';
import { CMS_PAGES } from '../services/cmsService';
import { useCmsPage } from '../hooks/useCms';
import './HomePage.css';

export default function HomePage() {
  const stats = useMemo(() => catalogStats(), []);
  const { data: cms } = useCmsPage(CMS_PAGES.HOME);
  const blocks = cms?.blocks || {};

  const showNav = blocks.navStrip?.enabled !== false;
  const showWaters = blocks.watersSection?.enabled !== false;
  const showNews = blocks.newsSection?.enabled !== false;
  const showCta = blocks.cta?.enabled !== false;
  const cta = blocks.cta || {};

  return (
    <div className="home-page">
      <Hero stats={stats} />

      {showNav && (
        <nav className="home-nav" aria-label="Разделы сервиса">
          <div className="section-inner home-nav__inner">
            <Link to="/map" className="home-nav__item">
              <span className="home-nav__label">Карта водоёмов</span>
              <span className="home-nav__meta">{stats.total} мест</span>
            </Link>
            <Link to="/paid-waters" className="home-nav__item">
              <span className="home-nav__label">Платные водоёмы</span>
              <span className="home-nav__meta">{stats.paid} объектов</span>
            </Link>
            <Link to="/free-waters" className="home-nav__item">
              <span className="home-nav__label">Бесплатные водоёмы</span>
              <span className="home-nav__meta">{stats.free} объектов</span>
            </Link>
            <Link to="/reports" className="home-nav__item">
              <span className="home-nav__label">Отчёты рыбаков</span>
              <span className="home-nav__meta">Сообщество</span>
            </Link>
          </div>
        </nav>
      )}

      {showWaters && <WatersHomeSection />}

      {showNews && <News />}

      {showCta && (
        <section className="home-cta">
          <div className="section-inner home-cta__inner">
            <div className="home-cta__text">
              <h2>{cta.title || 'Планируете рыбалку в Пермском крае?'}</h2>
              <p>
                {cta.description ||
                  'Соберите маршрут на карте, выберите водоём и сохраните понравившиеся места в избранное.'}
              </p>
            </div>
            <div className="home-cta__actions">
              {(cta.actions || [
                { label: 'Карта', url: '/map' },
                { label: 'Платные', url: '/paid-waters' },
                { label: 'Бесплатные', url: '/free-waters' },
              ]).map((action, i) => (
                <Link
                  key={action.url}
                  to={action.url}
                  className={i === 0 ? 'btn btn--primary' : 'btn btn--secondary'}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
