import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { api, apiDataEnabled } from '../../../lib/apiClient';
import { AdminPageHead, AdminAlert, AdminField, AdminLoading } from '../AdminUI';

const DEFAULT_DISTRICTS = [
  'Пермский край',
  'Чусовской район',
  'Кунгурский район',
  'Добрянский район',
  'Краснокамский район',
  'Оханский район',
  'Осинский район',
  'Чайковский район',
  'Кудымкарский район',
  'Соликамский район',
  'Березники',
  'Пермь',
];

export default function AdminDistrictsSection() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      if (!apiDataEnabled) {
        setItems(DEFAULT_DISTRICTS.map((n, i) => ({ id: `local-${i}`, name: n, active: true, sort_order: i * 10 })));
        return;
      }
      const rows = await api.get('/api/cms/districts/all');
      setItems(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const persist = async (next) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (!apiDataEnabled) {
        setItems(next);
        setMessage('Сохранено локально (API выключен)');
        return;
      }
      const saved = await api.put('/api/cms/districts', next);
      setItems(saved);
      setMessage('Районы сохранены — появятся в фильтре каталога');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const add = async () => {
    const n = name.trim();
    if (!n) return;
    if (items.some((d) => d.name.toLowerCase() === n.toLowerCase())) {
      setError('Такой район уже есть');
      return;
    }
    const next = [
      ...items,
      { id: `d-${crypto.randomUUID().slice(0, 8)}`, name: n, active: true, sort_order: items.length * 10 },
    ];
    setName('');
    await persist(next);
  };

  const remove = async (id) => {
    await persist(items.filter((d) => d.id !== id));
  };

  const toggle = async (id) => {
    await persist(items.map((d) => (d.id === id ? { ...d, active: !d.active } : d)));
  };

  if (loading) return <AdminLoading />;

  return (
    <>
      <AdminPageHead
        title="Районы"
        subtitle="Список районов для фильтра на страницах платных и бесплатных водоёмов"
      />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      <section className="admin-panel">
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
          Добавьте районы здесь, затем укажите тот же район в карточке водоёма (поле «Регион /
          район»). Тогда район появится в фильтре у посетителей.
        </p>
        <div className="admin-toolbar" style={{ alignItems: 'flex-end' }}>
          <AdminField label="Новый район">
            <input
              className="admin-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Чусовской район"
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
          </AdminField>
          <button type="button" className="admin-btn admin-btn--primary" disabled={saving} onClick={add}>
            Добавить
          </button>
        </div>

        {items.length === 0 ? (
          <div className="admin-empty">Пока нет районов</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>В фильтре</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((d) => (
                  <tr key={d.id}>
                    <td>{d.name}</td>
                    <td>{d.active !== false ? 'Да' : 'Нет'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button type="button" className="admin-btn admin-btn--sm" onClick={() => toggle(d.id)}>
                        {d.active !== false ? 'Скрыть' : 'Показать'}
                      </button>{' '}
                      <button type="button" className="admin-btn admin-btn--sm" onClick={() => remove(d.id)}>
                        Удалить
                      </button>
                    </td>
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
