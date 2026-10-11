import DonateForm from './DonateForm';
import './SupportProjectSection.css';

const BG = '/img/home/support-bg.jpg';

const TRUST = [
  { key: 'ssl', title: 'Защищённое соединение', icon: 'lock' },
  { key: 'pay', title: 'Проверенные платёжные системы', icon: 'card' },
  { key: 'law', title: 'Официальная деятельность и отчётность', icon: 'doc' },
];

const FUNDS = [
  {
    pct: '40%',
    title: 'Чистые реки и водоёмы',
    text: 'Уборка берегов и мониторинг качества воды',
    tone: 'fish',
  },
  {
    pct: '30%',
    title: 'Экотуризм и маршруты',
    text: 'Карта, точки доступа и навигация для рыбаков',
    tone: 'tent',
  },
  {
    pct: '20%',
    title: 'Контент и сообщество',
    text: 'Фото, отчёты и поддержка авторов',
    tone: 'cam',
  },
  {
    pct: '10%',
    title: 'Серверы и развитие',
    text: 'Хостинг, безопасность и новые функции',
    tone: 'leaf',
  },
];

function TrustIcon({ type }) {
  if (type === 'lock') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M8 11V8a4 4 0 118 0v3" fill="none" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  if (type === 'card') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <rect x="3" y="6" width="18" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="1.7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path
        d="M7 4h7l3 3v13a1 1 0 01-1 1H7a1 1 0 01-1-1V5a1 1 0 011-1z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function FundIcon({ tone }) {
  if (tone === 'fish') {
    return (
      <svg viewBox="0 0 48 48" aria-hidden>
        <circle cx="24" cy="24" r="22" fill="#e0f2fe" />
        <path
          d="M10 24c6-7 14-8 22-4 4 2 7 2 10 1-2 5-6 9-14 9-8 0-14-3-18-6z"
          fill="none"
          stroke="#0284c7"
          strokeWidth="2"
        />
        <circle cx="18" cy="22" r="1.4" fill="#0284c7" />
      </svg>
    );
  }
  if (tone === 'tent') {
    return (
      <svg viewBox="0 0 48 48" aria-hidden>
        <circle cx="24" cy="24" r="22" fill="#dcfce7" />
        <path d="M12 34l12-18 12 18H12z" fill="none" stroke="#15803d" strokeWidth="2" />
        <path d="M24 16v18" stroke="#15803d" strokeWidth="2" />
      </svg>
    );
  }
  if (tone === 'cam') {
    return (
      <svg viewBox="0 0 48 48" aria-hidden>
        <circle cx="24" cy="24" r="22" fill="#fef3c7" />
        <rect x="12" y="18" width="24" height="16" rx="3" fill="none" stroke="#b45309" strokeWidth="2" />
        <circle cx="24" cy="26" r="4" fill="none" stroke="#b45309" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden>
      <circle cx="24" cy="24" r="22" fill="#ccfbf1" />
      <path
        d="M24 34v-10M24 24c-5-1-8-5-8-10 5 0 8 4 8 10zm0 0c5-1 8-5 8-10-5 0-8 4-8 10z"
        fill="none"
        stroke="#0f766e"
        strokeWidth="2"
      />
    </svg>
  );
}

/**
 * Homepage “Поддержите проект” — scenic mock layout.
 */
export default function SupportProjectSection({ config = {} }) {
  const title =
    config.title || 'Поддержать проект — вместе сохраним красоту Перми';
  const description =
    config.description ||
    'Ваш вклад помогает развивать активный отдых и беречь природу Пермского края: карту, каталог мест, контент рыбаков и стабильную работу сайта.';

  return (
    <section className="support-home" id="support-project" aria-labelledby="support-project-title">
      <div className="support-home__bg" aria-hidden="true">
        <img src={BG} alt="" width={1920} height={1080} loading="lazy" decoding="async" />
        <div className="support-home__bg-shade" />
      </div>

      <div className="support-home__inner section-inner section-inner--wide">
        <div className="support-home__panel">
          <div className="support-home__copy">
            <h2 id="support-project-title" className="support-home__title">
              <span className="support-home__title-mark">
                {title}
                <span className="support-home__heart" aria-hidden="true">
                  ♡
                </span>
              </span>
            </h2>
            <p className="support-home__lead">{description}</p>

            <ul className="support-home__trust">
              {TRUST.map((item) => (
                <li key={item.key}>
                  <span className="support-home__trust-ico" aria-hidden="true">
                    <TrustIcon type={item.icon} />
                  </span>
                  <span>{item.title}</span>
                </li>
              ))}
            </ul>

            <div className="support-home__funds">
              <h3 className="support-home__funds-title">Куда идут ваши средства</h3>
              <div className="support-home__funds-grid">
                {FUNDS.map((item) => (
                  <article key={item.title} className="support-home__fund">
                    <div className="support-home__fund-art" aria-hidden="true">
                      <FundIcon tone={item.tone} />
                      <span className="support-home__fund-pct">{item.pct}</span>
                    </div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>

          <div className="support-home__form">
            <DonateForm variant="scenic" config={config} note="" />
          </div>
        </div>
      </div>
    </section>
  );
}
