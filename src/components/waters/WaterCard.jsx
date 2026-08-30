import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuth } from '../auth/AuthContext';

import { favoritesService } from '../../services/favoritesService';

import { formatPaidPrice } from '../../lib/waterUtils';

import './WaterCard.css';

function PlaceholderImage() {
  return <div className="water-card__placeholder" aria-hidden />;
}

function WaterCardImage({ images = [], alt = '' }) {
  const [index, setIndex] = useState(0);
  const list = images.filter(Boolean);
  const src = list[index];

  if (!src || index < 0) return <PlaceholderImage />;

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => {
        if (index < list.length - 1) {
          setIndex((i) => i + 1);
        } else {
          setIndex(-1);
        }
      }}
    />
  );
}

export default function WaterCard({ item, variant = 'paid', layout = 'grid' }) {
  const navigate = useNavigate();

  const { user, isAuthenticated, refresh } = useAuth();

  const isPaid = variant === 'paid';

  const detailPath = `/waters/${item.id}`;

  const toggleFavorite = async (e) => {
    e.preventDefault();

    e.stopPropagation();

    if (!isAuthenticated || !user) {
      navigate('/login', { state: { from: detailPath } });

      return;
    }

    try {
      await favoritesService.toggleBaseOrPlace(user.id, item);

      await refresh();
    } catch (err) {
      alert(err.message);
    }
  };

  const location = [item.region, item.locality].filter(Boolean).join(', ');

  const metaPrimary = isPaid ? formatPaidPrice(item) : 'Бесплатная рыбалка';

  const metaSecondary = isPaid
    ? [item.waterKind, item.fish?.split(',')[0]?.trim()].filter(Boolean).join(' · ')
    : [item.waterKind, location].filter(Boolean).join(' · ');

  if (layout === 'row') {
    return (
      <article className={`water-card water-card--row water-card--${variant}`}>
        <Link to={detailPath} className="water-card__row-link">
          <div className="water-card__media water-card__media--sm">
            <WaterCardImage images={item.images} alt="" />
          </div>

          <div className="water-card__row-body">
            <h3 className="water-card__title">{item.name}</h3>

            <p className="water-card__meta">
              <span className={`water-card__meta-primary water-card__meta-primary--${variant}`}>
                {metaPrimary}
              </span>

              {metaSecondary && <span className="water-card__meta-sep"> — </span>}

              {metaSecondary && <span>{metaSecondary}</span>}
            </p>

            {item.short && <p className="water-card__excerpt">{item.short}</p>}
          </div>
        </Link>

        <div className="water-card__row-actions">
          <Link to={detailPath} className="water-card__text-link">
            Подробнее
          </Link>

          <button type="button" className="water-card__text-link" onClick={toggleFavorite}>
            В избранное
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className={`water-card water-card--${variant}`}>
      <Link to={detailPath} className="water-card__link">
        <div className="water-card__media">
          <WaterCardImage images={item.images} alt={item.name} />
        </div>

        <div className="water-card__body">
          <p className={`water-card__meta-primary water-card__meta-primary--${variant}`}>
            {metaPrimary}
          </p>

          <h3 className="water-card__title">{item.name}</h3>

          {location && <p className="water-card__location">{location}</p>}

          {item.short && <p className="water-card__excerpt">{item.short}</p>}
        </div>
      </Link>

      <div className="water-card__footer">
        <Link to={detailPath} className="water-card__text-link">
          Подробнее
        </Link>

        <button type="button" className="water-card__text-link" onClick={toggleFavorite}>
          В избранное
        </button>
      </div>
    </article>
  );
}

export function PaidWaterCard({ item, layout }) {
  return <WaterCard item={item} variant="paid" layout={layout} />;
}

export function FreeWaterCard({ item, layout }) {
  return <WaterCard item={item} variant="free" layout={layout} />;
}

export function WaterCardSkeleton() {
  return (
    <div className="skeleton-card water-card-skeleton">
      <div className="skeleton-card__img" />

      <div className="skeleton-card__body">
        <div className="skeleton-line" />

        <div className="skeleton-line skeleton-line--short" />
      </div>
    </div>
  );
}

export function WaterCardGridSkeleton({ count = 6 }) {
  return (
    <div className="water-catalog__grid skeleton-grid">
      {Array.from({ length: count }, (_, i) => (
        <WaterCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function WaterCardListSkeleton({ count = 5 }) {
  return (
    <div className="water-catalog__list">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="water-card water-card--row water-card--skeleton">
          <div className="skeleton-card__img water-card__media--sm" />

          <div className="skeleton-line" style={{ flex: 1 }} />
        </div>
      ))}
    </div>
  );
}
