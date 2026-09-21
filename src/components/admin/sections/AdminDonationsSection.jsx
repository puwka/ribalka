import { useEffect, useState } from 'react';
import { api, apiDataEnabled } from '../../../lib/apiClient';
import { AdminPageHead, AdminAlert, AdminLoading } from '../AdminUI';
import { formatMoney } from '../../owner/ListingPayment';

const STATUS_RU = {
  succeeded: 'Оплачено',
  pending: 'Ожидает',
  canceled: 'Отменено',
};

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

export default function AdminDonationsSection() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!apiDataEnabled) {
      setError('API выключен');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const next = await api.get('/api/payments/donations');
      setData(next);
    } catch (err) {
      setError(err.message || 'Не удалось загрузить');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <AdminLoading />;

  const s = data?.summary || {};
  const items = data?.items || [];

  return (
    <>
      <AdminPageHead
        title="Поддержка проекта"
        subtitle="Пожертвования через ЮKassa: суммы и плательщики"
      />
      <AdminAlert type="error">{error}</AdminAlert>

      <section className="admin-panel">
        <div className="admin-metrics">
          <div className="admin-metric">
            <div className="admin-metric__label">Собрано</div>
            <div className="admin-metric__value">{formatMoney(s.paidTotal || 0, 'RUB')}</div>
          </div>
          <div className="admin-metric">
            <div className="admin-metric__label">Оплат</div>
            <div className="admin-metric__value">{s.paidCount || 0}</div>
          </div>
          <div className="admin-metric">
            <div className="admin-metric__label">Уникальных email</div>
            <div className="admin-metric__value">{s.uniqueEmails || 0}</div>
          </div>
          <div className="admin-metric">
            <div className="admin-metric__label">Ожидают оплаты</div>
            <div className="admin-metric__value">{s.pendingCount || 0}</div>
          </div>
        </div>
        <div className="admin-toolbar" style={{ marginTop: 16 }}>
          <button type="button" className="admin-btn" onClick={load}>
            Обновить
          </button>
        </div>
      </section>

      <section className="admin-panel" style={{ marginTop: 16 }}>
        <h3>Последние платежи</h3>
        {!items.length ? (
          <p className="cabinet-panel__lead">Пока нет записей о поддержке.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Email</th>
                  <th>Сумма</th>
                  <th>Статус</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td>{formatWhen(row.paidAt || row.createdAt)}</td>
                    <td>{row.email || '—'}</td>
                    <td>{formatMoney(row.amount, row.currency || 'RUB')}</td>
                    <td>{STATUS_RU[row.status] || row.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
