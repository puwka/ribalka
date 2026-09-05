import { useEffect, useState } from 'react';
import { reviewsService } from '../../../services/reviewsService';
import { AdminPageHead, AdminLoading, AdminStatus, AdminAlert } from '../AdminUI';

export default function AdminReviewsSection() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const rows = await reviewsService.listForModeration(filter || 'all');
      setItems(rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
    } catch (err) {
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const moderate = async (id, status) => {
    setError('');
    try {
      await reviewsService.moderate(id, status);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <AdminLoading />;

  return (
    <>
      <AdminPageHead title="Отзывы" subtitle="Модерация отзывов о водоёмах" />
      <AdminAlert type="error">{error}</AdminAlert>
      <div className="admin-toolbar">
        {[
          { id: 'all', label: 'Все' },
          { id: 'approved', label: 'Одобренные' },
          { id: 'pending', label: 'На модерации' },
          { id: 'hidden', label: 'Скрытые' },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            className={`admin-btn ${filter === s.id ? 'admin-btn--primary' : ''}`}
            onClick={() => setFilter(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>
      <section className="admin-panel">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Водоём</th>
                <th>Автор</th>
                <th>Рейтинг</th>
                <th>Текст</th>
                <th>Статус</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="admin-empty">Нет отзывов</div>
                  </td>
                </tr>
              )}
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{r.target_name || r.base_name || r.target_id || r.base_id}</td>
                  <td>{r.author_name || r.user_id}</td>
                  <td>{r.rating}</td>
                  <td style={{ maxWidth: 240 }}>{(r.body || r.text || '').slice(0, 120)}</td>
                  <td>
                    <AdminStatus status={r.status}>{r.status}</AdminStatus>
                  </td>
                  <td>
                    <div className="admin-table__actions">
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm admin-btn--primary"
                        onClick={() => moderate(r.id, 'approved')}
                      >
                        Одобрить
                      </button>
                      <button
                        type="button"
                        className="admin-btn admin-btn--sm"
                        onClick={() => moderate(r.id, 'hidden')}
                      >
                        Скрыть
                      </button>
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
