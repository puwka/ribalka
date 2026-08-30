import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { basesService } from '../services/basesService';
import { reportSocialService } from '../services/reportSocialService';
import { useAuth } from '../components/auth/AuthContext';
import { favoritesService } from '../services/favoritesService';
import { formatPaidPrice, enrichWaterItem } from '../lib/waterUtils';
import BookingForm from '../components/booking/BookingForm';
import './BaseDetailPage.css';

export default function BaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, refresh } = useAuth();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  const [reports, setReports] = useState([]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    basesService
      .getPublic(id)
      .then(async (row) => {
        if (!alive) return;
        if (!row) {
          setError('Водоём не найден');
          setItem(null);
          return;
        }
        const enriched = enrichWaterItem(row);
        setItem(enriched);
        if (user?.id) {
          const type = row.type === 'free' ? 'place' : 'base';
          setFavorited(await favoritesService.isFavorite(user.id, type, row.id));
        }
        const allReports = await reportSocialService.list({ status: 'approved' });
        if (alive) {
          setReports(
            (allReports || [])
              .filter((r) => String(r.baseId) === String(id))
              .slice(0, 5)
          );
        }
      })
      .catch((err) => {
        if (alive) setError(err.message || 'Ошибка загрузки');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [id, user?.id]);

  const toggleFavorite = async () => {
    if (!isAuthenticated || !user) {
      navigate('/login', { state: { from: `/waters/${id}` } });
      return;
    }
    try {
      const result = await favoritesService.toggleBaseOrPlace(user.id, item);
      setFavorited(result.favorited);
      await refresh();
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return (
      <div className="water-detail water-detail--loading">
        <div className="section-inner">
          <div className="water-detail__skeleton-hero" />
          <div className="water-detail__skeleton-body">
            <div className="skeleton-line" />
            <div className="skeleton-line skeleton-line--short" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="section-inner">
          <div className="state-block">
          <h1 className="state-block__title">Водоём не найден</h1>
          <p className="state-block__text">{error || 'Проверьте ссылку или вернитесь к каталогу.'}</p>
          <Link to="/map" className="btn btn--primary">
            К карте водоёмов
          </Link>
        </div>
      </div>
    );
  }

  const images = item.images?.length ? item.images : [];
  const mapUrl =
    item.coords &&
    `https://yandex.ru/maps/?pt=${item.coords.split(',').reverse().join(',')}&z=12&l=map`;

  return (
    <article className="water-detail">
      <div className="water-detail__hero">
        {images.length > 0 ? (
          <>
            <img
              src={images[activeImg]}
              alt={item.name}
              className="water-detail__hero-img"
              onError={(e) => {
                e.currentTarget.classList.add('is-broken');
              }}
            />
            {images.length > 1 && (
              <div className="water-detail__thumbs">
                {images.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    className={`water-detail__thumb ${i === activeImg ? 'is-active' : ''}`}
                    onClick={() => setActiveImg(i)}
                  >
                    <img src={src} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="water-detail__hero-placeholder">
            <p>{item.name}</p>
          </div>
        )}
      </div>

      <div className="section-inner water-detail__layout">
        <header className="water-detail__head">
          <div className="water-detail__breadcrumbs">
            <Link to="/">Главная</Link>
            <span>/</span>
            <Link to={item.type === 'free' ? '/free-waters' : '/paid-waters'}>
              {item.type === 'free' ? 'Бесплатные водоёмы' : 'Платные водоёмы'}
            </Link>
          </div>
          <div className="water-detail__title-row">
            <div>
              <p className={`water-detail__type water-detail__type--${item.type}`}>
                {item.type === 'free' ? 'Бесплатный водоём' : 'Платный водоём'}
                {item.region && ` · ${item.region}`}
              </p>
              <h1>{item.name}</h1>
              {item.short && <p className="water-detail__lead">{item.short}</p>}
            </div>
            <div className="water-detail__actions">
              <button
                type="button"
                className={`btn btn--secondary ${favorited ? 'is-active' : ''}`}
                onClick={toggleFavorite}
              >
                {favorited ? 'В избранном' : 'В избранное'}
              </button>
              {mapUrl && (
                <a href={mapUrl} target="_blank" rel="noopener noreferrer" className="btn btn--ghost">
                  На карте
                </a>
              )}
            </div>
          </div>
        </header>

        <div className="water-detail__grid">
          <div className="water-detail__main">
            {item.type === 'paid' && (
              <div className="water-detail__price-block">{formatPaidPrice(item)}</div>
            )}
            {item.type === 'free' && (
              <div className="water-detail__price-block water-detail__price-block--free">
                Бесплатная рыбалка
              </div>
            )}

            <section className="water-detail__section">
              <h2>Описание</h2>
              <p>{item.description}</p>
            </section>

            {item.fish && (
              <section className="water-detail__section">
                <h2>Виды рыб</h2>
                <p>{item.fish}</p>
              </section>
            )}

            {item.services?.length > 0 && (
              <section className="water-detail__section">
                <h2>Услуги и инфраструктура</h2>
                <ul className="water-detail__tags">
                  {item.services.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </section>
            )}

            {item.howToGet && (
              <section className="water-detail__section">
                <h2>Как добраться</h2>
                <p>{item.howToGet}</p>
                {item.transport && <p className="water-detail__muted">Транспорт: {item.transport}</p>}
              </section>
            )}

            {reports.length > 0 && (
              <section className="water-detail__section">
                <h2>Последние отчёты</h2>
                <ul className="water-detail__reports">
                  {reports.map((r) => (
                    <li key={r.id}>
                      <Link to={`/reports/${r.id}`}>
                        <strong>{r.place || r.author}</strong>
                        <span>{r.date}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link to="/reports" className="btn btn--ghost">
                  Все отчёты →
                </Link>
              </section>
            )}
          </div>

          <aside className="water-detail__aside">
            <div className="water-detail__info-card">
              <h3>Контакты и режим</h3>
              {item.address && (
                <div className="water-detail__info-row">
                  <span>Адрес</span>
                  <strong>{item.address}</strong>
                </div>
              )}
              {item.phone && (
                <div className="water-detail__info-row">
                  <span>Телефон</span>
                  <a href={`tel:${item.phone.replace(/\s/g, '')}`}>{item.phone}</a>
                </div>
              )}
              {item.workHours && (
                <div className="water-detail__info-row">
                  <span>Режим</span>
                  <strong>{item.workHours}</strong>
                </div>
              )}
              {item.weather && (
                <div className="water-detail__info-row">
                  <span>Примечание</span>
                  <strong>{item.weather}</strong>
                </div>
              )}
            </div>

            {item.type === 'paid' && item.ownerId && item.ownerId !== 'catalog-seed' && (
              <div className="water-detail__booking">
                <h3>Бронирование</h3>
                <BookingForm base={item} />
              </div>
            )}

            <Link to="/map" className="btn btn--primary water-detail__map-btn">
              Смотреть на карте
            </Link>
          </aside>
        </div>
      </div>
    </article>
  );
}
