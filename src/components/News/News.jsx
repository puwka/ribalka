import { Link, useNavigate } from 'react-router-dom';
import { useNews } from '../../hooks/useNews';
import './News.css';

const PREVIEW_LIMIT = 4;

export default function News() {
  const { data: newsData, loading } = useNews();
  const navigate = useNavigate();

  if (loading) {
    return (
      <section className="news" id="news">
        <div className="news__container">
          <div className="loading">Загрузка...</div>
        </div>
      </section>
    );
  }

  const displayedNews = newsData.slice(0, PREVIEW_LIMIT);

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

  const handleReadMore = (e, newsId) => {
    e.preventDefault();
    navigate(`/news/${newsId}`);
  };

  return (
    <section className="news" id="news">
      <div className="news__container">
        <div className="news__head">
          <div>
            <h2 className="section-title">Новости и статьи</h2>
            <p className="section-subtitle">
              Актуальные новости, полезные советы и интересные истории
            </p>
          </div>
          <Link to="/news/all" className="news__view-all">
            Смотреть все
          </Link>
        </div>

        {displayedNews.length === 0 ? (
          <div className="news__empty">Пока нет новостей</div>
        ) : (
          <div className="news__grid news__grid--preview">
            {displayedNews.map((news) => (
              <article key={news.id} className="news-card news-card--compact">
                <div className="news-card__image">
                  {news.image ? <img src={news.image} alt={news.title} /> : null}
                  {news.category && (
                    <div className="news-card__category">{news.category}</div>
                  )}
                </div>
                <div className="news-card__content">
                  <div className="news-card__meta">
                    <span>{formatDate(news.date)}</span>
                    {news.views != null && <span>👁 {news.views}</span>}
                  </div>
                  <h3 className="news-card__title">{news.title}</h3>
                  <p className="news-card__excerpt">{news.excerpt}</p>
                  <a
                    href={`/news/${news.id}`}
                    className="news-card__btn"
                    onClick={(e) => handleReadMore(e, news.id)}
                  >
                    Читать →
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="news__show-more">
          <Link to="/news/all" className="show-more-btn">
            <span>Все новости{newsData.length ? ` (${newsData.length})` : ''}</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
