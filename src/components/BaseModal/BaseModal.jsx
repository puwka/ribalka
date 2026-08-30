import { useState, useEffect } from 'react';
import WeatherWidget from '../WeatherWidget/WeatherWidget';
import { analyticsTracker } from '../../services/ownerDashboardService';
import { platformDb } from '../../lib/platformDb';
import { useAuth } from '../auth/AuthContext';
import { favoritesService } from '../../services/favoritesService';
import { gamificationService } from '../../services/gamificationService';
import BookingForm from '../booking/BookingForm';
import './BaseModal.css';

export default function BaseModal({ item, onClose }) {
  const { user, isAuthenticated, refresh } = useAuth();
  const [activeTab, setActiveTab] = useState('info');
  const [activeVideo, setActiveVideo] = useState(0);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [commentName, setCommentName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState([]);
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    if (!item) return;
    analyticsTracker.trackView(item);
    if (user?.id) {
      gamificationService.onPlaceVisited(user.id, item.id);
    }

    let alive = true;
    (async () => {
      const list = await platformDb.listReviewsByBase(item.id);
      if (!alive) return;
      setComments(
        list
          .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
          .map((r) => ({
            id: r.id,
            name: r.author_name,
            text: r.body,
            rating: r.rating,
            date: r.created_at,
            owner_reply: r.owner_reply,
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(r.author_name)}&background=3b82f6&color=fff`,
          }))
      );

      if (user?.id) {
        const type = item.type === 'free' ? 'place' : 'base';
        setFavorited(await favoritesService.isFavorite(user.id, type, item.id));
      }
    })();

    return () => {
      alive = false;
    };
  }, [item, user]);

  if (!item) return null;

  const mapUrl = item.coords
    ? `https://yandex.ru/maps/?pt=${item.coords.split(',').reverse().join(',')}&z=12&l=map`
    : '#';

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentName.trim() || !commentText.trim() || rating === 0) {
      alert('Заполните все поля и поставьте оценку');
      return;
    }

    const ownerId = item.ownerId || item.owner_id;
    if (!ownerId) {
      alert('Для этой базы отзывы временно недоступны');
      return;
    }

    const saved = await platformDb.addReview({
      base_id: String(item.id),
      owner_id: ownerId,
      author_name: commentName.trim(),
      body: commentText.trim(),
      rating,
      user_id: user?.id || null,
      base_name: item.name,
    });

    setComments((prev) => [
      {
        id: saved.id,
        name: saved.author_name,
        text: saved.body,
        rating: saved.rating,
        date: saved.created_at,
        owner_reply: null,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(saved.author_name)}&background=3b82f6&color=fff`,
      },
      ...prev,
    ]);
    setCommentName('');
    setCommentText('');
    setRating(0);
  };

  const toggleFavorite = async () => {
    if (!isAuthenticated || !user) {
      alert('Войдите, чтобы добавить в избранное');
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

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const renderStars = (count, interactive = false) =>
    [...Array(5)].map((_, i) => (
      <span
        key={i}
        className={`star ${i < (interactive ? hoverRating || rating : count) ? 'active' : ''}`}
        onClick={interactive ? () => setRating(i + 1) : undefined}
        onMouseEnter={interactive ? () => setHoverRating(i + 1) : undefined}
        onMouseLeave={interactive ? () => setHoverRating(0) : undefined}
      >
        ★
      </span>
    ));

  return (
    <div className="base-modal" onClick={onClose}>
      <div className="base-modal__content" onClick={(e) => e.stopPropagation()}>
        <button className="base-modal__close" onClick={onClose}>✕</button>

        <div className="base-modal__header">
          <h2>{item.name}</h2>
          {item.price && <div className="base-modal__price">{item.price}</div>}
        </div>

        <div className="base-modal__gallery">
          {item.images?.slice(0, 4).map((img, i) => (
            <img key={i} src={img} alt={item.name} />
          ))}
        </div>

        <div className="base-modal__tabs">
          <button className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`} onClick={() => setActiveTab('info')}>
            ℹ️ Информация
          </button>
          {item.videos?.length > 0 && (
            <button className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`} onClick={() => setActiveTab('video')}>
              🎬 Видео ({item.videos.length})
            </button>
          )}
          <button className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>
            💬 Отзывы ({comments.length})
          </button>
          {item.type !== 'free' && (
            <button
              className={`tab-btn ${activeTab === 'booking' ? 'active' : ''}`}
              onClick={() => setActiveTab('booking')}
            >
              📅 Бронь
            </button>
          )}
        </div>

        {activeTab === 'info' && (
          <div className="base-modal__info">
            {item.coords && <WeatherWidget coords={item.coords} />}

            <div className="info-block">
              <div className="info-icon">📝</div>
              <div className="info-content">
                <h4>Описание</h4>
                <p>{item.description}</p>
              </div>
            </div>

            {item.fish && (
              <div className="info-block">
                <div className="info-icon">🐟</div>
                <div className="info-content">
                  <h4>Виды рыб</h4>
                  <p>{item.fish}</p>
                </div>
              </div>
            )}

            {item.services?.length > 0 && (
              <div className="info-block">
                <div className="info-icon">🛎️</div>
                <div className="info-content">
                  <h4>Услуги и аренда</h4>
                  <div className="services-list">
                    {item.services.map((s, i) => (
                      <span key={i} className="service-tag">✓ {s}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(item.contacts || item.phone || item.website) && (
              <div className="info-block">
                <div className="info-icon">📞</div>
                <div className="info-content">
                  <h4>Контакты</h4>
                  {item.phone && <p><a href={`tel:${item.phone}`} className="phone-link">{item.phone}</a></p>}
                  {item.contacts && <p>{item.contacts}</p>}
                  {item.website && (
                    <p>
                      <a href={item.website} target="_blank" rel="noopener noreferrer">{item.website}</a>
                    </p>
                  )}
                </div>
              </div>
            )}

            {item.workHours && (
              <div className="info-block">
                <div className="info-icon">🕐</div>
                <div className="info-content">
                  <h4>Режим работы</h4>
                  <p>{item.workHours}</p>
                </div>
              </div>
            )}

            {item.address && (
              <div className="info-block">
                <div className="info-icon">📍</div>
                <div className="info-content">
                  <h4>Адрес</h4>
                  <p>{item.address}</p>
                </div>
              </div>
            )}

            {item.howToGet && (
              <div className="info-block">
                <div className="info-icon">🚗</div>
                <div className="info-content">
                  <h4>Условия / как добраться</h4>
                  <p>{item.howToGet}</p>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <a
                href={mapUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="map-btn"
                onClick={() => analyticsTracker.trackClick(item, 'map')}
              >
                🗺️ Открыть на Яндекс.Картах
              </a>
              <button type="button" className="map-btn" onClick={toggleFavorite}>
                {favorited ? '⭐ В избранном' : '☆ В избранное'}
              </button>
              {item.type !== 'free' && (
                <button type="button" className="map-btn" onClick={() => setActiveTab('booking')}>
                  📅 Забронировать
                </button>
              )}
              {item.phone && (
                <a
                  href={`tel:${item.phone}`}
                  className="map-btn"
                  onClick={() => analyticsTracker.trackClick(item, 'phone')}
                >
                  📞 Позвонить
                </a>
              )}
            </div>
          </div>
        )}

        {activeTab === 'booking' && item.type !== 'free' && (
          <div className="base-modal__info">
            <BookingForm base={item} />
          </div>
        )}

        {activeTab === 'video' && item.videos?.length > 0 && (
          <div className="base-modal__videos">
            <div className="video-main">
              <iframe src={item.videos[activeVideo]} title="Видео" frameBorder="0" allowFullScreen />
            </div>
            <div className="video-buttons">
              {item.videos.map((_, i) => (
                <button
                  key={i}
                  className={`video-btn ${i === activeVideo ? 'active' : ''}`}
                  onClick={() => setActiveVideo(i)}
                >
                  ▶️ Видео {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="base-modal__comments">
            <form className="comment-form" onSubmit={handleSubmitComment}>
              <h3>Оставить отзыв</h3>
              <div className="rating-input">
                <span>Ваша оценка:</span>
                <div className="stars-input">{renderStars(5, true)}</div>
              </div>
              <input
                type="text"
                placeholder="Ваше имя"
                value={commentName}
                onChange={(e) => setCommentName(e.target.value)}
                className="form-input"
              />
              <textarea
                placeholder="Ваш отзыв"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="form-textarea"
                rows="4"
              />
              <button type="submit" className="submit-btn">Отправить отзыв</button>
            </form>

            <div className="comments-list">
              <h3>Отзывы ({comments.length})</h3>
              {comments.length === 0 ? (
                <p className="no-comments">Пока нет отзывов. Будьте первым!</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="comment">
                    <img src={c.avatar} alt={c.name} className="comment-avatar" />
                    <div className="comment-body">
                      <div className="comment-header">
                        <strong>{c.name}</strong>
                        <div className="comment-rating">{renderStars(c.rating)}</div>
                      </div>
                      <p>{c.text}</p>
                      {c.owner_reply && (
                        <p style={{ marginTop: 8, padding: 8, background: '#eff6ff', borderRadius: 8 }}>
                          <strong>Ответ владельца:</strong> {c.owner_reply}
                        </p>
                      )}
                      <span className="comment-date">{formatDate(c.date)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
