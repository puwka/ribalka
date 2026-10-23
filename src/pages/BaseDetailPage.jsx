import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { basesService } from '../services/basesService';
import { reportSocialService } from '../services/reportSocialService';
import { useAuth } from '../components/auth/AuthContext';
import { favoritesService } from '../services/favoritesService';
import { analyticsTracker } from '../services/ownerDashboardService';
import {
  catalogPathForWaterType,
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
import BookingForm from '../components/booking/BookingForm';
import WaterDetailIcon from '../components/waters/WaterDetailIcon';
import {
  getDetailAmenities,
  getDetailAtmosphereImage,
  getDetailConditions,
  getDetailHighlights,
  getDetailPhotos,
  getDetailPrice,
  getDetailTravel,
  getTelHref,
  getWaterTypeLabel,
  getWaterTypeModifier,
} from '../lib/waterDetail';
import './BaseDetailPage.css';

const DEFAULT_DETAIL_BG = '/img/details/detail-sunset.jpg';
const PHOTO_FALLBACK = '/img/details/detail-lake.jpg';

const CATALOG_LABELS = {
  paid: 'Платные базы',
  paid_fishing: 'Платная рыбалка',
  free: 'Где порыбачить',
};

function plural(count, one, few, many) {
  const n = Math.abs(Number(count) || 0) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

function formatReviewDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function SectionHead({ icon, title, action }) {
  return (
    <div className="water-detail__section-head">
      <h2 className="water-detail__section-title">
        <WaterDetailIcon name={icon} size={17} />
        <span>{title}</span>
      </h2>
      {action}
    </div>
  );
}

function MapAction({ mapUrl, className, children, onClick }) {
  if (mapUrl) {
    return (
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={onClick}
      >
        {children}
      </a>
    );
  }

  return (
    <Link to="/map" className={className} onClick={onClick}>
      {children}
    </Link>
  );
}

function SafePhoto({ src, alt, className, fallback = PHOTO_FALLBACK, loading = 'lazy' }) {
  const [currentSrc, setCurrentSrc] = useState(src || fallback);

  useEffect(() => {
    setCurrentSrc(src || fallback);
  }, [src, fallback]);

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => {
        if (currentSrc !== fallback) setCurrentSrc(fallback);
      }}
    />
  );
}

export default function BaseDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, refresh, profile } = useAuth();
  const { showToast } = useToast();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [favorited, setFavorited] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const [activeVideo, setActiveVideo] = useState(0);
  const [reports, setReports] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [reviewForm, setReviewForm] = useState({ name: '', text: '', rating: 0 });
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [requisitesOpen, setRequisitesOpen] = useState(false);
  const viewedRef = useRef(null);
  const reviewsRef = useRef(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    setFavorited(false);
    setReports([]);
    setReviews([]);
    setLightboxIndex(null);
    setBookingOpen(false);
    setContactOpen(false);
    setReviewFormOpen(false);
    setRequisitesOpen(false);

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
        setActiveVideo(0);
        if (user?.id) {
          try {
            const type = row.type === 'free' ? 'place' : 'base';
            const isFavorite = await favoritesService.isFavorite(user.id, type, row.id);
            if (alive) setFavorited(isFavorite);
          } catch {
            if (alive) setFavorited(false);
          }
        }
        try {
          const allReports = await reportSocialService.list({ status: 'approved' });
          if (alive) {
            setReports(
              (allReports || [])
                .filter((report) => String(report.baseId) === String(id))
                .slice(0, 5)
            );
          }
        } catch {
          if (alive) setReports([]);
        }
        try {
          const rev = await reviewsService.listByTarget(id);
          if (alive) setReviews(rev || []);
        } catch {
          if (alive) setReviews([]);
        }
        if (alive && profile?.display_name) {
          setReviewForm((form) => ({ ...form, name: form.name || profile.display_name }));
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

  useEffect(() => {
    if (!bookingOpen && !contactOpen) return undefined;

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setBookingOpen(false);
        setContactOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [bookingOpen, contactOpen]);

  const submitReview = async (event) => {
    event.preventDefault();
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
      setReviewForm((form) => ({ ...form, text: '', rating: 0 }));
      setReviewFormOpen(false);
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
      <div
        className="water-detail water-detail--loading"
        style={{ '--water-detail-bg': `url("${DEFAULT_DETAIL_BG}")` }}
      >
        <div className="water-detail__atmosphere" aria-hidden="true" />
        <div className="water-detail__sheet" aria-busy="true" aria-label="Загрузка карточки">
          <div className="water-detail__skeleton-topline">
            <div className="skeleton-line water-detail__skeleton-crumbs" />
            <div className="skeleton-line water-detail__skeleton-favorite" />
          </div>
          <div className="water-detail__skeleton-grid">
            <div className="water-detail__skeleton-main">
              <div className="skeleton-line water-detail__skeleton-badge" />
              <div className="skeleton-line water-detail__skeleton-title" />
              <div className="skeleton-line water-detail__skeleton-subtitle" />
              <div className="skeleton-line water-detail__skeleton-lead" />
              <div className="water-detail__skeleton-highlights">
                {Array.from({ length: 4 }, (_, index) => (
                  <div key={index} className="skeleton-line water-detail__skeleton-highlight" />
                ))}
              </div>
              <div className="skeleton-line water-detail__skeleton-text" />
              <div className="skeleton-line water-detail__skeleton-text skeleton-line--short" />
            </div>
            <div className="water-detail__skeleton-side">
              <div className="skeleton-line water-detail__skeleton-price" />
              <div className="skeleton-line water-detail__skeleton-panel" />
              <div className="skeleton-line water-detail__skeleton-button" />
              <div className="skeleton-line water-detail__skeleton-button" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div
        className="water-detail water-detail--error"
        style={{ '--water-detail-bg': `url("${DEFAULT_DETAIL_BG}")` }}
      >
        <div className="water-detail__atmosphere" aria-hidden="true" />
        <div className="water-detail__sheet">
          <div className="state-block water-detail__state">
            <h1 className="state-block__title">Водоём не найден</h1>
            <p className="state-block__text">
              {error && error !== 'Водоём не найден'
                ? error
                : 'Проверьте ссылку или вернитесь к каталогу.'}
            </p>
            <Link to="/map" className="btn btn--primary">
              К карте водоёмов
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const typeModifier = getWaterTypeModifier(item);
  const typeLabel = getWaterTypeLabel(item);
  const categoryPath = catalogPathForWaterType(item.type);
  const categoryLabel = CATALOG_LABELS[item.type] || 'Все базы и водоёмы';
  const photos = getDetailPhotos(item);
  const atmosphere = getDetailAtmosphereImage(item);
  const price = getDetailPrice(item);
  const conditions = getDetailConditions(item);
  const highlights = getDetailHighlights(item);
  const amenities = getDetailAmenities(item);
  const travel = getDetailTravel(item);
  const videos = normalizeVideoList(
    item.videos?.length ? item.videos : item.video ? [item.video] : []
  );
  const yandexPt = toYandexCoords(item);
  const mapUrl =
    yandexPt &&
    `https://yandex.ru/maps/?pt=${yandexPt[1]},${yandexPt[0]}&z=13&l=map`;
  const phone = String(item.phone || '').trim();
  const telHref = getTelHref(phone);
  const siteUrl = getPrimarySiteUrl(item);
  const webLinks = getBaseWebLinks(item);
  const socialLinks = [
    webLinks.vk && { label: 'ВКонтакте', url: webLinks.vk },
    webLinks.telegram && { label: 'Telegram', url: webLinks.telegram },
    webLinks.max && { label: 'MAX', url: webLinks.max },
    webLinks.other && { label: 'Соцсеть', url: webLinks.other },
  ].filter((link) => link && link.url !== siteUrl);
  const hasContacts = Boolean(phone || siteUrl || socialLinks.length || item.contacts);
  const canBook = item.type !== 'free';
  const isTop = Boolean(item.isTop || item.is_top || item.top);
  const reviewsAverage = reviews.length
    ? reviews.reduce((sum, review) => sum + (Number(review.rating) || 0), 0) / reviews.length
    : 0;
  const ratingAverage = Number(item.ratingAvg ?? item.rating_avg) || reviewsAverage;
  const ratingCount = Number(item.ratingCount ?? item.rating_count) || reviews.length;
  const fishTypes = String(item.fish || '')
    .split(',')
    .map((fish) => fish.trim())
    .filter(Boolean);
  const traveledText = travel.text || '';
  const orderReviewForm = () => {
    setReviewFormOpen(true);
    window.setTimeout(() => {
      reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 40);
  };

  return (
    <article
      className="water-detail"
      style={{ '--water-detail-bg': `url("${atmosphere}")` }}
    >
      <div className="water-detail__atmosphere" aria-hidden="true" />

      <div className="water-detail__sheet">
        <div className="water-detail__topline">
          <nav className="water-detail__breadcrumbs" aria-label="Хлебные крошки">
            <Link to="/">Главная</Link>
            <span className="water-detail__crumb-sep">/</span>
            <Link to={categoryPath}>{categoryLabel}</Link>
            <span className="water-detail__crumb-sep">/</span>
            <span className="water-detail__crumb-current">{item.name}</span>
          </nav>

          <button
            type="button"
            className={`water-detail__favorite ${favorited ? 'is-active' : ''}`}
            onClick={toggleFavorite}
            aria-label={favorited ? 'Убрать из избранного' : 'Добавить в избранное'}
            aria-pressed={favorited}
            title={favorited ? 'В избранном' : 'В избранное'}
          >
            <WaterDetailIcon name="heart" size={18} />
          </button>
        </div>

        <div className="water-detail__columns">
          <div className="water-detail__primary">
            <header className="water-detail__intro">
              <div className="water-detail__badges">
                <span className={`water-detail__badge water-detail__badge--${typeModifier}`}>
                  {typeLabel}
                </span>
                {isTop && <span className="water-detail__badge water-detail__badge--top">ТОП</span>}
              </div>

              <h1 className="water-detail__title">{item.name}</h1>

              <div className="water-detail__location">
                <WaterDetailIcon name="pin" size={17} />
                <span>{item.address || item.region || 'Пермский край'}</span>
                <MapAction
                  mapUrl={mapUrl}
                  className="water-detail__map-link"
                  onClick={() => analyticsTracker.trackClick(item, 'map')}
                >
                  <WaterDetailIcon name="compass" size={14} />
                  На карте
                </MapAction>
              </div>

              {item.short && <p className="water-detail__lead">{item.short}</p>}

              <div className="water-detail__meta">
                {ratingCount > 0 && (
                  <span className="water-detail__meta-item">
                    <span className="water-detail__meta-star" aria-hidden="true">
                      ★
                    </span>
                    {ratingAverage.toFixed(1)}
                    <span className="water-detail__meta-muted">
                      · {ratingCount} {plural(ratingCount, 'отзыв', 'отзыва', 'отзывов')}
                    </span>
                  </span>
                )}
                {item.workHours && (
                  <span className="water-detail__meta-item">
                    <WaterDetailIcon name="clock" size={14} />
                    {item.workHours}
                  </span>
                )}
                {fishTypes.length > 0 && (
                  <span className="water-detail__meta-item">
                    <WaterDetailIcon name="fish" size={14} />
                    {fishTypes.slice(0, 3).join(', ')}
                  </span>
                )}
              </div>
            </header>

            <div className="water-detail__highlights" aria-label="Ключевые особенности">
              {highlights.map((highlight) => (
                <div className="water-detail__highlight" key={`${highlight.icon}-${highlight.title}`}>
                  <span className="water-detail__highlight-icon">
                    <WaterDetailIcon name={highlight.icon} size={18} />
                  </span>
                  <span className="water-detail__highlight-text">
                    <span className="water-detail__highlight-title">{highlight.title}</span>
                    {highlight.subtitle && (
                      <span className="water-detail__highlight-subtitle">
                        {highlight.subtitle}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            <section className="water-detail__section water-detail__description-section">
              <SectionHead icon="file" title="Описание" />
              {item.description ? (
                <RichText value={item.description} className="water-detail__description" />
              ) : (
                <p className="water-detail__muted">Описание пока не добавлено.</p>
              )}

              {fishTypes.length > 0 && (
                <div className="water-detail__fish">
                  <span className="water-detail__fish-label">Рыба:</span>
                  {fishTypes.map((fish) => (
                    <span className="water-detail__fish-chip" key={fish}>
                      {fish}
                    </span>
                  ))}
                </div>
              )}

              {item.features && item.services?.length > 0 && (
                <p className="water-detail__note">
                  <WaterDetailIcon name="leaf" size={15} />
                  <span>{item.features}</span>
                </p>
              )}
            </section>

            {videos.length > 0 && (
              <section className="water-detail__section water-detail__video-section">
                <SectionHead icon="video" title="Видео" />
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
                      {videos.map((video, index) => (
                        <button
                          key={`${video}-${index}`}
                          type="button"
                          className={`water-detail__video-tab ${index === activeVideo ? 'is-active' : ''}`}
                          onClick={() => setActiveVideo(index)}
                        >
                          Видео {index + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            <section className="water-detail__section water-detail__travel-section">
              <details className="water-detail__travel" open>
                <summary className="water-detail__travel-summary">
                  <span className="water-detail__section-title">
                    <WaterDetailIcon name="pin" size={17} />
                    <span>Как добраться</span>
                  </span>
                  <WaterDetailIcon
                    name="chevronDown"
                    size={17}
                    className="water-detail__travel-chevron"
                  />
                </summary>
                <div className="water-detail__travel-body">
                  {traveledText ? (
                    <RichText value={traveledText} />
                  ) : (
                    <p className="water-detail__muted">Маршрут уточняйте у базы.</p>
                  )}
                  {travel.transport && (
                    <p className="water-detail__transport">
                      <WaterDetailIcon name="car" size={15} />
                      <span>Транспорт: {travel.transport}</span>
                    </p>
                  )}
                </div>
              </details>
            </section>

            <section className="water-detail__section water-detail__photos-section">
              <SectionHead
                icon="images"
                title="Фотографии"
                action={
                  photos.length > 0 ? (
                    <button
                      type="button"
                      className="water-detail__section-link"
                      onClick={() => setLightboxIndex(0)}
                    >
                      Все фото ({photos.length})
                      <WaterDetailIcon name="arrowRight" size={14} />
                    </button>
                  ) : null
                }
              />
              {photos.length > 0 ? (
                <div className="water-detail__gallery">
                  {photos.slice(0, 4).map((photo, index) => (
                    <button
                      type="button"
                      className="water-detail__photo"
                      key={`${photo}-${index}`}
                      onClick={() => setLightboxIndex(index)}
                      aria-label={`Открыть фото ${index + 1} из ${photos.length}`}
                    >
                      <SafePhoto src={photo} alt={`${item.name} — фото ${index + 1}`} />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="water-detail__gallery-empty">
                  <WaterDetailIcon name="camera" size={20} />
                  <span>Фотографии скоро появятся</span>
                </div>
              )}
            </section>

            {reports.length > 0 && (
              <section className="water-detail__section water-detail__reports-section">
                <SectionHead
                  icon="file"
                  title="Последние отчёты"
                  action={
                    <Link to="/reports" className="water-detail__section-link">
                      Все отчёты
                      <WaterDetailIcon name="arrowRight" size={14} />
                    </Link>
                  }
                />
                <ul className="water-detail__reports">
                  {reports.map((report) => (
                    <li key={report.id}>
                      <Link to={`/reports/${report.id}`}>
                        <strong>{report.place || report.author}</strong>
                        <span>{report.date}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section
              className="water-detail__section water-detail__reviews-section"
              id="reviews"
              ref={reviewsRef}
            >
              <SectionHead
                icon="star"
                title="Отзывы"
                action={
                  <button
                    type="button"
                    className="water-detail__section-link"
                    onClick={() => {
                      if (reviews.length === 0) {
                        orderReviewForm();
                      } else {
                        reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }}
                  >
                    Все отзывы ({reviews.length})
                    <WaterDetailIcon name="arrowRight" size={14} />
                  </button>
                }
              />

              {reviews.length === 0 ? (
                <div className="water-detail__empty">
                  <span className="water-detail__empty-icon">
                    <WaterDetailIcon name="chat" size={20} />
                  </span>
                  <p className="water-detail__empty-title">Пока нет отзывов</p>
                  <p className="water-detail__empty-text">Будьте первыми, кто оставит отзыв</p>
                  {!reviewFormOpen && (
                    <button
                      type="button"
                      className="water-detail__link-btn"
                      onClick={orderReviewForm}
                    >
                      Оставить отзыв
                    </button>
                  )}
                </div>
              ) : (
                <ul className="water-detail__reviews">
                  {reviews.map((review) => (
                    <li className="water-detail__review" key={review.id}>
                      <div className="water-detail__review-head">
                        <span className="water-detail__review-author">
                          {review.author_name || 'Гость'}
                        </span>
                        <span className="water-detail__review-stars" aria-label={`Оценка ${review.rating}`}>
                          {'★'.repeat(review.rating || 0)}
                        </span>
                        {formatReviewDate(review.created_at) && (
                          <span className="water-detail__review-date">
                            {formatReviewDate(review.created_at)}
                          </span>
                        )}
                      </div>
                      <p>{review.body}</p>
                    </li>
                  ))}
                </ul>
              )}

              {reviews.length > 0 && !reviewFormOpen && (
                <button
                  type="button"
                  className="water-detail__review-cta"
                  onClick={orderReviewForm}
                >
                  <WaterDetailIcon name="chat" size={16} />
                  Оставить отзыв
                </button>
              )}

              {reviewFormOpen && (
                <form className="water-detail__review-form" onSubmit={submitReview}>
                  <div className="water-detail__review-form-head">
                    <h3>Оставить отзыв</h3>
                    <button
                      type="button"
                      className="water-detail__modal-close water-detail__modal-close--inline"
                      onClick={() => setReviewFormOpen(false)}
                      aria-label="Закрыть форму отзыва"
                    >
                      ×
                    </button>
                  </div>

                  <div className="water-detail__review-grid">
                    <label>
                      Имя
                      <input
                        value={reviewForm.name}
                        onChange={(event) =>
                          setReviewForm((form) => ({ ...form, name: event.target.value }))
                        }
                        required
                      />
                    </label>

                    <div className="water-detail__rating-input">
                      <span>Оценка</span>
                      <div className="water-detail__stars" role="group" aria-label="Оценка">
                        {[1, 2, 3, 4, 5].map((value) => (
                          <button
                            key={value}
                            type="button"
                            className={reviewForm.rating >= value ? 'is-active' : ''}
                            onClick={() =>
                              setReviewForm((form) => ({ ...form, rating: value }))
                            }
                            aria-label={`${value} из 5`}
                            aria-pressed={reviewForm.rating === value}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <label>
                    Текст отзыва
                    <textarea
                      rows={4}
                      value={reviewForm.text}
                      onChange={(event) =>
                        setReviewForm((form) => ({ ...form, text: event.target.value }))
                      }
                      required
                    />
                  </label>

                  <button
                    type="submit"
                    className="water-detail__cta water-detail__cta--primary water-detail__cta--inline"
                    disabled={reviewSaving}
                  >
                    {reviewSaving ? 'Отправка…' : 'Отправить на модерацию'}
                  </button>
                </form>
              )}
            </section>
          </div>

          <aside className="water-detail__sidebar">
            <section className="water-detail__booking" aria-label="Бронирование">
              <div className={`water-detail__price ${price.isFree ? 'is-free' : ''}`}>
                {price.prefix && <span className="water-detail__price-prefix">{price.prefix}</span>}
                <strong className="water-detail__price-amount">{price.amount}</strong>
                {price.unit && <span className="water-detail__price-unit">{price.unit}</span>}
              </div>

              <div className="water-detail__conditions">
                {conditions.map((condition) => (
                  <div className="water-detail__condition" key={condition.text}>
                    <WaterDetailIcon
                      name={condition.icon}
                      size={15}
                      className="water-detail__condition-icon"
                    />
                    <span>{condition.text}</span>
                  </div>
                ))}
              </div>

              {canBook ? (
                <>
                  <button
                    type="button"
                    className="water-detail__cta water-detail__cta--primary"
                    onClick={() => setBookingOpen(true)}
                  >
                    <WaterDetailIcon name="calendar" size={17} />
                    Забронировать
                  </button>
                  <button
                    type="button"
                    className="water-detail__cta water-detail__cta--secondary"
                    onClick={() => setContactOpen(true)}
                  >
                    <WaterDetailIcon name="chat" size={17} />
                    Задать вопрос
                  </button>
                </>
              ) : (
                <>
                  <MapAction
                    mapUrl={mapUrl}
                    className="water-detail__cta water-detail__cta--primary"
                    onClick={() => analyticsTracker.trackClick(item, 'map')}
                  >
                    <WaterDetailIcon name="map" size={17} />
                    Смотреть на карте
                  </MapAction>
                  <button
                    type="button"
                    className="water-detail__cta water-detail__cta--secondary"
                    onClick={() => setContactOpen(true)}
                  >
                    <WaterDetailIcon name="chat" size={17} />
                    Задать вопрос
                  </button>
                </>
              )}
            </section>

            <section className="water-detail__section water-detail__amenities-section">
              <SectionHead icon="check" title="Удобства" />
              {amenities.length > 0 ? (
                <ul className="water-detail__amenities">
                  {amenities.map((amenity) => (
                    <li key={amenity}>{amenity}</li>
                  ))}
                </ul>
              ) : (
                <p className="water-detail__muted">Удобства не указаны.</p>
              )}
            </section>

            <section className="water-detail__section water-detail__contacts-section">
              <SectionHead icon="phone" title="Контакты и реквизиты" />
              <div className="water-detail__contact-list">
                {phone && (
                  <a
                    href={telHref}
                    className="water-detail__contact-row"
                    onClick={() => analyticsTracker.trackClick(item, 'phone')}
                  >
                    <WaterDetailIcon name="phone" size={16} />
                    <span>{phone}</span>
                  </a>
                )}
                {siteUrl && (
                  <a
                    href={siteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="water-detail__contact-row"
                    onClick={() => analyticsTracker.trackClick(item, 'website')}
                  >
                    <WaterDetailIcon name="globe" size={16} />
                    <span>Перейти на сайт</span>
                  </a>
                )}
                {socialLinks.map((social) => (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="water-detail__contact-row"
                    onClick={() => analyticsTracker.trackClick(item, 'website')}
                  >
                    <WaterDetailIcon name="globe" size={16} />
                    <span>{social.label}</span>
                  </a>
                ))}
                {!hasContacts && (
                  <p className="water-detail__muted">Контакты пока не указаны.</p>
                )}

                {item.contacts && (
                  <div className="water-detail__requisites">
                    <button
                      type="button"
                      className="water-detail__requisites-toggle"
                      onClick={() => setRequisitesOpen((value) => !value)}
                      aria-expanded={requisitesOpen}
                    >
                      <span>
                        <WaterDetailIcon name="file" size={15} />
                        Реквизиты
                      </span>
                      <WaterDetailIcon
                        name={requisitesOpen ? 'chevronDown' : 'chevronRight'}
                        size={15}
                      />
                    </button>
                    {requisitesOpen && (
                      <div className="water-detail__requisites-box">{item.contacts}</div>
                    )}
                  </div>
                )}
              </div>

              <MapAction
                mapUrl={mapUrl}
                className="water-detail__cta water-detail__cta--primary water-detail__map-btn"
                onClick={() => analyticsTracker.trackClick(item, 'map')}
              >
                <WaterDetailIcon name="map" size={17} />
                Смотреть на карте
              </MapAction>
            </section>
          </aside>
        </div>
      </div>

      <ImageLightbox
        images={photos}
        index={lightboxIndex}
        alt={item.name}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={(next) => setLightboxIndex(next)}
      />

      {bookingOpen && (
        <div
          className="water-detail__modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setBookingOpen(false);
          }}
        >
          <div
            className="water-detail__modal-card"
            role="dialog"
            aria-modal="true"
            aria-label="Бронирование"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="water-detail__modal-close"
              onClick={() => setBookingOpen(false)}
              aria-label="Закрыть бронирование"
              autoFocus
            >
              ×
            </button>
            <BookingForm
              base={item}
              onSuccess={() => showToast('Заявка на бронь отправлена владельцу базы')}
            />
          </div>
        </div>
      )}

      {contactOpen && (
        <div
          className="water-detail__modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setContactOpen(false);
          }}
        >
          <div
            className="water-detail__modal-card water-detail__modal-card--contact"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="water-detail__modal-close"
              onClick={() => setContactOpen(false)}
              aria-label="Закрыть контакты"
              autoFocus
            >
              ×
            </button>

            <h2 id="contact-modal-title" className="water-detail__modal-heading">
              Связаться с базой
            </h2>
            <p className="water-detail__modal-lead">
              Позвоните или напишите напрямую — представитель базы ответит на вопросы.
            </p>

            <div className="water-detail__contact-list">
              {phone && (
                <a
                  href={telHref}
                  className="water-detail__contact-row"
                  onClick={() => analyticsTracker.trackClick(item, 'phone')}
                >
                  <WaterDetailIcon name="phone" size={16} />
                  <span>{phone}</span>
                </a>
              )}
              {siteUrl && (
                <a
                  href={siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="water-detail__contact-row"
                  onClick={() => analyticsTracker.trackClick(item, 'website')}
                >
                  <WaterDetailIcon name="globe" size={16} />
                  <span>Перейти на сайт</span>
                </a>
              )}
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="water-detail__contact-row"
                  onClick={() => analyticsTracker.trackClick(item, 'website')}
                >
                  <WaterDetailIcon name="globe" size={16} />
                  <span>{social.label}</span>
                </a>
              ))}
              {!hasContacts && (
                <p className="water-detail__muted">
                  Контакты пока не указаны. Посмотрите расположение на карте.
                </p>
              )}
            </div>

            {item.contacts && (
              <div className="water-detail__contact-note">{item.contacts}</div>
            )}

            <MapAction
              mapUrl={mapUrl}
              className="water-detail__cta water-detail__cta--secondary water-detail__map-btn"
              onClick={() => analyticsTracker.trackClick(item, 'map')}
            >
              <WaterDetailIcon name="map" size={17} />
              Открыть на карте
            </MapAction>
          </div>
        </div>
      )}
    </article>
  );
}
