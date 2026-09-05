import { useState, useEffect } from 'react';
import { useCmsSettings } from '../../hooks/useCms';
import './CookieBanner.css';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const { data: settings } = useCmsSettings();

  // Show banner after 1s if not accepted
  useEffect(() => {
    const hasAccepted = localStorage.getItem('cookieAccepted');
    if (!hasAccepted) {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieAccepted', 'true');
    setIsVisible(false);
  };

  const openPrivacyPolicy = e => {
    e.preventDefault();
    e.stopPropagation();
    const button = document.getElementById('openPrivacy');
    if (button) button.click();
  };

  if (!isVisible) return null;

  const cookieText =
    settings?.cookieText ||
    'Мы используем файлы cookie для улучшения работы сайта. Продолжая использовать сайт, вы соглашаетесь с нашей';

  return (
    <div className="cookie-banner cookie-banner--visible" role="alert" aria-live="polite">
      <div className="cookie-banner__content">
        <div className="cookie-banner__text">
          <span className="cookie-icon" aria-hidden="true">🍪</span>
          <p>
            {cookieText}{' '}
            <a href="#privacy" className="cookie-link" onClick={openPrivacyPolicy}>
              политикой конфиденциальности
            </a>
            .
          </p>
        </div>
        <button className="cookie-btn" onClick={handleAccept}>
          Ознакомился
        </button>
      </div>
    </div>
  );
}