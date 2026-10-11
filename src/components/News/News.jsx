import { Link, useNavigate } from 'react-router-dom';
import { useNews } from '../../hooks/useNews';
import './News.css';

const BG = '/img/home/news-bg.jpg';
const PREVIEW_LIMIT = 4;

const CAT_ICONS = {
  рыбалка: 'fish',
  'базы отдыха': 'home',
  природа: 'tree',
  актуальное: 'star',
  default: 'star',
};

function categoryKey(cat) {
  const k = String(cat || '')
    .trim()
    .toLowerCase();
  return CAT_ICONS[k] || CAT_ICONS.default;
}

function CategoryIcon({ type }) {
  if (type === 'fish') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          d="M3 12c4-4 8-4 11-2 2.5 1.5 4.5 1.5 6 1-1.5 3.5-4 5.5-8 5.5-5 0-7.5-2-9-4.5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <circle cx="8" cy="11.5" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (type === 'home') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          d="M4 11l8-7 8 7v9H4v-9z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <path d="M10 20v-6h4v6" fill="none" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  if (type === 'tree') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path
          d="M12 3l4 6h-2.5L16 14h-2.2L17 20H7l3.2-6H8l2.5-5H8L12 3z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 3l2.2 6.6H21l-5.4 4 2.1 6.4L12 16.8 6.3 20l2.1-6.4L3 9.6h6.8L12 3z"
        fill="currentColor"
      />
    </svg>
  );
}

function formatDate(dateString) {
  try {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return dateString;
  }
}

function NewsCard({ news, index }) {
  const navigate = useNavigate();
  const cat = String(news.category || '').trim() || 'Актуальное';
  const iconType = categoryKey(cat);

  return (
    <article className="news-card" style={{ '--i': index }}>
      <Link to={`/news/${news.id}`} className="news-card__media">
        {news.image ? (
          <img src={news.image} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="news-card__media-empty" />
        )}
      </Link>

      <div className="news-card__body">
        <h3 className="news-card__title">
          <Link to={`/news/${news.id}`}>{news.title}</Link>
        </h3>

        {news.excerpt ? <p className="news-card__excerpt">{news.excerpt}</p> : null}

        <div className="news-card__meta">
          <span className="news-card__meta-item">
            <span className="news-card__meta-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect
                  x="3"
                  y="5"
                  width="18"
                  height="16"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
            </span>
            {formatDate(news.date)}
          </span>
          <span className="news-card__meta-sep" aria-hidden="true" />
          <span className="news-card__meta-item">
            <span className="news-card__meta-ico" aria-hidden="true">
              <CategoryIcon type={iconType} />
            </span>
            {cat}
          </span>
        </div>

        <button
          type="button"
          className="news-card__btn"
          onClick={() => navigate(`/news/${news.id}`)}
        >
          Подробнее <span aria-hidden="true">→</span>
        </button>
      </div>
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="news-card news-card--skeleton" aria-hidden>
      <div className="news-card__media" />
      <div className="news-card__body">
        <div className="news-skel" />
        <div className="news-skel news-skel--sm" />
        <div className="news-skel news-skel--sm" />
      </div>
    </div>
  );
}

export default function News() {
  const { data: newsData, loading } = useNews();
  const displayedNews = (newsData || []).slice(0, PREVIEW_LIMIT);

  return (
    <section className="news" id="news">
      <div className="news__bg" aria-hidden="true">
        <img src={BG} alt="" width={1920} height={1080} fetchPriority="high" decoding="async" />
        <div className="news__bg-shade" />
      </div>

      <div className="news__inner section-inner section-inner--wide">
        <header className="news__head">
          <h2 className="news__title">
            <span className="news__title-mark">Новости</span>
          </h2>
        </header>

        {loading ? (
          <div className="news__grid">
            {Array.from({ length: 4 }, (_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : displayedNews.length === 0 ? (
          <div className="news__empty">Пока нет новостей</div>
        ) : (
          <div className="news__grid">
            {displayedNews.map((item, i) => (
              <NewsCard key={item.id} news={item} index={i} />
            ))}
          </div>
        )}

        <div className="news__more">
          <Link to="/news/all" className="news__more-link">
            Все новости{newsData?.length ? ` (${newsData.length})` : ''}
          </Link>
        </div>
      </div>
    </section>
  );
}
