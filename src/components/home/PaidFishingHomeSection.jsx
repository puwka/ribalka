import { Link } from 'react-router-dom';
import { usePaidFishing } from '../../hooks/usePaidFishing';
import { sortPromoFirst } from '../../lib/waterUtils';
import { pickCardCover } from '../../lib/mediaCover';
import './PaidFishingHomeSection.css';

const BG = '/img/home/fishing-bg.jpg';

const AMENITY_ICONS = [
  // fish
  <svg key="fish" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M3 12c4-4 8-4 11-2 2.5 1.5 4.5 1.5 6 1-1.5 3.5-4 5.5-8 5.5-5 0-7.5-2-9-4.5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <circle cx="8" cy="11.5" r="1" fill="currentColor" />
  </svg>,
  // boat
  <svg key="boat" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M4 14l8-2 8 2-2 4H6l-2-4zM12 5v7"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>,
  // tent
  <svg key="tent" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M4 18l8-12 8 12H4zm8-6v6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>,
  // fire
  <svg key="fire" viewBox="0 0 24 24" aria-hidden>
    <path
      d="M12 20c3 0 5-2 5-5 0-3-2-4.5-3.5-6.5C12.5 7 12 5 12 5s-.5 2-1.5 3.5C9 10.5 7 12 7 15c0 3 2 5 5 5z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
  </svg>,
];

function priceFrom(item) {
  const raw = item?.price_from ?? item?.priceFrom;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return `от ${n.toLocaleString('ru-RU')} ₽`;
  const price = String(item?.price || '').trim();
  if (!price) return 'Цена по запросу';
  return price.startsWith('от') ? price : `от ${price}`;
}

function locationLine(item) {
  const parts = [item.locality, item.region].filter(Boolean);
  if (!parts.length) return 'Пермский край';
  return parts.join(', ');
}

function Stars({ value }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  return (
    <span className="pf-card__stars" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < n ? 'is-on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

function FishingCard({ item, index }) {
  const cover = pickCardCover(item);
  const img = cover.imageUrl || '/img/home/fishing-bg.jpg';
  const rating = Number(item.ratingAvg ?? item.rating_avg) || 0;
  const ratingCount = Number(item.ratingCount ?? item.rating_count) || 0;
  const detailPath = `/waters/${item.id}`;

  return (
    <article className="pf-card" style={{ '--i': index }}>
      <Link to={detailPath} className="pf-card__media">
        <img src={img} alt="" loading="lazy" decoding="async" />
      </Link>

      <div className="pf-card__body">
        <h3 className="pf-card__title">
          <Link to={detailPath}>{item.name}</Link>
        </h3>

        <p className="pf-card__place">
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

        <p className="pf-card__rating">
          <Stars value={rating || 5} />
          <span>({ratingCount > 0 ? ratingCount : '—'})</span>
        </p>

        <div className="pf-card__amenities" aria-hidden="true">
          {AMENITY_ICONS.map((icon, i) => (
            <span key={i} className="pf-card__amenity">
              {icon}
            </span>
          ))}
        </div>

        <p className="pf-card__price">{priceFrom(item)}</p>

        <Link to={detailPath} className="pf-card__btn">
          Подробнее <span aria-hidden>&gt;</span>
        </Link>
      </div>
    </article>
  );
}

function CardSkeleton() {
  return (
    <div className="pf-card pf-card--skeleton" aria-hidden>
      <div className="pf-card__media" />
      <div className="pf-card__body">
        <div className="pf-skel" />
        <div className="pf-skel pf-skel--sm" />
        <div className="pf-skel pf-skel--sm" />
        <div className="pf-skel" />
      </div>
    </div>
  );
}

export default function PaidFishingHomeSection() {
  const { data, loading } = usePaidFishing({ limit: 8 });
  const cards = sortPromoFirst(data || []).slice(0, 4);

  return (
    <>
      <svg className="pf-home__defs" width="0" height="0" aria-hidden="true" focusable="false">
        <defs>
          {/* Smooth wave — same language as hero → bases join */}
          <clipPath id="fishing-wave-clip" clipPathUnits="objectBoundingBox">
            <path d="M0,0.14 C0.1,0.02 0.18,0.22 0.28,0.1 C0.38,0 0.46,0.2 0.56,0.1 C0.66,0 0.74,0.2 0.84,0.1 C0.92,0.04 0.97,0.16 1,0.12 L1,1 L0,1 Z" />
          </clipPath>
        </defs>
      </svg>

      <section className="pf-home" id="paid-fishing-home">
        <div className="pf-home__bg" aria-hidden="true">
          <img src={BG} alt="" width={1920} height={1080} loading="lazy" decoding="async" />
          <div className="pf-home__bg-shade" />
        </div>

        <div className="pf-home__inner section-inner section-inner--wide">
          <header className="pf-home__head">
            <h2 className="pf-home__title">
              Платная рыбалка
              <span className="pf-home__fish" aria-hidden="true">
                <svg viewBox="0 0 48 28">
                  <path
                    d="M4 14c6-7 14-8 22-4 5 2.5 9 2.5 14 1-3 6-8 10-16 10C14 21 8 18 4 14z"
                    fill="none"
                    stroke="#1e3a8a"
                    strokeWidth="2.2"
                    strokeLinejoin="round"
                  />
                  <circle cx="14" cy="12.5" r="1.6" fill="#1e3a8a" />
                  <path d="M38 11l6-4v10l-6-4z" fill="#1e3a8a" />
                </svg>
              </span>
            </h2>
            <p className="pf-home__lead">Лучшие рыболовные базы Пермского края</p>
          </header>

          <div className="pf-home__grid">
            {loading
              ? Array.from({ length: 4 }, (_, i) => <CardSkeleton key={i} />)
              : cards.map((item, i) => <FishingCard key={item.id} item={item} index={i} />)}
          </div>

          <div className="pf-home__more">
            <Link to="/paid-fishing" className="pf-home__more-link">
              Все объекты платной рыбалки
            </Link>
          </div>
        </div>

        <div className="pf-home__fade" aria-hidden="true" />
      </section>
    </>
  );
}
