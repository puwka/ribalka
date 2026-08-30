import './NewsCard.css';

export default function NewsCard({ news, onClick }) {
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <article className="news-card" onClick={() => onClick(news)}>
      <div className="news-card__image">
        <img src={news.image} alt={news.title} />
        <div className="news-card__category">{news.category}</div>
      </div>
      <div className="news-card__content">
        <div className="news-card__meta">
          <span>📅 {formatDate(news.date)}</span>
          <span>👁 {news.views}</span>
        </div>
        <h3 className="news-card__title">{news.title}</h3>
        <p className="news-card__excerpt">{news.excerpt}</p>
        <div className="news-card__footer">
          <div className="news-card__author">✍️ {news.author}</div>
          <button className="news-card__btn">
            Читать →
          </button>
        </div>
      </div>
    </article>
  );
}