import { useParams, Link } from 'react-router-dom';
import { useEffect } from 'react';
import { useNews } from '../hooks/useNews';
import './NewsPage.css';

export default function NewsPage() {
  const { id } = useParams();
  const { data: newsData } = useNews();
  const news = newsData.find((n) => String(n.id) === String(id));

  // 🆕 Скролл вверх при загрузке страницы
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  if (!news) {
    return (
      <div className="news-page">
        <div className="news-page__container">
          <h2>Новость не найдена</h2>
          <Link to="/" className="back-link">← Вернуться на главную</Link>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const shareUrl = encodeURIComponent(window.location.href);
  const shareTitle = encodeURIComponent(news.title);

  return (
    <div className="news-page">
      <div className="news-page__container">
        <Link to="/" className="back-link" onClick={(e) => {
          e.preventDefault();
          window.location.href = '/';
        }}>← Назад к новостям</Link>
        
        <article className="news-article">
          {/* 🆕 Якорь на заголовок для точного скролла */}
          <div className="news-article__header" id="news-top">
            {news.category && <div className="news-article__category">{news.category}</div>}
            <h1>{news.title}</h1>
            <div className="news-article__meta">
              <span>📅 {formatDate(news.date)}</span>
              <span>✍️ {news.author}</span>
              <span>👁 {news.views} просмотров</span>
            </div>
          </div>

          <div className="news-article__image">
            <img src={news.image} alt={news.title} />
          </div>

          <div className="news-article__content"
            dangerouslySetInnerHTML={{ 
              __html: (news.content || '').replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            }}
          />

          <div className="news-article__share">
            <h3>Поделиться:</h3>
            <div className="share-buttons">
              <a href={`https://vk.com/share.php?url=${shareUrl}&title=${shareTitle}`} target="_blank" rel="noopener noreferrer" className="share-btn vk">VK</a>
              <a href={`https://t.me/share/url?url=${shareUrl}&text=${shareTitle}`} target="_blank" rel="noopener noreferrer" className="share-btn telegram">Telegram</a>
              <a href={`https://max.ru/share?url=${shareUrl}`} target="_blank" rel="noopener noreferrer" className="share-btn max">MAX</a>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}