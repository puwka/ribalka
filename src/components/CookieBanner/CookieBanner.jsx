import { useState, useEffect } from 'react';
import { useCmsSettings } from '../../hooks/useCms';
import './CookieBanner.css';

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const { data: settings } = useCmsSettings();

  useEffect(() => {
    const hasAccepted = localStorage.getItem('cookieAccepted');
    if (!hasAccepted) {
      setTimeout(() => setIsVisible(true), 1000);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('cookieAccepted', 'true');
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
    'Мы используем файлы cookie для улучшения работы сайта. Продолжая использовать сайт, вы соглашаетесь с нашей';

  return (
    <div className="cookie-banner">
      <div className="cookie-banner__content">
        <div className="cookie-banner__text">
          <span className="cookie-icon">🍪</span>
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