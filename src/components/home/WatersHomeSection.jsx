import { Link } from 'react-router-dom';
import { usePaidBases } from '../../hooks/usePaidBases';
import { sortPromoFirst } from '../../lib/waterUtils';
import { pickCardCover } from '../../lib/mediaCover';
import './WatersHomeSection.css';

const BG = '/img/home/waters-bg.jpg';

const FEATURE_ICONS = [
  // trees
  <svg key="t" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M7 20h2v-3h6v3h2M6 14l6-9 6 9H6zm-1 3h14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  </svg>,
  // mountains
  <svg key="m" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M3 18l6.5-10 3.5 5 2.5-3.5L21 18H3z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
    />
  </svg>,
  // waves
  <svg key="w" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M3 10c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2M3 15c2.5 0 2.5 2 5 2s2.5-2 5-2 2.5 2 5 2 2.5-2 5-2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
    />
  </svg>,
  // pines
  <svg key="p" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M12 3l4 6h-2.5L16 14h-2.2L17 20H7l3.2-6H8l2.5-5H8L12 3z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>,
];

function pricePerDay(item) {
  const raw = item?.price_from ?? item?.priceFrom;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    return `от ${n.toLocaleString('ru-RU')} ₽ / сутки`;
  }
  const price = String(item?.price || '').trim();
  if (!price) return 'Цена по запросу';
  if (/сутки/i.test(price)) return price.startsWith('от') ? price : `от ${price}`;
  return price.startsWith('от') ? `${price} / сутки` : `от ${price} / сутки`;
}

function locationLine(item) {
  const parts = ['Пермский край', item.region, item.locality].filter(Boolean);
  // avoid "Пермский край, Пермский край"
  const uniq = [];
  for (const p of parts) {
    if (!uniq.some((x) => x.toLowerCase() === String(p).toLowerCase())) uniq.push(p);
  }
  return uniq.join(', ');
}

function featureText(item, index) {
  const short = String(item.short || '').trim();
  if (short) return short.length > 64 ? `${short.slice(0, 61)}…` : short;
  const fish = String(item.fish || '').trim();
  if (fish) return `Рыба: ${fish.split(',')[0].trim()}`;
  const fallbacks = [
    'Живописные леса и чистая природа',
    'Потрясающие пейзажи и свежий воздух',
    'Тихие озёра и хвойные леса',
    'Чистый воздух и просторные виды',
  ];
  return fallbacks[index % fallbacks.length];
}

function Stars({ value }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <span className="wh-card__stars" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < n ? 'is-on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

function ShowcaseCard({ item, index }) {
  const cover = pickCardCover(item);
  const img = cover.imageUrl || '/img/hero/hero-bg.jpg';
  const rating = Number(item.ratingAvg ?? item.rating_avg) || 0;
  const isTop = Boolean(item.isTop || item.is_top || item.top || index < 4);
  const detailPath = `/waters/${item.id}`;

  return (
    <article className="wh-card" style={{ '--i': index }}>
      <Link to={detailPath} className="wh-card__media">
        <img src={img} alt="" loading="lazy" decoding="async" />
        {isTop && <span className="wh-card__top">ТОП</span>}
      </Link>

      <div className="wh-card__body">
        <h3 className="wh-card__title">
          <Link to={detailPath}>{item.name}</Link>
        </h3>

        <p className="wh-card__place">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path
              d="M12 21s7-5.4 7-11a7 7 0 10-14 0c0 5.6 7 11 7 11z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <circle cx="12" cy="10" r="2.4" fill="currentColor" />
          </svg>
          <span>{locationLine(item)}</span>
        </p>

        <p className="wh-card__rating" aria-label={rating ? `Рейтинг ${rating.toFixed(1)}` : 'Нет отзывов'}>
          <Stars value={rating || 5} />
          <strong>{rating > 0 ? rating.toFixed(1) : '—'}</strong>
        </p>

        <p className="wh-card__price">{pricePerDay(item)}</p>

        <div className="wh-card__feature">
          <span className="wh-card__feature-ico">{FEATURE_ICONS[index % FEATURE_ICONS.length]}</span>
          <span>{featureText(item, index)}</span>
        </div>

        <Link to={detailPath} className="wh-card__btn">
          Подробнее <span aria-hidden>→</span>
        </Link>
      </div>
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="wh-card wh-card--skeleton" aria-hidden>
      <div className="wh-card__media" />
      <div className="wh-card__body">
        <div className="wh-skel" />
        <div className="wh-skel wh-skel--sm" />
        <div className="wh-skel wh-skel--sm" />
        <div className="wh-skel" />
      </div>
    </div>
  );
}

export default function WatersHomeSection() {
  const { data: paid, loading: loadingPaid } = usePaidBases({ limit: 8 });

  const cards = sortPromoFirst(paid || []).slice(0, 4);

  return (
    <section className="waters-home" id="waters">
      {/* Fog / ridge bridge from hero into this landscape */}
      <div className="waters-home__bridge" aria-hidden="true">
        <div className="waters-home__mist waters-home__mist--a" />
        <div className="waters-home__mist waters-home__mist--b" />
        <div className="waters-home__mist waters-home__mist--c" />
        <svg className="waters-home__ridge" viewBox="0 0 1440 120" preserveAspectRatio="none">
          <defs>
            <linearGradient id="whRidgeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#c8d9e8" stopOpacity="0.55" />
              <stop offset="45%" stopColor="#9eb8cf" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#7f9fb8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d="M0,70 C180,20 360,110 540,55 C720,0 900,95 1080,40 C1260,-5 1380,60 1440,35 L1440,120 L0,120 Z"
            fill="url(#whRidgeFill)"
          />
        </svg>
      </div>

      <div className="waters-home__bg" aria-hidden="true">
        <img src={BG} alt="" width={1920} height={1080} loading="lazy" decoding="async" />
        <div className="waters-home__bg-shade" />
      </div>

      <div className="waters-home__inner section-inner section-inner--wide">
        <header className="waters-home__head">
          <h2 className="waters-home__title">
            <span className="waters-home__title-mark">Базы отдыха</span>
            <span className="waters-home__title-rest">в Пермском крае</span>
          </h2>

          <div className="waters-home__brand">
            <span className="waters-home__trees" aria-hidden="true">
              <svg viewBox="0 0 48 40">
                <path d="M10 28 L16 10 L22 28 Z" fill="#2563eb" />
                <path d="M20 30 L28 6 L36 30 Z" fill="#1d4ed8" />
                <path d="M30 28 L38 12 L46 28 Z" fill="#2563eb" />
                <path
                  d="M4 34c4 0 4 2 8 2s4-2 8-2 4 2 8 2 4-2 8-2 4 2 8 2"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <p>Природа, комфорт и незабываемые впечатления</p>
          </div>

          <Link to="/paid-waters" className="waters-home__cta-link">
            Открой Пермский край! <span aria-hidden>♡</span>
          </Link>
        </header>

        <div className="waters-home__grid">
          {loadingPaid
            ? Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)
            : cards.map((item, i) => <ShowcaseCard key={item.id} item={item} index={i} />)}
        </div>

        <div className="waters-home__more">
          <Link to="/paid-waters" className="waters-home__more-link">
            Все базы отдыха
          </Link>
          <Link to="/paid-fishing" className="waters-home__more-link">
            Платная рыбалка
          </Link>
          <Link to="/free-waters" className="waters-home__more-link">
            Где порыбачить
          </Link>
        </div>
      </div>

      <div className="waters-home__fade" aria-hidden="true" />
    </section>
  );
}
