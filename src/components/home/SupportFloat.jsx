import { Link, useLocation } from 'react-router-dom';
import './SupportFloat.css';

const HIDE_PATHS = ['/support', '/support/thanks', '/admin', '/login', '/register', '/forum'];

/**
 * Floating bouncing CTA → /support (always visible except on donate/auth pages).
 */
export default function SupportFloat() {
  const { pathname } = useLocation();

  if (HIDE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

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
    </div>
  );
}
