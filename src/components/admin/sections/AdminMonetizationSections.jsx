import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { listingPaymentService } from '../../../services/listingPaymentService';
import { AdminPlansTab, AdminPaymentsTab, AdminAdsTab } from '../AdminMonetization';
import { AdminPageHead, AdminAlert, AdminField, AdminLoading } from '../AdminUI';
import { formatMoney, ORDER_STATUS_RU } from '../../owner/ListingPayment';
import { apiDataEnabled } from '../../../lib/apiClient';
import '../../owner/OwnerMonetization.css';
import '../../owner/ListingPayment.css';

export function AdminPlansSection() {
  const { user } = useAuth();
  const [listing, setListing] = useState(null);
  const [directory, setDirectory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savingDir, setSavingDir] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!apiDataEnabled) return;
    listingPaymentService
      .getPrice()
      .then(setListing)
      .catch((err) => setError(err.message));
    listingPaymentService
      .getDirectoryPrices()
      .then(setDirectory)
      .catch(() => setDirectory(null));
  }, []);

  const saveListing = async () => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const saved = await listingPaymentService.savePrice(listing);
      setListing(saved);
      setMessage('Цена размещения базы сохранена.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveDirectoryKind = async (kind) => {
    setSavingDir(kind);
    setError('');
    setMessage('');
    try {
      const saved = await listingPaymentService.saveDirectoryPrice(kind, directory[kind]);
      setDirectory((d) => ({ ...d, [kind]: saved }));
      setMessage(`Тариф справочника (${kind}) сохранён.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingDir('');
    }
  };

  const dirLabels = {
    shop: 'Магазины',
    service: 'Сервисы',
    guide: 'Гиды',
  };

  return (
    <>
      <AdminPageHead title="Тарифы" subtitle="Размещение базы и позиций справочника" />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      {apiDataEnabled && (
        <section className="admin-panel" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Стоимость размещения базы</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Текущая цена применяется только к новым заказам. Уже созданные заказы сохраняют
            зафиксированную сумму.
          </p>
          {!listing ? (
            <AdminLoading />
          ) : (
            <>
              <AdminField label="Название услуги">
                <input
                  className="admin-input"
                  value={listing.title || ''}
                  onChange={(e) => setListing((s) => ({ ...s, title: e.target.value }))}
                />
              </AdminField>
              <div className="admin-grid-2">
                <AdminField label="Цена (₽)">
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    step="1"
                    value={listing.amount}
                    onChange={(e) =>
                      setListing((s) => ({ ...s, amount: Number(e.target.value) }))
                    }
                  />
                </AdminField>
                <AdminField label="Статус">
                  <select
                    className="admin-select"
                    value={listing.enabled ? '1' : '0'}
                    onChange={(e) =>
                      setListing((s) => ({ ...s, enabled: e.target.value === '1' }))
                    }
                  >
                    <option value="1">Включено</option>
                    <option value="0">Выключено</option>
                  </select>
                </AdminField>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={saving}
                onClick={saveListing}
              >
                {saving ? 'Сохранение…' : 'Сохранить цену базы'}
              </button>
            </>
          )}
        </section>
      )}

      {apiDataEnabled && (
        <section className="admin-panel" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Тарифы справочника</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Цены размещения магазинов, сервисов и гидов в справочнике.
          </p>
          {!directory ? (
            <AdminLoading />
          ) : (
            ['shop', 'service', 'guide'].map((kind) => (
              <div key={kind} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--color-border)' }}>
                <h4 style={{ marginTop: 0 }}>{dirLabels[kind]}</h4>
                <AdminField label="Название услуги">
                  <input
                    className="admin-input"
                    value={directory[kind]?.title || ''}
                    onChange={(e) =>
                      setDirectory((d) => ({
                        ...d,
                        [kind]: { ...d[kind], title: e.target.value },
                      }))
                    }
                  />
                </AdminField>
                <div className="admin-grid-2">
                  <AdminField label="Цена (₽)">
                    <input
                      className="admin-input"
                      type="number"
                      min="0"
                      step="1"
                      value={directory[kind]?.amount ?? 0}
                      onChange={(e) =>
                        setDirectory((d) => ({
                          ...d,
                          [kind]: { ...d[kind], amount: Number(e.target.value) },
                        }))
                      }
                    />
                  </AdminField>
                  <AdminField label="Статус">
                    <select
                      className="admin-select"
                      value={directory[kind]?.enabled ? '1' : '0'}
                      onChange={(e) =>
                        setDirectory((d) => ({
                          ...d,
                          [kind]: { ...d[kind], enabled: e.target.value === '1' },
                        }))
                      }
                    >
                      <option value="1">Включено</option>
                      <option value="0">Выключено</option>
                    </select>
                  </AdminField>
                </div>
                <button
                  type="button"
                  className="admin-btn admin-btn--primary"
                  disabled={savingDir === kind}
                  onClick={() => saveDirectoryKind(kind)}
                >
                  {savingDir === kind ? 'Сохранение…' : `Сохранить (${dirLabels[kind]})`}
                </button>
              </div>
            ))
          )}
        </section>
      )}

      <section className="admin-panel">
        <AdminPlansTab adminId={user.id} />
      </section>
    </>
  );
}

export function AdminPaymentsSection() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!apiDataEnabled) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const rows = await listingPaymentService.listAdmin({
          status: filter || undefined,
        });
        if (alive) setItems(rows);
      } catch (err) {
        if (alive) setError(err.message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [filter]);

  return (
    <>
      <AdminPageHead
        title="Платежи"
        subtitle="Заказы на размещение баз (ЮKassa). Суммы зафиксированы в заказе."
      />
      <AdminAlert type="error">{error}</AdminAlert>

      {apiDataEnabled ? (
        <section className="admin-panel">
          <div className="admin-toolbar">
            {['', 'waiting_for_payment', 'paid', 'cancelled', 'expired', 'failed'].map((s) => (
              <button
                key={s || 'all'}
                type="button"
                className={`admin-btn ${filter === s ? 'admin-btn--primary' : ''}`}
                onClick={() => setFilter(s)}
              >
                {s === '' ? 'Все' : ORDER_STATUS_RU[s] || s}
              </button>
            ))}
          </div>
          {loading ? (
            <AdminLoading />
          ) : items.length === 0 ? (
            <div className="admin-empty">Нет заказов</div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Заказ</th>
                    <th>Владелец</th>
                    <th>База</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                    <th>Payment ID</th>
                    <th>Создан</th>
                    <th>Оплачен</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <code>{o.id.slice(0, 8)}</code>
                      </td>
                      <td>
                        {o.user_name || o.user_email || o.user_id?.slice(0, 8)}
                      </td>
                      <td>{o.base_name || o.base_id?.slice(0, 8)}</td>
                      <td>{formatMoney(o.amount, o.currency)}</td>
                      <td>{ORDER_STATUS_RU[o.status] || o.status}</td>
                      <td>
                        <code>{o.provider_payment_id || '—'}</code>
                      </td>
                      <td>{new Date(o.created_at).toLocaleString('ru-RU')}</td>
                      <td>
                        {o.paid_at ? new Date(o.paid_at).toLocaleString('ru-RU') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : (
        <section className="admin-panel">
          <AdminPaymentsTab />
        </section>
      )}
    </>
  );
}

export function AdminAdsSection() {
  const { user } = useAuth();
  return (
    <>
      <AdminPageHead title="Реклама" subtitle="Модерация и создание рекламных размещений" />
      <section className="admin-panel">
        <AdminAdsTab adminId={user.id} />
      </section>
    </>
  );
}
