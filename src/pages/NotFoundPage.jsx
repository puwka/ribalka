import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../components/auth/AuthShared.css';

function setRobots(content) {
  let el = document.querySelector('meta[name="robots"]');
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute('name', 'robots');
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

export default function NotFoundPage() {
  useEffect(() => {
    const prevTitle = document.title;
    const prevRobots =
      document.querySelector('meta[name="robots"]')?.getAttribute('content') || 'index,follow';

    document.title = 'Страница не найдена (404) — Рыбалка в Прикамье';
    setRobots('noindex,nofollow');

    return () => {
      document.title = prevTitle;
      setRobots(prevRobots);
    };
  }, []);

  return (
    <div className="cabinet-shell" style={{ padding: '64px 16px', textAlign: 'center' }}>
      <h1>404 — страница не найдена</h1>
      <p style={{ color: '#64748b', margin: '12px 0 24px' }}>
        Проверьте адрес или вернитесь на главную.
      </p>
      <div className="cabinet-actions" style={{ justifyContent: 'center' }}>
        <Link className="btn-primary" to="/">
          На главную
        </Link>
        <Link className="btn-secondary" to="/map">
          Карта
        </Link>
      </div>
    </div>
  );
}
