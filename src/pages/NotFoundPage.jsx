import { Link } from 'react-router-dom';
import '../components/auth/AuthShared.css';

export default function NotFoundPage() {
  return (
    <div className="cabinet-shell" style={{ padding: '64px 16px', textAlign: 'center' }}>
      <h1>Страница не найдена</h1>
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
