import { useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { newsService } from '../services/newsService';
import './NewsPage.css';

export default function NewsPage() {
  const { id } = useParams();
  const [news, setNews] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        // Сначала загружаем, затем считаем просмотр в БД
        let row = await newsService.getById(id);
        if (!alive) return;
        if (!row) {
          setNews(null);
          setError('Новость не найдена');
          return;
        }
        setNews(row);
        try {
          const seenKey = `news_viewed_${id}`;
          let already = false;
          try {
            already = Boolean(sessionStorage.getItem(seenKey));
          } catch {
            already = false;
          }
          if (!already) {
            const updated = await newsService.recordView(id);
            try {
              sessionStorage.setItem(seenKey, '1');
            } catch {
              /* ignore */
            }
            if (alive && updated) setNews(updated);
          }
        } catch {
          /* счётчик не критичен для показа */
        }
      } catch (err) {
        if (alive) {
          setError(err.message || 'Новость не найдена');
          setNews(null);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="news-page">
        <div className="news-page__container">
          <p>Загрузка…</p>
        </div>
      </div>
    );
  }

  if (!news) {
    return (
      <div className="news-page">
        <div className="news-page__container">
          <h2>{error || 'Новость не найдена'}</h2>
          <Link to="/news/all" className="back-link">
            ← Все новости
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (dateString) =>
    new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const shareUrl = encodeURIComponent(window.location.href);
  const shareTitle = encodeURIComponent(news.title);

  return (
    <div className="news-page">
      <div className="news-page__container">
        <Link to="/news/all" className="back-link">
          ← Все новости
        </Link>

        <article className="news-article">
          <div className="news-article__header" id="news-top">
            {news.category && <div className="news-article__category">{news.category}</div>}
            <h1>{news.title}</h1>
            <div className="news-article__meta">
              <span>📅 {formatDate(news.date)}</span>
              <span>✍️ {news.author}</span>
              <span>👁 {news.views ?? 0} просмотров</span>
            </div>
          </div>

          {news.image && (
            <div className="news-article__image">
              <img src={news.image} alt={news.title} />
            </div>
          )}

          <div
            className="news-article__content"
            dangerouslySetInnerHTML={{
              __html: (news.content || '')
                .replace(/\n/g, '<br>')
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>'),
            }}
          />

          <div className="news-article__share">
            <h3>Поделиться:</h3>
            <div className="share-buttons">
              <a
                href={`https://vk.com/share.php?url=${shareUrl}&title=${shareTitle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn vk"
              >
                VK
              </a>
              <a
                href={`https://t.me/share/url?url=${shareUrl}&text=${shareTitle}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn telegram"
              >
                Telegram
              </a>
              <a
                href={`https://max.ru/share?url=${shareUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="share-btn max"
              >
                MAX
              </a>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
