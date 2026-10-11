import { Link } from 'react-router-dom';
import './Hero.css';

const HERO_BG = '/img/hero/hero-bg.jpg';

const FEATURES = [
  {
    to: '/forum',
    label: 'егорыч',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path
          d="M5 19c1.4-3.2 3.8-4.8 7-4.8S17.6 15.8 19 19"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    to: '/map',
    label: 'карта',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M9 4l6 2 6-2v16l-6 2-6-2-6 2V6l6-2z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M9 4v16M15 6v16" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
  {
    to: '/directory',
    label: 'справочник',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 004 16.5v-11z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M8 7h8M8 11h6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/paid-waters',
    label: 'базы отдыха',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 11l8-6 8 6v8H4v-8z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path d="M10 19v-5h4v5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    ),
  },
];

function Bobber() {
  return (
    <span className="hero__bobber" aria-hidden="true">
      <svg viewBox="0 0 64 72" className="hero__bobber-svg">
        <ellipse cx="32" cy="66" rx="14" ry="3.5" fill="#1e3a5f" opacity="0.25" />
        <path d="M32 8v14" stroke="#1e3a5f" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="32" cy="6" r="3.2" fill="#ef4444" />
        <path
          d="M20 36c0-10 5.5-18 12-18s12 8 12 18v6c0 4-3 8-12 8s-12-4-12-8v-6z"
          fill="#fff"
        />
        <path d="M20 36c0-10 5.5-18 12-18s12 8 12 18H20z" fill="#ef4444" />
        <path
          d="M18 48c4 6 10 9 14 9s10-3 14-9"
          fill="none"
          stroke="#38bdf8"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.9"
        />
        <path
          d="M22 52c3 3.5 7 5 10 5s7-1.5 10-5"
          fill="none"
          stroke="#7dd3fc"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.75"
        />
      </svg>
    </span>
  );
}

export default function Hero() {
  return (
    <section className="hero" id="home">
      <div className="hero__bg" aria-hidden="true">
        <img src={HERO_BG} alt="" width={1920} height={1080} fetchPriority="high" decoding="async" />
        <div className="hero__bg-shade" />
      </div>

      <div className="hero__content">
        <h1 className="hero__title">
          <span className="hero__title-line hero__title-line--script">Активный отдых</span>
          <span className="hero__title-line hero__title-line--accent">
            <span className="hero__title-and">и</span>
            <span className="hero__title-fish">рыбалка</span>
            <Bobber />
          </span>
          <span className="hero__title-line hero__title-line--place">в Пермском крае</span>
        </h1>

        <ul className="hero__features">
          {FEATURES.map((item, i) => (
            <li key={item.label} style={{ '--i': i }}>
              <Link to={item.to} className="hero__feature">
                <span className="hero__feature-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>

        <div className="hero__actions">
          <Link to="/paid-waters" className="hero__btn hero__btn--blue">
            <span className="hero__btn-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="M4 11l8-6 8 6v8H4v-8z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path d="M10 19v-5h4v5" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </span>
            <span>Базы отдыха</span>
            <span className="hero__btn-arrow" aria-hidden="true">
              →
            </span>
          </Link>

          <Link to="/free-waters" className="hero__btn hero__btn--yellow">
            <span className="hero__btn-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path
                  d="M3 12c4-5 8-5 12-2 3 2 5 2 6 1-2 4-5 6-9 6-5 0-8-2-9-5z"
                  fill="currentColor"
                />
                <circle cx="8.5" cy="11.5" r="1.2" fill="#fff" />
              </svg>
            </span>
            <span>Где порыбачить</span>
            <span className="hero__btn-arrow" aria-hidden="true">
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
