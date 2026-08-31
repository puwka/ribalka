import { Link } from 'react-router-dom';
import './Logo.css';

/**
 * Replaceable brand mark. Swap internals later without touching Header/Footer.
 */
export default function Logo({
  to = '/',
  variant = 'default',
  onClick,
  className = '',
}) {
  const classes = ['brand-logo', `brand-logo--${variant}`, className].filter(Boolean).join(' ');

  const inner = (
    <>
      <span className="brand-logo__mark" aria-hidden>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect width="28" height="28" rx="8" className="brand-logo__mark-bg" />
          <path
            d="M6.5 16.5c2.2-1.6 4.1-.9 5.8.2 1.9 1.2 3.6 1.8 5.7.1 1.3-1 2.4-1.4 3.5-1.3"
            className="brand-logo__mark-wave"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M7 20c2-.9 3.6-.4 5.2.4 1.7.9 3.3 1.4 5.2.1 1.2-.8 2.3-1.2 3.6-1.1"
            className="brand-logo__mark-wave brand-logo__mark-wave--soft"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </span>
      <span className="brand-logo__text">
        <span className="brand-logo__name">Рыбалка</span>
        <span className="brand-logo__sub">в Прикамье</span>
      </span>
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
