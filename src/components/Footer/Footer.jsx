import { useEffect, useState } from 'react';
import { useSmartNavigation } from '../../hooks/useSmartNavigation';
import { useCmsSettings, useCmsFooter } from '../../hooks/useCms';
import { usePermTime } from '../../hooks/usePermTime';
import {
  getState as getPwaState,
  openPwaInstallPrompt,
  promptPwaInstall,
  subscribePwaInstall,
} from '../../lib/pwaInstall';
import './Footer.css';

const BG = '/img/home/footer-bg.jpg?v=3';

const MENU_LEFT = [
  { label: 'Главная', url: '/', icon: 'home' },
  { label: 'Платные базы', url: '/paid-waters', icon: 'tent' },
  { label: 'Платная рыбалка', url: '/paid-fishing', icon: 'fish' },
  { label: 'Бесплатные водоёмы', url: '/free-waters', icon: 'wave' },
  { label: 'Карта', url: '/map', icon: 'map' },
];

const MENU_RIGHT = [
  { label: 'Лунный календарь', url: '/lunar', icon: 'moon' },
  { label: 'Справочник', url: '/directory', icon: 'book' },
  { label: 'Отчёты об отдыхе', url: '/reports', icon: 'chart' },
  { label: 'Егорыч', url: '/forum', icon: 'user' },
  { label: 'Новости', url: '/news/all', icon: 'news' },
];

function MenuIcon({ type }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true,
  };
  if (type === 'home') {
    return (
      <svg {...common}>
        <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />
      </svg>
    );
  }
  if (type === 'tent') {
    return (
      <svg {...common}>
        <path d="M12 4l8 16H4L12 4z" />
        <path d="M12 4v16" />
      </svg>
    );
  }
  if (type === 'fish') {
    return (
      <svg {...common}>
        <path d="M4 12c4-5 9-6 14-3 2 1.2 3.5 1.2 5 .4-1.2 3.2-3.8 5.8-9 5.8S5.8 13.8 4 12z" />
        <circle cx="15.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (type === 'wave') {
    return (
      <svg {...common}>
        <path d="M3 14c2.2-2 4.2-2 6 0s3.8 2 6 0 3.8-2 6 0" />
        <path d="M3 9c2.2-2 4.2-2 6 0s3.8 2 6 0 3.8-2 6 0" />
      </svg>
    );
  }
  if (type === 'map') {
    return (
      <svg {...common}>
        <path d="M9 4l6 2 6-2v16l-6 2-6-2-6 2V6l6-2z" />
        <path d="M9 4v16M15 6v16" />
      </svg>
    );
  }
  if (type === 'moon') {
    return (
      <svg {...common}>
        <path d="M15 3.5A7.5 7.5 0 1019.5 14 6 6 0 0115 3.5z" />
        <path d="M17.5 7.5l.5 1.2 1.2.5-1.2.5-.5 1.2-.5-1.2-1.2-.5 1.2-.5.5-1.2z" />
      </svg>
    );
  }
  if (type === 'book') {
    return (
      <svg {...common}>
        <path d="M4 5.5A2.5 2.5 0 016.5 3H20v16H6.5A2.5 2.5 0 004 16.5v-11z" />
        <path d="M8 7h8M8 11h6" />
      </svg>
    );
  }
  if (type === 'chart') {
    return (
      <svg {...common}>
        <path d="M4 19h16" />
        <path d="M7 16V9M12 16V5M17 16v-4" />
      </svg>
    );
  }
  if (type === 'user') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 19c1.4-3.2 3.8-4.8 7-4.8S17.6 15.8 19 19" />
      </svg>
    );
  }
  if (type === 'news') {
    return (
      <svg {...common}>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </svg>
    );
  }
  if (type === 'download') {
    return (
      <svg {...common}>
        <path d="M12 4v10" />
        <path d="M8 10l4 4 4-4" />
        <path d="M5 18h14" />
      </svg>
    );
  }
  if (type === 'doc') {
    return (
      <svg {...common}>
        <path d="M7 3h7l4 4v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" />
        <path d="M14 3v4h4M9 12h6M9 16h4" />
      </svg>
    );
  }
  if (type === 'shield') {
    return (
      <svg {...common}>
        <path d="M12 3l7 3v5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3z" />
        <path d="M9.5 12l1.8 1.8L15 10" />
      </svg>
    );
  }
  if (type === 'mail') {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 8l9 6 9-6" />
      </svg>
    );
  }
  if (type === 'cal') {
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    );
  }
  if (type === 'clock') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </svg>
    );
  }
  return null;
}

export default function Footer() {
  const { handleClick } = useSmartNavigation();
  const { data: settings } = useCmsSettings();
  const { data: footer } = useCmsFooter();
  const { time, date, weekday } = usePermTime();
  const [pwa, setPwa] = useState(getPwaState);

  useEffect(() => subscribePwaInstall(setPwa), []);

  const brandText =
    footer?.brandText ||
    settings?.tagline ||
    'Всё о рыбалке и отдыхе в Пермском крае. Найдите своё идеальное место для незабываемого отдыха на природе.';
  const email = settings?.contactEmail || 'info@aktiv59.ru';
  const ogrnip = settings?.legalOgrnip || '326595800114060';
  const inn = settings?.legalInn || '590415452100';

  const socialRaw = settings?.social || {};
  const social = {
    telegram:
      !socialRaw.telegram ||
      socialRaw.telegram === 'https://t.me/' ||
      socialRaw.telegram === 'https://t.me'
        ? 'https://t.me/aktiv59ru'
        : socialRaw.telegram,
    vk:
      !socialRaw.vk ||
      socialRaw.vk === 'https://vk.com' ||
      socialRaw.vk === 'https://vk.com/'
        ? 'https://vk.ru/aktiv59ru'
        : socialRaw.vk,
  };

  const openModal = (modalType) => {
    const button = document.getElementById(
      `open${modalType.charAt(0).toUpperCase() + modalType.slice(1)}`,
    );
    if (button) button.click();
  };

  const onFooterClick = (e, target) => {
    handleClick(e, target);
  };

  const weekdayCap = weekday ? weekday.charAt(0).toUpperCase() + weekday.slice(1) : '';

  return (
    <footer className="footer" id="contacts">
      <div className="footer__bg" aria-hidden style={{ backgroundImage: `url(${BG})` }}>
        <img src={BG} alt="" width={1920} height={1080} decoding="async" fetchPriority="low" />
        <div className="footer__bg-shade" />
      </div>

      <div className="footer__inner">
        <div className="footer__cards">
          {/* Brand */}
          <div className="footer-card footer-card--brand">
            <h2 className="footer-card__title footer-card__title--brand">
              активный отдых и рыбалка Пермского края
              <span className="footer-card__doodle footer-card__doodle--fish" aria-hidden>
                <svg viewBox="0 0 32 18" fill="none">
                  <path
                    d="M2 9c4-5 10-6 16-3 3 1.5 5 1.5 7 .3-1 3.2-3.5 5.8-8.5 5.8S4.5 11 2 9z"
                    stroke="#1e3a8a"
                    strokeWidth="1.4"
                  />
                  <circle cx="20" cy="7.2" r="1" fill="#1e3a8a" />
                </svg>
              </span>
              <span className="footer-card__doodle footer-card__doodle--sun" aria-hidden>
                ☀
              </span>
            </h2>
            <p className="footer-card__text">{brandText}</p>

            {footer?.showDateTime !== false && (
              <div className="footer-card__meta">
                <div className="footer-meta">
                  <span className="footer-meta__icon">
                    <MenuIcon type="cal" />
                  </span>
                  <div>
                    <span className="footer-meta__label">Сегодня</span>
                    <span className="footer-meta__value">
                      {date} {weekdayCap}
                    </span>
                  </div>
                </div>
                <div className="footer-meta footer-meta--time">
                  <span className="footer-meta__icon">
                    <MenuIcon type="clock" />
                  </span>
                  <div>
                    <span className="footer-meta__label">Время</span>
                    <span className="footer-meta__value">{time || '—'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Menu */}
          <div className="footer-card footer-card--menu">
            <div className="footer-card__menu-head">
              <h2 className="footer-card__title footer-card__title--menu">Меню</h2>
            </div>
            <div className="footer-menu">
              <ul className="footer-menu__col">
                {MENU_LEFT.map((item) => (
                  <li key={item.url}>
                    <a href={item.url} onClick={(e) => onFooterClick(e, item.url)}>
                      <MenuIcon type={item.icon} />
                      <span>{item.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
              <ul className="footer-menu__col">
                {MENU_RIGHT.map((item) => (
                  <li key={item.url}>
                    <a href={item.url} onClick={(e) => onFooterClick(e, item.url)}>
                      <MenuIcon type={item.icon} />
                      <span>{item.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="footer-menu__bottom">
              <a href="/about" onClick={(e) => onFooterClick(e, '/about')}>
                <MenuIcon type="user" />
                <span>О нас</span>
              </a>
              {!pwa.installed && (
                <>
                  <span className="footer-menu__sep" aria-hidden />
                  <button
                    type="button"
                    className="footer-menu__install"
                    onClick={async () => {
                      if (pwa.canPrompt) await promptPwaInstall();
                      else openPwaInstallPrompt();
                    }}
                  >
                    <MenuIcon type="download" />
                    <span>Установить приложение</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Legal */}
          <div className="footer-card footer-card--legal">
            <h2 className="footer-card__title footer-card__title--legal">Юридическая информация</h2>
            <ul className="footer-legal">
              <li>
                <span className="footer-legal__icon">
                  <MenuIcon type="doc" />
                </span>
                <div>
                  <span className="footer-legal__label">ОГРНИП</span>
                  <span className="footer-legal__value">{ogrnip}</span>
                </div>
              </li>
              <li>
                <span className="footer-legal__icon">
                  <MenuIcon type="shield" />
                </span>
                <div>
                  <span className="footer-legal__label">ИНН</span>
                  <span className="footer-legal__value">{inn}</span>
                </div>
              </li>
              <li>
                <span className="footer-legal__icon">
                  <MenuIcon type="mail" />
                </span>
                <div>
                  <span className="footer-legal__label">Email для связи</span>
                  <a href={`mailto:${email}`} className="footer-legal__value footer-legal__link">
                    {email}
                  </a>
                </div>
              </li>
            </ul>
            <div className="footer-legal__links">
              <button type="button" onClick={() => openModal('privacy')}>
                Политика конфиденциальности
              </button>
              <button type="button" onClick={() => openModal('terms')}>
                Пользовательское соглашение
              </button>
            </div>
            <span className="footer-card__leaf" aria-hidden>
              <svg viewBox="0 0 48 40" fill="none">
                <path
                  d="M8 28c8-14 18-20 32-22-2 12-8 22-20 28-6 2-10 0-12-6z"
                  fill="#86efac"
                  opacity=".85"
                />
                <path
                  d="M14 30c6-8 14-12 24-14"
                  stroke="#166534"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>
        </div>

        <div className="footer__glow" aria-hidden />

        <div className="footer__bar">
          <p className="footer__credit">
            Сайт разработан{' '}
            <span className="footer__credit-brand">web studia orange</span>
          </p>
          {footer?.showSocial !== false && (
            <div className="footer__social">
              {social.vk && (
                <a
                  href={social.vk}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer__social-link"
                  aria-label="ВКонтакте"
                >
                  <span className="footer__social-badge" aria-hidden>
                    VK
                  </span>
                  <span>VK</span>
                </a>
              )}
              {social.telegram && (
                <a
                  href={social.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer__social-link"
                  aria-label="Telegram"
                >
                  <span className="footer__social-badge footer__social-badge--tg" aria-hidden>
                    ✈
                  </span>
                  <span>Telegram</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
