import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminDashboardService } from '../../../services/adminDashboardService';
import { AdminPageHead, AdminLoading } from '../AdminUI';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [s, f] = await Promise.all([
          adminDashboardService.getStats(),
          adminDashboardService.getActivityFeed(15),
        ]);
        setStats(s);
        setFeed(f);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <AdminLoading />;

  return (
    <>
      <AdminPageHead
        title="Dashboard"
        subtitle="Обзор платформы и последние события"
      />

      <div className="admin-metrics">
        <div className="admin-metric">
          <div className="admin-metric__label">Пользователи</div>
          <div className="admin-metric__value">{stats?.users ?? 0}</div>
        </div>
        <div className="admin-metric">
          <div className="admin-metric__label">Новые (7д)</div>
          <div className="admin-metric__value">{stats?.newUsers ?? 0}</div>
        </div>
        <div className="admin-metric">
          <div className="admin-metric__label">Водоёмы</div>
          <div className="admin-metric__value">{stats?.watersTotal ?? 0}</div>
        </div>
        <div className="admin-metric">
          <div className="admin-metric__label">Заявки баз</div>
          <div className="admin-metric__value">{stats?.pendingBases ?? 0}</div>
        </div>
        <div className="admin-metric">
          <div className="admin-metric__label">Отчёты</div>
          <div className="admin-metric__value">{stats?.pendingReports ?? 0}</div>
        </div>
        <div className="admin-metric">
          <div className="admin-metric__label">Брони</div>
          <div className="admin-metric__value">{stats?.bookingsPending ?? 0}</div>
        </div>
        <div className="admin-metric">
          <div className="admin-metric__label">Платежи</div>
          <div className="admin-metric__value">{stats?.paymentsTotal ?? 0}</div>
        </div>
        <div className="admin-metric">
          <div className="admin-metric__label">Выручка</div>
          <div className="admin-metric__value">
            {Math.round(stats?.revenue || 0).toLocaleString('ru-RU')} ₽
          </div>
        </div>
      </div>

      <div className="admin-grid-2">
        <section className="admin-panel">
          <h3>Очередь модерации</h3>
          <div className="admin-feed">
            <div className="admin-feed__item">
              <div>
                <div className="admin-feed__title">Заявки на базы</div>
                <div className="admin-feed__meta">{stats?.pendingBases ?? 0} ожидают</div>
              </div>
              <Link to="/admin/bases" className="admin-btn admin-btn--sm">Открыть</Link>
            </div>
            <div className="admin-feed__item">
              <div>
                <div className="admin-feed__title">Отчёты</div>
                <div className="admin-feed__meta">{stats?.pendingReports ?? 0} ожидают</div>
              </div>
              <Link to="/admin/reports" className="admin-btn admin-btn--sm">Открыть</Link>
            </div>
            <div className="admin-feed__item">
              <div>
                <div className="admin-feed__title">Форум</div>
                <div className="admin-feed__meta">{stats?.pendingForum ?? 0} ожидают</div>
              </div>
              <Link to="/admin/forum" className="admin-btn admin-btn--sm">Открыть</Link>
            </div>
            <div className="admin-feed__item">
              <div>
                <div className="admin-feed__title">Районы</div>
                <div className="admin-feed__meta">Фильтр каталога</div>
              </div>
              <Link to="/admin/districts" className="admin-btn admin-btn--sm">Открыть</Link>
            </div>
          </div>
        </section>

        <section className="admin-panel">
          <h3>Последние действия</h3>
          {!feed.length && <div className="admin-empty">Пока нет событий</div>}
          <div className="admin-feed">
            {feed.map((item) => (
              <div key={item.id} className="admin-feed__item">
                <div>
                  <div className="admin-feed__title">{item.title}</div>
                  <div className="admin-feed__meta">{item.meta}</div>
                </div>
                <div className="admin-feed__date">
                  {formatDate(item.at)}
                  {item.link ? (
                    <>
                      {' · '}
                      <Link to={item.link}>→</Link>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
