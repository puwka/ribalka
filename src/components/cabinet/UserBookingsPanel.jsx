import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { bookingService } from '../../services/bookingService';
import '../auth/AuthShared.css';

const STATUS_LABEL = {
  pending: 'Ожидает',
  confirmed: 'Подтверждена',
  cancelled: 'Отменена',
  completed: 'Завершена',
};

export default function UserBookingsPanel() {
  const { user, refresh } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    setError('');
    try {
      setItems(await bookingService.listMine(user.id));
    } catch (err) {
      setError(err.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const cancel = async (id) => {
    if (!window.confirm('Отменить бронь?')) return;
    setBusy(id);
    try {
      await bookingService.cancelByUser(user.id, id);
      await load();
      await refresh();
    } catch (err) {
      setError(err.message || 'Не удалось отменить');
    } finally {
      setBusy('');
    }
  };

  if (loading) return <div className="cabinet-panel">Загрузка бронирований…</div>;

  return (
    <div className="cabinet-panel">
      <h2>Мои бронирования</h2>
      <p className="cabinet-panel__lead">
        Заявки на платные базы. Статусы: pending → confirmed / cancelled → completed.
      </p>
      {error && <div className="auth-error">{error}</div>}
      <div className="cabinet-actions" style={{ marginBottom: 12 }}>
        <Link className="btn-primary" to="/paid-waters">
          Выбрать базу
        </Link>
      </div>
      <div className="cabinet-list">
        {items.length === 0 && (
          <div className="empty-state">Пока нет броней — откройте карточку платной базы</div>
        )}
        {items.map((b) => (
          <div key={b.id} className="cabinet-item">
            <div className="cabinet-item__title">
              {b.base_name}{' '}
              <span style={{ fontSize: '0.8rem', opacity: 0.75 }}>
                ({STATUS_LABEL[b.status] || b.status})
              </span>
            </div>
            <div className="cabinet-item__meta">
              {b.check_in} → {b.check_out} · {b.service} · гостей: {b.guests_count}
              {b.total_amount != null ? ` · ~${b.total_amount} ₽` : ''}
              <br />
              Создано: {new Date(b.created_at).toLocaleString('ru-RU')}
              {b.decision_note ? (
                <>
                  <br />
                  {b.decision_note}
                </>
              ) : null}
            </div>
            {['pending', 'confirmed'].includes(b.status) && (
              <div className="cabinet-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={busy === b.id}
                  onClick={() => cancel(b.id)}
                >
                  Отменить
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
