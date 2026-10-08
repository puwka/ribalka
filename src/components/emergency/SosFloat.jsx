import { useLocation } from 'react-router-dom';
import './SosFloat.css';

/** Emergency call buttons — home page only; work offline via tel:. */
export default function SosFloat() {
  const { pathname } = useLocation();

  if (pathname !== '/') return null;

  return (
    <div className="sos-float" role="region" aria-label="Экстренные вызовы">
      <a href="tel:112" className="sos-float__btn sos-float__btn--112" title="Позвонить 112">
        <span className="sos-float__num">112</span>
        <span className="sos-float__hint">Спасение</span>
      </a>
      <a href="tel:112" className="sos-float__btn sos-float__btn--sos" title="SOS — позвонить 112">
        SOS
      </a>
    </div>
  );
}
