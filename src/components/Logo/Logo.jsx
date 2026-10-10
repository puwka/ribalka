import { Link } from 'react-router-dom';
import './Logo.css';

/**
 * Replaceable brand mark. Swap internals later without touching Header/Footer.
 * variant: default | compact | on-dark | round (mark only, circular)
 */
export default function Logo({
  to = '/',
  variant = 'default',
  onClick,
  className = '',
}) {
  const classes = ['brand-logo', `brand-logo--${variant}`, className].filter(Boolean).join(' ');
  const isRound = variant === 'round';

  const inner = (
    <>
      <span className="brand-logo__mark" aria-hidden>
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
          {isRound ? (
            <circle cx="18" cy="18" r="18" className="brand-logo__mark-bg" />
          ) : (
            <rect width="36" height="36" rx="10" className="brand-logo__mark-bg" />
          )}
          <path
            d="M8 20.5c2.8-2 5.2-1.1 7.3.3 2.4 1.5 4.5 2.2 7.1.1 1.6-1.2 3-1.7 4.4-1.6"
            className="brand-logo__mark-wave"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M9 25c2.5-1.1 4.5-.5 6.5.5 2.1 1.1 4.1 1.7 6.5.1 1.5-1 2.9-1.5 4.5-1.4"
            className="brand-logo__mark-wave brand-logo__mark-wave--soft"
            strokeWidth="1.6"
            strokeLinecap="round"
            fill="none"
          />
          {isRound && (
            <path
              d="M10 14.5c1.8-2.2 4-3.4 6.5-3.4 2.2 0 4 .8 5.5 2.2"
              className="brand-logo__mark-wave brand-logo__mark-wave--soft"
              strokeWidth="1.5"
              strokeLinecap="round"
              fill="none"
            />
          )}
        </svg>
      </span>
      {!isRound && (
        <span className="brand-logo__text">
          <span className="brand-logo__name">Рыбалка</span>
          <span className="brand-logo__sub">в Прикамье</span>
        </span>
      )}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={classes} onClick={onClick} aria-label="Рыбалка в Прикамье — на главную">
        {inner}
      </Link>
    );
  }

  return (
    <span className={classes} aria-label="Рыбалка в Прикамье">
      {inner}
    </span>
  );
}
