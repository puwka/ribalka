import { Link, useLocation } from 'react-router-dom';
import './WaterTypeSwitch.css';

export default function WaterTypeSwitch() {
  const { pathname } = useLocation();
  const isBases = pathname.startsWith('/paid-waters');
  const isFishing = pathname.startsWith('/paid-fishing');
  const isFree = pathname.startsWith('/free-waters');

  return (
    <nav className="water-type-switch" aria-label="Тип водоёмов">
      <Link
        to="/paid-waters"
        className={`water-type-switch__btn ${isBases ? 'is-active' : ''}`}
      >
        Платные базы
      </Link>
      <Link
        to="/paid-fishing"
        className={`water-type-switch__btn ${isFishing ? 'is-active' : ''}`}
      >
        Платная рыбалка
      </Link>
      <Link
        to="/free-waters"
        className={`water-type-switch__btn ${isFree ? 'is-active' : ''}`}
      >
        Бесплатные
      </Link>
    </nav>
  );
}
