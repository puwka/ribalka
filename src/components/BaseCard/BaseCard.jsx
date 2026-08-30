import { Link } from 'react-router-dom';
import { useWeather } from '../../hooks/useWeather';
import './BaseCard.css';

function PlaceholderImage({ name }) {
  return (
    <div className="base-card__placeholder" aria-hidden>
      <span>🎣</span>
      <span>{name?.slice(0, 24)}</span>
    </div>
  );
}

export default function BaseCard({ item, onClick, linkToDetail = true }) {
  const { weather } = useWeather(item.coords);
  const detailPath = `/waters/${item.id}`;
  const typeLabel = item.type === 'free' ? 'Бесплатно' : 'Платная база';

  const handleClick = (e) => {
    if (onClick) {
      e.preventDefault();
      onClick(item);
    }
  };

  const inner = (
    <>
      <div className="base-card__image">
        {item.images?.[0] ? (
          <img
            src={item.images[0]}
            alt={item.name}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.nextElementSibling?.classList.add('is-visible');
            }}
          />
        ) : null}
        <PlaceholderImage name={item.name} />

        <div className="base-card__badges">
          <span className={`badge badge--${item.type === 'free' ? 'free' : 'paid'}`}>
            {typeLabel}
          </span>
          {item.region && (
            <span className="badge badge--region">{item.region}</span>
          )}
        </div>

        {item.price && <div className="base-card__price">{item.price}</div>}

        {weather && (
          <div className="base-card__weather-mini">
            <span>{weather.current.icon}</span>
            <span>{weather.current.temp}°</span>
          </div>
        )}

        <div className="base-card__overlay">
          <span className="base-card__cta">Подробнее</span>
        </div>
      </div>

      <div className="base-card__body">
        <h3 className="base-card__title">{item.name}</h3>
        <p className="base-card__text">{item.short}</p>
        <div className="base-card__footer">
          <div className="base-card__fish">
            <span aria-hidden>🐟</span>
            <span>{item.fish?.split(',')[0]?.trim() || 'Рыбалка'}</span>
          </div>
          {item.address && (
            <span className="base-card__address" title={item.address}>
              📍 {item.address.split(',')[0]}
            </span>
          )}
        </div>
      </div>
    </>
  );

  if (linkToDetail && !onClick) {
    return (
      <Link to={detailPath} className="base-card">
        {inner}
      </Link>
    );
  }

  return (
    <article className="base-card base-card--clickable">
      {linkToDetail ? (
        <Link to={detailPath} className="base-card__link" onClick={handleClick}>
          {inner}
        </Link>
      ) : (
        <button type="button" className="base-card__link" onClick={() => onClick?.(item)}>
          {inner}
        </button>
      )}
    </article>
  );
}

export function BaseCardSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card__img" />
      <div className="skeleton-card__body">
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-line--short" />
      </div>
    </div>
  );
}

export function BaseCardGridSkeleton({ count = 6 }) {
  return (
    <div className="skeleton-grid">
      {Array.from({ length: count }, (_, i) => (
        <BaseCardSkeleton key={i} />
      ))}
    </div>
  );
}
