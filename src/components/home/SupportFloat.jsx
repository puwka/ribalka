import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import './SupportFloat.css';

const HIDE_PATHS = ['/support', '/support/thanks', '/admin', '/login', '/register'];

/**
 * Floating bouncing CTA → /support (attention grabber; homepage form stays).
 */
export default function SupportFloat() {
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem('support_float_hide') === '1');
    } catch {
      setHidden(false);
    }
  }, []);

  if (hidden) return null;
  if (HIDE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  const dismiss = (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      sessionStorage.setItem('support_float_hide', '1');
    } catch {
      /* ignore */
    }
    setHidden(true);
  };

  return (
    <div className="support-float">
      <Link to="/support" className="support-float__card" aria-label="Поддержите проект">
        <span className="support-float__frame">
          <img
            src="/img/support-handshake.jpg"
            alt=""
            width={88}
            height={88}
            decoding="async"
          />
        </span>
        <span className="support-float__label">Поддержите проект</span>
      </Link>
      <button
        type="button"
        className="support-float__close"
        aria-label="Скрыть"
        onClick={dismiss}
      >
        ×
      </button>
    </div>
  );
}
