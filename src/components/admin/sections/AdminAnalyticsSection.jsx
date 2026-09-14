import { useEffect, useState } from 'react';
import { adminAnalyticsService } from '../../../services/adminAnalyticsService';
import { apiDataEnabled } from '../../../lib/apiClient';
import { AdminPageHead, AdminLoading, AdminAlert, AdminEmpty } from '../AdminUI';

const CATEGORY_RU = { shop: 'Магазин', service: 'Сервис', guide: 'Гид / егерь' };

function StatGrid({ items }) {
  return (
    <div className="admin-metrics" style={{ marginBottom: 16 }}>
      {items.map((it) => (
        <div key={it.label} className="admin-metric">
          <div className="admin-metric__label">{it.label}</div>
          <div className="admin-metric__value">{it.value ?? 0}</div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ columns, rows, empty = 'Нет данных за период' }) {
  if (!rows?.length) return <AdminEmpty>{empty}</AdminEmpty>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row.id || row.base_id || row.item_id || row.owner_id || idx}>
              {columns.map((c) => (
                <td key={c.key}>{c.render ? c.render(row) : row[c.key] ?? '—'}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminAnalyticsSection() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('bases');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        if (!apiDataEnabled) {
          throw new Error('Аналитика доступна при подключении API (VITE_USE_API)');
        }
        const next = await adminAnalyticsService.getOverview(days);
        if (alive) setData(next);
      } catch (err) {
        if (alive) setError(err.message || 'Не удалось загрузить статистику');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [days]);

  if (loading) return <AdminLoading />;

  const bases = data?.bases || {};
  const directory = data?.directory || {};

  return (
    <>
      <AdminPageHead
        title="Статистика размещений"
        subtitle="Просмотры, звонки и переходы по базам и справочнику (магазины, сервисы, егеря)"
        actions={
          <div className="admin-toolbar">
            {[7, 30, 90, 365].map((d) => (
              <button
                key={d}
                type="button"
                className={`admin-btn${days === d ? ' admin-btn--primary' : ''}`}
                onClick={() => setDays(d)}
              >
                {d === 365 ? 'Год' : `${d} дн.`}
              </button>
            ))}
          </div>
        }
      />

      {error && <AdminAlert type="error">{error}</AdminAlert>}

      <div className="admin-tabs" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`admin-tab${tab === 'bases' ? ' is-active' : ''}`}
          onClick={() => setTab('bases')}
        >
          Базы
        </button>
        <button
          type="button"
          className={`admin-tab${tab === 'directory' ? ' is-active' : ''}`}
          onClick={() => setTab('directory')}
        >
          Справочник
        </button>
        <button
          type="button"
          className={`admin-tab${tab === 'owners' ? ' is-active' : ''}`}
          onClick={() => setTab('owners')}
        >
          По владельцам
        </button>
      </div>

      {tab === 'bases' && (
        <section className="admin-panel">
          <h3 style={{ marginTop: 0 }}>Базы — итоги за {days} дн.</h3>
          <StatGrid
            items={[
              { label: 'Просмотры', value: bases.totals?.views },
              { label: 'Переходы', value: bases.totals?.clicks },
              { label: 'Звонки', value: bases.totals?.phone },
              { label: 'Карта', value: bases.totals?.map },
              { label: 'В избранное', value: bases.totals?.favorites },
            ]}
          />
          <h4>Топ баз</h4>
          <DataTable
            columns={[
              { key: 'name', label: 'База', render: (r) => r.name || r.base_id },
              { key: 'owner_name', label: 'Владелец' },
              { key: 'views', label: 'Просмотры' },
              { key: 'clicks', label: 'Переходы' },
              { key: 'phone', label: 'Звонки' },
              { key: 'favorites', label: 'Избранное' },
            ]}
            rows={bases.topItems}
          />
        </section>
      )}

      {tab === 'directory' && (
        <section className="admin-panel">
          <h3 style={{ marginTop: 0 }}>Справочник — итоги за {days} дн.</h3>
          <StatGrid
            items={[
              { label: 'Просмотры', value: directory.totals?.views },
              { label: 'Звонки', value: directory.totals?.phone },
              { label: 'Сайт / группа', value: directory.totals?.website },
            ]}
          />
          <h4>Топ карточек (магазины / сервисы / егеря)</h4>
          <DataTable
            columns={[
              { key: 'name', label: 'Карточка' },
              {
                key: 'category',
                label: 'Тип',
                render: (r) => CATEGORY_RU[r.category] || r.category || '—',
              },
              { key: 'owner_name', label: 'Владелец' },
              { key: 'views', label: 'Просмотры' },
              { key: 'phone', label: 'Звонки' },
              { key: 'website', label: 'Сайт' },
            ]}
            rows={directory.topItems}
          />
        </section>
      )}

      {tab === 'owners' && (
        <>
          <section className="admin-panel" style={{ marginBottom: 16 }}>
            <h3 style={{ marginTop: 0 }}>Владельцы баз</h3>
            <DataTable
              columns={[
                { key: 'owner_name', label: 'Владелец' },
                { key: 'views', label: 'Просмотры' },
                { key: 'clicks', label: 'Переходы' },
                { key: 'phone', label: 'Звонки' },
                { key: 'favorites', label: 'Избранное' },
              ]}
              rows={bases.byOwner}
            />
          </section>
          <section className="admin-panel">
            <h3 style={{ marginTop: 0 }}>Владельцы справочника</h3>
            <DataTable
              columns={[
                { key: 'owner_name', label: 'Владелец' },
                { key: 'views', label: 'Просмотры' },
                { key: 'phone', label: 'Звонки' },
                { key: 'website', label: 'Сайт' },
              ]}
              rows={directory.byOwner}
            />
          </section>
        </>
      )}
    </>
  );
}
