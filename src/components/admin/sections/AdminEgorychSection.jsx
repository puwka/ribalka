import { Link } from 'react-router-dom';

/**
 * Admin entry for Егорыч — open the public chat page.
 */
export default function AdminEgorychSection() {
  return (
    <div className="admin-panel">
      <header className="admin-panel__head">
        <div>
          <h1>Егорыч</h1>
          <p className="admin-panel__lead">
            AI-помощник Timeweb. Страница открыта для всех посетителей сайта.
          </p>
        </div>
      </header>

      <div
        className="admin-card"
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'center',
          padding: 20,
        }}
      >
        <img
          src="/img/egorych.png"
          alt=""
          width={72}
          height={72}
          style={{ borderRadius: '50%' }}
        />
        <div style={{ flex: '1 1 220px' }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>Открыть чат Егорыча</strong>
          <span style={{ opacity: 0.8, fontSize: '0.95rem' }}>
            Публичная страница: /forum (в меню — «Егорыч»).
          </span>
        </div>
        <Link className="admin-btn admin-btn--primary" to="/forum" target="_blank" rel="noreferrer">
          Открыть Егорыча
        </Link>
      </div>
    </div>
  );
}
