import { Link, useLocation } from 'react-router-dom';
import './SupportFloat.css';

/** Floating CTA → /support — only on home page. */
export default function SupportFloat() {
  const { pathname } = useLocation();

  if (pathname !== '/') return null;

  return (
    <div className="support-float">
      <Link to="/support" className="support-float__card" aria-label="Поддержите проект">
        <span className="support-float__frame">
          <img
            src="/img/support-handshake.jpg"
            alt=""
            width={56}
            height={56}
            decoding="async"
          />
        </span>
        <span className="support-float__label">Поддержите проект</span>
      </Link>
    </div>
  );
}
