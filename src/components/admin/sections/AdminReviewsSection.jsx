import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { platformDb } from '../../../lib/platformDb';
import { AdminPageHead, AdminLoading, AdminStatus, AdminAlert } from '../AdminUI';

export default function AdminReviewsSection() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const rows = await platformDb.listAllReviews();
      setItems(rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const moderate = async (id, status) => {
    setError('');
    try {
      await platformDb.updateReview(id, { status });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = items.filter((r) => !filter || r.status === filter);

  if (loading) return <AdminLoading />;

  return (
    <>
      <AdminPageHead title="Отзывы" subtitle="Модерация отзывов о базах" />
      <AdminAlert type="error">{error}</AdminAlert>
      <div className="admin-toolbar">
        {['', 'approved', 'pending', 'hidden'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            className={`admin-btn ${filter === s ? 'admin-btn--primary' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s || 'Все'}
          </button>
        ))}
      </div>
      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>База</th>
                <th>Автор</th>
                <th>Рейтинг</th>
                <th>Текст</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={6}><div className="admin-empty">Нет отзывов</div></td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td>{r.base_name || r.base_id}</td>
                  <td>{r.author_name || r.user_id}</td>
                  <td>{r.rating}</td>
                  <td style={{ maxWidth: 240 }}>{(r.text || '').slice(0, 120)}</td>
                  <td><AdminStatus status={r.status}>{r.status}</AdminStatus></td>
                  <td>
                    <div className="admin-table__actions">
                      <button type="button" className="admin-btn admin-btn--sm admin-btn--primary" onClick={() => moderate(r.id, 'approved')}>Одобрить</button>
                      <button type="button" className="admin-btn admin-btn--sm" onClick={() => moderate(r.id, 'hidden')}>Скрыть</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
