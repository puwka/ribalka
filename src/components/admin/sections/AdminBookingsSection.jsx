import { useEffect, useState } from 'react';
import { bookingsDb } from '../../../lib/bookingsDb';
import { AdminPageHead, AdminLoading, AdminStatus, AdminTable } from '../AdminUI';

export default function AdminBookingsSection() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const rows = await bookingsDb.listAll();
        setItems(rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = items.filter((b) => !filter || b.status === filter);

  if (loading) return <AdminLoading />;

  return (
    <>
      <AdminPageHead title="Бронирования" subtitle="Все брони на платформе" />
      <div className="admin-toolbar">
        {['', 'pending', 'confirmed', 'cancelled', 'completed'].map((s) => (
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
        <AdminTable
          columns={[
            { key: 'base', label: 'База', render: (b) => b.base_name },
            { key: 'guest', label: 'Гость', render: (b) => b.contact_name },
            { key: 'dates', label: 'Даты', render: (b) => `${b.check_in} – ${b.check_out}` },
            { key: 'status', label: 'Статус', render: (b) => <AdminStatus status={b.status}>{b.status}</AdminStatus> },
            { key: 'amount', label: 'Сумма', render: (b) => (b.total_amount ? `${b.total_amount} ₽` : '—') },
            { key: 'created', label: 'Создано', render: (b) => new Date(b.created_at).toLocaleDateString('ru-RU') },
          ]}
          rows={filtered.map((b) => ({ ...b, _key: b.id }))}
        />
      </section>
    </>
  );
}
