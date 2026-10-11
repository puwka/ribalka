import { Link } from 'react-router-dom';
import { useFreePlaces } from '../../hooks/useFreePlaces';
import { sortPromoFirst } from '../../lib/waterUtils';
import { pickCardCover } from '../../lib/mediaCover';
import './FreePlacesHomeSection.css';

const BG = '/img/home/fishing-bg.jpg';

const ICONS = {
  fish: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M3 12c4-4 8-4 11-2 2.5 1.5 4.5 1.5 6 1-1.5 3.5-4 5.5-8 5.5-5 0-7.5-2-9-4.5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="11.5" r="1" fill="currentColor" />
    </svg>
  ),
  tree: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 3l4 6h-2.5L16 14h-2.2L17 20H7l3.2-6H8l2.5-5H8L12 3z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  ),
  tent: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M4 18l8-12 8 12H4zm8-6v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  ),
  camera: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M4 8h3l1.5-2h7L17 8h3v11H4V8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  ),
  pin: (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="10" r="2.4" fill="currentColor" />
    </svg>
  ),
};

const BAR_ITEMS = [
  { icon: ICONS.pin, label: 'Бесплатные места' },
  { icon: ICONS.tent, label: 'Удобные подъезды' },
  { icon: ICONS.camera, label: 'Реальные фото и видео' },
  { icon: ICONS.pin, label: 'Точная геолокация' },
];

function locationLine(item) {
  const parts = [item.locality, item.region].filter(Boolean);
  if (!parts.length) return 'Пермский край';
  return parts.join(', ');
}

function featureLines(item, index) {
  const fish = String(item.fish || '').trim();
  const short = String(item.short || item.description || '').trim();
  const lines = [];

  if (fish) lines.push({ icon: ICONS.fish, text: `Рыба: ${fish.split(',').slice(0, 2).join(', ').trim()}` });
  else {
    const fishFallback = ['Хороший клёв', 'Богатые угодья', 'Тихая рыбалка', 'Отличный клёв'];
    lines.push({ icon: ICONS.fish, text: fishFallback[index % fishFallback.length] });
  }

  if (short) {
    lines.push({
      icon: ICONS.tree,
      text: short.length > 42 ? `${short.slice(0, 39)}…` : short,
    });
  } else {
    const viewFallback = ['Живописные виды', 'Чистая природа', 'Красивые берега', 'Просторные плёсы'];
    lines.push({ icon: ICONS.tree, text: viewFallback[index % viewFallback.length] });
  }

  const shoreFallback = ['Удобные берега', 'Есть подъезд', 'Место под палатку', 'Комфортный берег'];
  lines.push({ icon: ICONS.tent, text: shoreFallback[index % shoreFallback.length] });

  return lines.slice(0, 3);
}

function Stars({ value }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <span className="fp-card__stars" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < n ? 'is-on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

function PlaceCard({ item, index }) {
  const cover = pickCardCover(item);
  const img = cover.imageUrl || BG;
  const rating = Number(item.ratingAvg ?? item.rating_avg) || 0;
  const detailPath = `/waters/${item.id}`;
  const features = featureLines(item, index);

  return (
    <article className="fp-card" style={{ '--i': index }}>
      <Link to={detailPath} className="fp-card__media">
        <img src={img} alt="" loading="lazy" decoding="async" />
      </Link>

      <div className="fp-card__body">
        <h3 className="fp-card__title">
          <Link to={detailPath}>{item.name}</Link>
        </h3>

        <p className="fp-card__place">
          {ICONS.pin}
          <span>{locationLine(item)}</span>
        </p>

        <p className="fp-card__rating">
          <Stars value={rating || 5} />
          <strong>{rating > 0 ? rating.toFixed(1) : '—'}</strong>
        </p>

        <ul className="fp-card__features">
          {features.map((f, i) => (
            <li key={i}>
              <span className="fp-card__feature-ico">{f.icon}</span>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>

        <Link to={detailPath} className="fp-card__btn">
          <span className="fp-card__btn-play" aria-hidden>
            ▶
          </span>
          Подробнее <span aria-hidden>&gt;</span>
        </Link>
      </div>
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="fp-card fp-card--skeleton" aria-hidden>
      <div className="fp-card__media" />
      <div className="fp-card__body">
        <div className="fp-skel" />
        <div className="fp-skel fp-skel--sm" />
        <div className="fp-skel fp-skel--sm" />
        <div className="fp-skel" />
      </div>
    </div>
  );
}

export default function FreePlacesHomeSection() {
  const { data, loading } = useFreePlaces({ limit: 8 });
  const cards = sortPromoFirst(data || []).slice(0, 4);

  return (
    <section className="fp-home" id="free-places-home">
      <div className="fp-home__bg" aria-hidden="true">
        <img src={BG} alt="" width={1920} height={1080} loading="lazy" decoding="async" />
        <div className="fp-home__bg-shade" />
      </div>

      <div className="fp-home__inner section-inner section-inner--wide">
        <header className="fp-home__head">
          <div className="fp-home__banner">
            <span className="fp-home__sun" aria-hidden="true">
              <svg viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="7" fill="#facc15" />
                <g stroke="#f59e0b" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M16 3v3M16 26v3M3 16h3M26 16h3M6.5 6.5l2 2M23.5 23.5l2 2M6.5 25.5l2-2M23.5 8.5l2-2" />
                </g>
              </svg>
            </span>
            <h2 className="fp-home__title">
              активный отдых и рыбалка
              <span className="fp-home__fish" aria-hidden="true">
                <svg viewBox="0 0 40 22">
                  <path
                    d="M3 11c5-6 12-7 19-3 4 2 8 2 12 1-2.5 5-7 8.5-14 8.5C12 17.5 7 15 3 11z"
                    fill="none"
                    stroke="#1e3a8a"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="10" r="1.4" fill="#1e3a8a" />
                </svg>
              </span>
            </h2>
            <p className="fp-home__subtitle">Лучшие места Пермского края</p>
            <p className="fp-home__lead">
              Чистые реки, живописные озёра и богатые рыбные угодья ждут вас!
            </p>
          </div>

          <p className="fp-home__inspire">
            Природа вдохновляет <span aria-hidden>♡</span>
          </p>
        </header>

        <div className="fp-home__grid">
          {loading
            ? Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)
            : cards.map((item, i) => <PlaceCard key={item.id} item={item} index={i} />)}
        </div>

        {!loading && cards.length === 0 && (
          <p className="fp-home__empty">Скоро здесь появятся лучшие бесплатные места</p>
        )}

        <div className="fp-home__more">
          <Link to="/free-waters" className="fp-home__more-link">
            Все бесплатные места
          </Link>
        </div>
      </div>

      <div className="fp-home__bar">
        <div className="fp-home__bar-inner section-inner section-inner--wide">
          <ul className="fp-home__bar-list">
            {BAR_ITEMS.map((item) => (
              <li key={item.label}>
                <span className="fp-home__bar-ico">{item.icon}</span>
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
          <p className="fp-home__bar-tag">
            Пермский край — рыбалка и отдых, который вдохновляет <span aria-hidden>♡</span>
          </p>
        </div>
      </div>
    </section>
  );
}
