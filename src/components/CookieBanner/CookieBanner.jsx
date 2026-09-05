import { useState, useEffect } from 'react';
import { useCmsSettings } from '../../hooks/useCms';
import './CookieBanner.css';

function CookieIcon() {
  return (
    <svg className="cookie-banner__icon" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="18" fill="currentColor" opacity="0.12" />
      <circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="14" cy="16" r="1.6" fill="currentColor" />
      <circle cx="22" cy="14" r="1.4" fill="currentColor" />
      <circle cx="17" cy="23" r="1.5" fill="currentColor" />
      <circle cx="25" cy="22" r="1.3" fill="currentColor" />
      <circle cx="20" cy="19" r="1.2" fill="currentColor" />
    </svg>
  );
}

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const { data: settings } = useCmsSettings();

  useEffect(() => {
    const hasAccepted = localStorage.getItem('cookieAccepted');
    if (!hasAccepted) {
      const timer = setTimeout(() => setIsVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieAccepted', 'true');
    window.dispatchEvent(new Event('cookie-accepted'));
    setIsVisible(false);
  };

  const openPrivacyPolicy = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const button = document.getElementById('openPrivacy');
    if (button) button.click();
  };

  if (!isVisible) return null;

  const cookieText =
    settings?.cookieText ||
    'Мы используем файлы cookie, чтобы сайт работал стабильнее: запоминаем настройки, улучшаем карту и каталог водоёмов.';

  return (
    <aside className="cookie-banner" role="dialog" aria-labelledby="cookie-banner-title" aria-live="polite">
      <div className="cookie-banner__inner">
        <div className="cookie-banner__visual" aria-hidden="true">
          <CookieIcon />
        </div>
        <div className="cookie-banner__body">
          <h2 id="cookie-banner-title" className="cookie-banner__title">
            Мы используем cookie
          </h2>
          <p className="cookie-banner__text">
            {cookieText}{' '}
            <a href="#privacy" className="cookie-banner__link" onClick={openPrivacyPolicy}>
              Политика конфиденциальности
            </a>
          </p>
        </div>
        <div className="cookie-banner__actions">
          <button type="button" className="cookie-banner__btn cookie-banner__btn--primary" onClick={handleAccept}>
            Принять
          </button>
          <button type="button" className="cookie-banner__btn cookie-banner__btn--ghost" onClick={openPrivacyPolicy}>
            Подробнее
          </button>
        </div>
      </div>
    </aside>
  );
}
