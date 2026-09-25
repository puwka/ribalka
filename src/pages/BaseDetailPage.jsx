import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { basesService } from '../services/basesService';
import { reportSocialService } from '../services/reportSocialService';
import { useAuth } from '../components/auth/AuthContext';
import { favoritesService } from '../services/favoritesService';
import { analyticsTracker } from '../services/ownerDashboardService';
import {
  formatPaidPrice,
  enrichWaterItem,
  getBaseWebLinks,
  getPrimarySiteUrl,
} from '../lib/waterUtils';
import RichText from '../components/ui/RichText';
import { toYandexCoords } from '../lib/coords';
import { useToast } from '../components/ui/ToastContext';
import { normalizeVideoList } from '../lib/videoEmbed';
import { reviewsService } from '../services/reviewsService';
import ImageLightbox from '../components/ui/ImageLightbox';
import './BaseDetailPage.css';

export default function BaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, refresh, profile } = useAuth();
  const { showToast } = useToast();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [activeVideo, setActiveVideo] = useState(0);
  const [reports, setReports] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ name: '', text: '', rating: 0 });
  const [reviewSaving, setReviewSaving] = useState(false);
  const viewedRef = useRef(null);

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
        setActiveImg(0);
        setActiveVideo(0);
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
        try {
          const rev = await reviewsService.listByTarget(id);
          if (alive) setReviews(rev || []);
        } catch {
          if (alive) setReviews([]);
        }
        if (alive && profile?.display_name) {
          setReviewForm((f) => ({ ...f, name: f.name || profile.display_name }));
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
  }, [id, user?.id, profile?.display_name]);

  useEffect(() => {
    if (!item?.id) return;
    const key = String(item.id);
    if (viewedRef.current === key) return;
    viewedRef.current = key;
    void analyticsTracker.trackView(item);
  }, [item?.id]);

  const submitReview = async (e) => {
    e.preventDefault();
    if (!reviewForm.name.trim() || !reviewForm.text.trim() || !reviewForm.rating) {
      showToast('Заполните имя, текст и оценку');
      return;
    }
    setReviewSaving(true);
    try {
      await reviewsService.create({
        targetId: item.id,
        targetName: item.name,
        authorName: reviewForm.name.trim(),
        body: reviewForm.text.trim(),
        rating: reviewForm.rating,
        userId: user?.id || null,
      });
      setReviewForm((f) => ({ ...f, text: '', rating: 0 }));
      showToast('Отзыв отправлен на модерацию');
    } catch (err) {
      showToast(err.message || 'Не удалось отправить отзыв');
    } finally {
      setReviewSaving(false);
    }
  };

  const toggleFavorite = async () => {
    if (!isAuthenticated || !user) {
      navigate('/login', { state: { from: `/waters/${id}` } });
      return;
    }
    try {
      const result = await favoritesService.toggleBaseOrPlace(user.id, item);
      setFavorited(result.favorited);
      await refresh();
      if (result.favorited) {
        showToast(`«${item.name}» добавлено в избранное`);
      } else {
        showToast(`«${item.name}» убрано из избранного`, { type: 'info' });
      }
    } catch (err) {
      showToast(err.message || 'Не удалось изменить избранное', { type: 'error' });
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
  const videos = normalizeVideoList(item.videos?.length ? item.videos : item.video ? [item.video] : []);
  const webLinks = getBaseWebLinks(item);
  const siteUrl = getPrimarySiteUrl(item);
  const yandexPt = toYandexCoords(item);
  const mapUrl =
    yandexPt &&
    `https://yandex.ru/maps/?pt=${yandexPt[1]},${yandexPt[0]}&z=12&l=map`;

  return (
    <article className="water-detail">
      <ImageLightbox
        images={images}
        index={lightboxIndex}
        alt={item.name}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={(next) => {
          setLightboxIndex(next);
          setActiveImg(next);
        }}
      />

      <div className="water-detail__hero">
        {images.length > 0 ? (
          <>
            <button
              type="button"
              className="water-detail__hero-open"
              onClick={() => setLightboxIndex(activeImg)}
              aria-label="Открыть фото"
            >
              <img
                src={images[activeImg]}
                alt={item.name}
                className="water-detail__hero-img"
                onError={(e) => {
                  e.currentTarget.classList.add('is-broken');
                }}
              />
            </button>
            {images.length > 1 && (
              <div className="water-detail__thumbs">
                {images.map((src, i) => (
                  <button
                    key={src + i}
                    type="button"
                    className={`water-detail__thumb ${i === activeImg ? 'is-active' : ''}`}
                    onClick={() => {
                      setActiveImg(i);
                      setLightboxIndex(i);
                    }}
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
            <Link to={item.type === 'free' ? '/free-waters' : item.type === 'paid_fishing' ? '/paid-fishing' : '/paid-waters'}>
              {item.type === 'free' ? 'Бесплатные водоёмы' : 'Базы отдыха и водоёмы'}
            </Link>
          </div>
          <div className="water-detail__title-row">
            <div>
              <p className={`water-detail__type water-detail__type--${item.type}`}>
                {item.type === 'free' ? 'Бесплатный водоём' : 'Платный водоём'}
                {item.region && ` · ${item.region}`}
              </p>
              <h1>{item.name}</h1>
              {(item.publishedAt || item.published_at) && (
                <p className="water-detail__published">
                  Дата публикации:{' '}
                  {new Date(item.publishedAt || item.published_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              )}
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
                <a
                  href={mapUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--ghost"
                  onClick={() => analyticsTracker.trackClick(item, 'map')}
                >
                  На карте
                </a>
              )}
              {siteUrl && (
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn--ghost"
                  onClick={() => analyticsTracker.trackClick(item, 'website')}
                >
                  На сайт
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
              <RichText value={item.description} className="water-detail__description" />
            </section>

            {videos.length > 0 && (
              <section className="water-detail__section">
                <h2>Видео</h2>
                <div className="water-detail__video">
                  <div className="water-detail__video-frame">
                    <iframe
                      src={videos[activeVideo]}
                      title={`Видео: ${item.name}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                  {videos.length > 1 && (
                    <div className="water-detail__video-tabs">
                      {videos.map((_, i) => (
                        <button
                          key={videos[i] + i}
                          type="button"
                          className={`water-detail__video-tab${i === activeVideo ? ' is-active' : ''}`}
                          onClick={() => setActiveVideo(i)}
                        >
                          Видео {i + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

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

            <section className="water-detail__section">
              <h2>Отзывы</h2>
              {reviews.length === 0 ? (
                <p className="water-detail__muted">Пока нет одобренных отзывов — будьте первым.</p>
              ) : (
                <ul className="water-detail__reviews">
                  {reviews.map((r) => (
                    <li key={r.id} className="water-detail__review">
                      <div className="water-detail__review-head">
                        <strong>{r.author_name}</strong>
                        <span>{'★'.repeat(r.rating || 0)}</span>
                      </div>
                      <p>{r.body}</p>
                    </li>
                  ))}
                </ul>
              )}
              <form className="water-detail__review-form" onSubmit={submitReview}>
                <h3>Оставить отзыв</h3>
                <label>
                  Имя
                  <input
                    value={reviewForm.name}
                    onChange={(e) => setReviewForm((f) => ({ ...f, name: e.target.value }))}
                    required
                  />
                </label>
                <div className="water-detail__stars" role="group" aria-label="Оценка">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={reviewForm.rating >= n ? 'is-active' : ''}
                      onClick={() => setReviewForm((f) => ({ ...f, rating: n }))}
                    >
                      ★
                    </button>
                  ))}
                </div>
                <label>
                  Текст отзыва
                  <textarea
                    rows={3}
                    value={reviewForm.text}
                    onChange={(e) => setReviewForm((f) => ({ ...f, text: e.target.value }))}
                    required
                  />
                </label>
                <button type="submit" className="btn btn--primary" disabled={reviewSaving}>
                  {reviewSaving ? 'Отправка…' : 'Отправить на модерацию'}
                </button>
              </form>
            </section>
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
                  <a
                    href={`tel:${item.phone.replace(/\s/g, '')}`}
                    onClick={() => analyticsTracker.trackClick(item, 'phone')}
                  >
                    {item.phone}
                  </a>
                </div>
              )}
              {webLinks.website && (
                <div className="water-detail__info-row">
                  <span>Сайт</span>
                  <a
                    href={webLinks.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => analyticsTracker.trackClick(item, 'website')}
                  >
                    Перейти
                  </a>
                </div>
              )}
              {webLinks.vk && (
                <div className="water-detail__info-row">
                  <span>ВКонтакте</span>
                  <a
                    href={webLinks.vk}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => analyticsTracker.trackClick(item, 'website')}
                  >
                    Перейти
                  </a>
                </div>
              )}
              {webLinks.telegram && (
                <div className="water-detail__info-row">
                  <span>Telegram</span>
                  <a
                    href={webLinks.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => analyticsTracker.trackClick(item, 'website')}
                  >
                    Перейти
                  </a>
                </div>
              )}
              {webLinks.max && (
                <div className="water-detail__info-row">
                  <span>MAX</span>
                  <a
                    href={webLinks.max}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => analyticsTracker.trackClick(item, 'website')}
                  >
                    Перейти
                  </a>
                </div>
              )}
              {webLinks.other && (
                <div className="water-detail__info-row">
                  <span>Соцсеть</span>
                  <a
                    href={webLinks.other}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => analyticsTracker.trackClick(item, 'website')}
                  >
                    Перейти
                  </a>
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

            <Link to="/map" className="btn btn--primary water-detail__map-btn">
              Смотреть на карте
            </Link>
          </aside>
        </div>
      </div>
    </article>
  );
}
