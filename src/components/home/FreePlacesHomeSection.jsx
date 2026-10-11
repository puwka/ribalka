import { Link } from 'react-router-dom';
import { useFreePlaces } from '../../hooks/useFreePlaces';
import { sortPromoFirst } from '../../lib/waterUtils';
import { pickCardCover } from '../../lib/mediaCover';
import './FreePlacesHomeSection.css';

const BG = '/img/home/places-scenic.jpg';

const FEATURE_ICON_SETS = [
  ['fish', 'trees', 'tent'],
  ['fish', 'camera', 'trees'],
  ['fish', 'tent', 'camera'],
  ['fish', 'trees', 'camera'],
];

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
  trees: (
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
        d="M4 8h3l1.5-2h7L17 8h3v10H4V8z"
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

function locationLine(item) {
  const parts = [item.locality, item.region].filter(Boolean);
  if (!parts.length) return 'Пермский край';
  return parts.join(', ');
}

function featureLines(item, index) {
  const fish = String(item.fish || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)[0];
  const short = String(item.short || '').trim();
  const lines = [
    fish ? `Клёв: ${fish}` : 'Отличный клёв в сезон',
    short
      ? short.length > 42
        ? `${short.slice(0, 39)}…`
        : short
      : 'Живописные берега и природа',
    'Удобный подход к воде',
  ];
  const fallbacks = [
    ['Отличный клёв', 'Живописные виды', 'Удобные берега'],
    ['Тихая рыбалка', 'Чистая вода', 'Место под палатку'],
    ['Богатый улов', 'Красивые закаты', 'Подъезд к воде'],
    ['Семейное место', 'Лес у берега', 'Точка на карте'],
  ];
  if (!fish && !short) return fallbacks[index % fallbacks.length];
  return lines;
}

function Stars({ value }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <span className="pl-card__stars" aria-hidden>
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
  const icons = FEATURE_ICON_SETS[index % FEATURE_ICON_SETS.length];
  const lines = featureLines(item, index);

  return (
    <article className="pl-card" style={{ '--i': index }}>
      <Link to={detailPath} className="pl-card__media">
        <img src={img} alt="" loading="lazy" decoding="async" />
      </Link>

      <div className="pl-card__body">
        <h3 className="pl-card__title">
          <Link to={detailPath}>{item.name}</Link>
        </h3>
        <span className="pl-card__wave" aria-hidden="true" />

        <p className="pl-card__place">
          {ICONS.pin}
          <span>{locationLine(item)}</span>
        </p>

        <p className="pl-card__rating" aria-label={rating ? `Рейтинг ${rating.toFixed(1)}` : 'Нет отзывов'}>
          <Stars value={rating || 5} />
          <strong>{rating > 0 ? rating.toFixed(1) : '—'}</strong>
        </p>

        <ul className="pl-card__features">
          {lines.map((text, i) => (
            <li key={i}>
              <span className="pl-card__fico">{ICONS[icons[i]]}</span>
              <span>{text}</span>
            </li>
          ))}
        </ul>

        <Link to={detailPath} className="pl-card__btn">
          <span className="pl-card__btn-play" aria-hidden="true">
            ▶
          </span>
          Подробнее
          <span aria-hidden="true">&gt;</span>
        </Link>
      </div>
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="pl-card pl-card--skeleton" aria-hidden>
      <div className="pl-card__media" />
      <div className="pl-card__body">
        <div className="pl-skel" />
        <div className="pl-skel pl-skel--sm" />
        <div className="pl-skel pl-skel--sm" />
        <div className="pl-skel" />
      </div>
    </div>
  );
}

export default function FreePlacesHomeSection() {
  const { data, loading } = useFreePlaces({ limit: 8 });
  const cards = sortPromoFirst(data || []).slice(0, 4);

  return (
    <section className="pl-home" id="free-places-home">
      <div className="pl-home__bg" aria-hidden="true">
        <img src={BG} alt="" width={1920} height={1080} fetchPriority="high" decoding="async" />
        <div className="pl-home__bg-shade" />
      </div>

      <div className="pl-home__inner section-inner section-inner--wide">
        <header className="pl-home__head">
          <div className="pl-home__intro">
            <div className="pl-home__brush">
              {/* Horizontal watercolor brush stroke — soft irregular edges all around */}
              <svg
                className="pl-home__brush-shape"
                viewBox="0 0 720 240"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <filter id="pl-brush-soft" x="-8%" y="-20%" width="116%" height="140%">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="b" />
                    <feMerge>
                      <feMergeNode in="b" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>
                <path
                  filter="url(#pl-brush-soft)"
                  fill="rgba(255,255,255,0.93)"
                  d="M48 78c36-34 96-52 168-48 58 3 112 14 170 10 52-4 108-2 158 12 34 10 62 28 74 52 10 20 4 42-14 58-22 20-58 30-98 36-62 10-128 14-196 12-78-2-152-12-210-34-28-10-52-28-60-52-8-22 2-42 22-52 12-6 24-4 36 6z"
                />
                <path
                  fill="rgba(255,255,255,0.55)"
                  d="M72 96c28-18 78-28 132-24 48 4 96 12 146 8 40-3 86 0 124 14 18 6 28 18 22 30-8 16-36 24-68 28-54 8-112 8-172 4-52-4-102-14-142-28-14-5-22-16-16-26 4-6 12-8 24-6z"
                />
              </svg>

              <div className="pl-home__brush-content">
                <h2 className="pl-home__title">
                  активный отдых и рыбалка
                  <span className="pl-home__doodle pl-home__doodle--fish" aria-hidden="true">
                    <svg viewBox="0 0 40 22">
                      <path
                        d="M2 11c5-6 12-7 19-3 4 2 7 2 11 1-2 5-6 8-13 8C12 17 6 14 2 11z"
                        fill="none"
                        stroke="#1e3a8a"
                        strokeWidth="1.8"
                      />
                      <circle cx="11" cy="10" r="1.2" fill="#1e3a8a" />
                    </svg>
                  </span>
                </h2>
                <p className="pl-home__subtitle">Лучшие места Пермского края</p>
                <p className="pl-home__lead">
                  Чистые реки, живописные озёра и богатые рыбные угодья ждут вас!
                  <span className="pl-home__doodle pl-home__doodle--sun" aria-hidden="true">
                    <svg viewBox="0 0 28 28">
                      <circle cx="14" cy="14" r="5" fill="none" stroke="#1e3a8a" strokeWidth="1.6" />
                      <path
                        d="M14 2v3M14 23v3M2 14h3M23 14h3M5 5l2 2M21 21l2 2M5 23l2-2M21 7l2-2"
                        stroke="#1e3a8a"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <path
                        d="M10 15c1.2 1.4 3.2 1.4 4.5 0"
                        fill="none"
                        stroke="#1e3a8a"
                        strokeWidth="1.4"
                      />
                    </svg>
                  </span>
                </p>
              </div>
            </div>
          </div>

          <p className="pl-home__inspire">
            Природа вдохновляет <span aria-hidden="true">♡</span>
          </p>
        </header>

        <div className="pl-home__grid">
          {loading
            ? Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)
            : cards.map((item, i) => <PlaceCard key={item.id} item={item} index={i} />)}
        </div>

        <div className="pl-home__more">
          <Link to="/free-waters" className="pl-home__more-link">
            Все бесплатные места
          </Link>
        </div>
      </div>
    </section>
  );
}
