import { useLocation } from 'react-router-dom';
import './SosFloat.css';

const HIDE_PATHS = ['/admin', '/login', '/register'];

/**
 * Emergency call buttons — work offline via tel: (no network needed).
 */
export default function SosFloat() {
  const { pathname } = useLocation();

  if (HIDE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  return (
    <div className="sos-float" role="region" aria-label="Экстренные вызовы">
      <a href="tel:112" className="sos-float__btn sos-float__btn--112" title="Позвонить 112">
        <span className="sos-float__num">112</span>
        <span className="sos-float__hint">Служба спасения</span>
      </a>
      <a href="tel:112" className="sos-float__btn sos-float__btn--sos" title="SOS — позвонить 112">
        SOS
      </a>
    </div>
  );
}
