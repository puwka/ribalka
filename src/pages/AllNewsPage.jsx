import { Link, useNavigate } from 'react-router-dom';
import { useNews } from '../hooks/useNews';
import './AllNewsPage.css';

export default function AllNewsPage() {
  const { data: newsData, loading } = useNews();
  const navigate = useNavigate();

  if (loading) {
    return <div className="all-news-page"><div className="loading">Загрузка...</div></div>;
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // 🆕 Обработчик клика
  const handleReadMore = (e, newsId) => {
    e.preventDefault();
    navigate(`/news/${newsId}`);
  };

  return (
    <div className="all-news-page">
      <div className="all-news-page__container">
        <Link to="/" className="back-link">← На главную</Link>
        <h1 className="page-title">Все новости ({newsData.length})</h1>
        <div className="news-grid">
          {newsData.map(news => (
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
      </div>
    </div>
  );
}