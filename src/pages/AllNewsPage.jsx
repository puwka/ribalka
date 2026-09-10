import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useNews } from '../hooks/useNews';
import './AllNewsPage.css';

export default function AllNewsPage() {
  const { data: newsData, loading } = useNews();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(null);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const toggle = (id) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="all-news-page">
        <div className="all-news-page__container">
          <div className="loading">Загрузка...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="all-news-page">
      <div className="all-news-page__container">
        <Link to="/" className="back-link">
          ← На главную
        </Link>
        <h1 className="page-title">Все новости ({newsData.length})</h1>

        {newsData.length === 0 ? (
          <p className="all-news-empty">Пока нет новостей</p>
        ) : (
          <div className="news-accordion" role="list">
            {newsData.map((news) => {
              const isOpen = openId === news.id;
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
                      {news.image ? (
                        <img src={news.image} alt="" />
                      ) : (
                        <span className="news-accordion__thumb-placeholder" />
                      )}
                    </div>
                    <div className="news-accordion__meta">
                      {news.category && (
                        <span className="news-accordion__category">{news.category}</span>
                      )}
                      <span className="news-accordion__date">{formatDate(news.date)}</span>
                      {news.views != null && (
                        <span className="news-accordion__views">👁 {news.views}</span>
                      )}
                    </div>
                    <h2 className="news-accordion__title">{news.title}</h2>
                    <span className="news-accordion__chevron" aria-hidden>
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="news-accordion__body">
                      {news.image && (
                        <div className="news-accordion__image">
                          <img src={news.image} alt={news.title} />
                        </div>
                      )}
                      <p className="news-accordion__excerpt">
                        {news.excerpt || news.content?.slice?.(0, 280) || ''}
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
    </div>
  );
}
