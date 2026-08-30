import { Link, useLocation } from 'react-router-dom';
import './WaterTypeSwitch.css';

export default function WaterTypeSwitch() {
  const { pathname } = useLocation();
  const isPaid = pathname.startsWith('/paid-waters');

  return (
    <nav className="water-type-switch" aria-label="Тип водоёмов">
      <Link
        to="/paid-waters"
        className={`water-type-switch__btn ${isPaid ? 'is-active' : ''}`}
      >
        Платные
      </Link>
      <Link
        to="/free-waters"
        className={`water-type-switch__btn ${!isPaid ? 'is-active' : ''}`}
      >
        Бесплатные
      </Link>
    </nav>
  );
}
