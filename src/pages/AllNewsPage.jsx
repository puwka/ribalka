import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNews } from '../hooks/useNews';
import { newsService } from '../services/newsService';
import SideBannerRails from '../components/ads/SideBannerRails';
import { stripRichText } from '../lib/richText';
import './AllNewsPage.css';

function alreadyViewed(id) {
  try {
    return Boolean(sessionStorage.getItem(`news_viewed_${id}`));
  } catch {
    return false;
  }
}

function markViewed(id) {
  try {
    sessionStorage.setItem(`news_viewed_${id}`, '1');
  } catch {
    /* ignore */
  }
}

function NewsThumb({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <span className="news-accordion__thumb-placeholder" aria-hidden />;
  }
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />;
}

function NewsBodyImage({ src, alt }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  return (
    <div className="news-accordion__image">
      <img src={src} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} />
    </div>
  );
}

export default function AllNewsPage() {
  const { data: newsData, loading } = useNews();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(null);
  const [viewOverrides, setViewOverrides] = useState({});

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const toggle = (id) => {
    const opening = openId !== id;
    setOpenId((prev) => (prev === id ? null : id));
    if (!opening || alreadyViewed(id)) return;
    (async () => {
      try {
        const updated = await newsService.recordView(id);
        markViewed(id);
        if (updated?.views != null) {
          setViewOverrides((prev) => ({ ...prev, [id]: updated.views }));
        }
      } catch {
        /* счётчик не критичен */
      }
    })();
  };

  if (loading) {
    return (
      <div className="all-news-page">
        <SideBannerRails surface="news">
          <div className="all-news-page__container all-news-page__container--flush">
            <div className="loading">Загрузка...</div>
          </div>
        </SideBannerRails>
      </div>
    );
  }

  return (
    <div className="all-news-page">
      <SideBannerRails surface="news">
        <div className="all-news-page__container all-news-page__container--flush">
          <Link to="/" className="back-link">
            ← На главную
          </Link>

          <header className="all-news-page__head">
            <p className="all-news-page__eyebrow">Жизнь проекта</p>
            <h1 className="page-title">Все новости ({newsData.length})</h1>
            <p className="all-news-page__lead">
              Новые места, события и полезные заметки для рыбалки в Пермском крае.
            </p>
          </header>

          {newsData.length === 0 ? (
            <p className="all-news-empty">Пока нет новостей</p>
          ) : (
            <div className="news-accordion" role="list">
              {newsData.map((news) => {
                const isOpen = openId === news.id;
                const views = viewOverrides[news.id] ?? news.views ?? 0;
                return (
                  <article
                    key={news.id}
                    className={`news-accordion__item ${isOpen ? 'is-open' : ''}`}
                    role="listitem"
                  >
                    <button
                      type="button"
                      className="news-accordion__head"
                      aria-expanded={isOpen}
                      onClick={() => toggle(news.id)}
                    >
                      <div className="news-accordion__thumb">
                        <NewsThumb src={news.image} alt={news.title} />
                      </div>
                      <div className="news-accordion__meta">
                        {news.category && (
                          <span className="news-accordion__category">{news.category}</span>
                        )}
                        <span className="news-accordion__date">{formatDate(news.date)}</span>
                        <span className="news-accordion__views">👁 {views}</span>
                      </div>
                      <h2 className="news-accordion__title">{news.title}</h2>
                      <span className="news-accordion__chevron" aria-hidden>
                        {isOpen ? '−' : '+'}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="news-accordion__body">
                        <NewsBodyImage src={news.image} alt={news.title} />
                        <p className="news-accordion__excerpt">
                          {news.excerpt || stripRichText(news.content, 280) || ''}
                        </p>
                        <button
                          type="button"
                          className="news-accordion__read"
                          onClick={() => navigate(`/news/${news.id}`)}
                        >
                          Читать полностью →
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </SideBannerRails>
    </div>
  );
}
