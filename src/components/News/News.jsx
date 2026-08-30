import { Link, useNavigate } from 'react-router-dom';
import { useNews } from '../../hooks/useNews';
import './News.css';

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

  const displayedNews = newsData.slice(0, 6);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // 🆕 Обработчик клика по кнопке "Читать подробнее"
  const handleReadMore = (e, newsId) => {
    e.preventDefault();
    navigate(`/news/${newsId}`);
    // Скролл вверх произойдёт автоматически в NewsPage через useEffect
  };

  return (
    <section className="news" id="news">
      <div className="news__container">
        <div className="section-header">
          <h2 className="section-title">Новости и статьи</h2>
          <p className="section-subtitle">
            Актуальные новости, полезные советы и интересные истории
          </p>
        </div>

        <div className="news__grid">
          {displayedNews.map(news => (
            <article key={news.id} className="news-card">
              <div className="news-card__image">
                <img src={news.image} alt={news.title} />
                {news.category && <div className="news-card__category">{news.category}</div>}
              </div>
              <div className="news-card__content">
                <div className="news-card__meta">
                  <span>📅 {formatDate(news.date)}</span>
                  <span>👁 {news.views}</span>
                </div>
                <h3 className="news-card__title">{news.title}</h3>
                <p className="news-card__excerpt">{news.excerpt}</p>
                <a 
                  href={`/news/${news.id}`} 
                  className="news-card__btn"
                  onClick={(e) => handleReadMore(e, news.id)}
                >
                  Читать подробнее →
                </a>
              </div>
            </article>
          ))}
        </div>

        {newsData.length > 6 && (
          <div className="news__show-more">
            <Link to="/news/all" className="show-more-btn">
              <span>Все новости ({newsData.length})</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}