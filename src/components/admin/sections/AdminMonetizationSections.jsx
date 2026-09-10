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
      const saved = await listingPaymentService.savePrice({
        ...listing,
        kind: 'constructor',
      });
      setListing(saved);
      setMessage('Тариф Конструктор (базы) сохранён.');
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
      const saved = await listingPaymentService.saveDirectoryPrice(kind, directory.service || directory[kind]);
      setDirectory((d) => ({ ...d, service: saved, directory: saved }));
      setMessage('Тариф справочника сохранён.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingDir('');
    }
  };

  return (
    <>
      <AdminPageHead title="Тарифы" subtitle="Конструктор — платные базы; второй тариф — справочник" />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      {apiDataEnabled && (
        <section className="admin-panel" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Тариф Конструктор (платные базы)</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            2900 ₽/мес база (1 фото + 1 видео), опции и скидки за 3 / 6 / 12 месяцев. Цена для новых
            заказов на размещение базы.
          </p>
          {!listing ? (
            <AdminLoading />
          ) : (
            <>
              <AdminField label="Название">
                <input
                  className="admin-input"
                  value={listing.title || ''}
                  onChange={(e) => setListing((s) => ({ ...s, title: e.target.value }))}
                />
              </AdminField>
              <div className="admin-grid-2">
                <AdminField label="База ₽/мес (1 фото + 1 видео)">
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    value={listing.baseAmount ?? listing.amount ?? 2900}
                    onChange={(e) =>
                      setListing((s) => ({
                        ...s,
                        baseAmount: Number(e.target.value),
                        amount: Number(e.target.value),
                      }))
                    }
                  />
                </AdminField>
                <AdminField label="ТОП ₽/мес">
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    value={listing.addonTop ?? 1000}
                    onChange={(e) => setListing((s) => ({ ...s, addonTop: Number(e.target.value) }))}
                  />
                </AdminField>
                <AdminField label="Жёлтая рамка ₽/мес">
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    value={listing.addonFrame ?? 390}
                    onChange={(e) => setListing((s) => ({ ...s, addonFrame: Number(e.target.value) }))}
                  />
                </AdminField>
                <AdminField label="+1 фото ₽">
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    value={listing.addonPhoto ?? 100}
                    onChange={(e) => setListing((s) => ({ ...s, addonPhoto: Number(e.target.value) }))}
                  />
                </AdminField>
                <AdminField label="+1 видео ₽">
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    value={listing.addonVideo ?? 100}
                    onChange={(e) => setListing((s) => ({ ...s, addonVideo: Number(e.target.value) }))}
                  />
                </AdminField>
                <AdminField label="Статус">
                  <select
                    className="admin-select"
                    value={listing.enabled ? '1' : '0'}
                    onChange={(e) => setListing((s) => ({ ...s, enabled: e.target.value === '1' }))}
                  >
                    <option value="1">Включено</option>
                    <option value="0">Выключено</option>
                  </select>
                </AdminField>
              </div>
              <div className="admin-grid-2">
                <AdminField label="Скидка 3 мес. %">
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    max="100"
                    value={listing.discount3 ?? 10}
                    onChange={(e) => setListing((s) => ({ ...s, discount3: Number(e.target.value) }))}
                  />
                </AdminField>
                <AdminField label="Скидка 6 мес. %">
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    max="100"
                    value={listing.discount6 ?? 20}
                    onChange={(e) => setListing((s) => ({ ...s, discount6: Number(e.target.value) }))}
                  />
                </AdminField>
                <AdminField label="Скидка 12 мес. %">
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    max="100"
                    value={listing.discount12 ?? 30}
                    onChange={(e) => setListing((s) => ({ ...s, discount12: Number(e.target.value) }))}
                  />
                </AdminField>
              </div>
              <button
                type="button"
                className="admin-btn admin-btn--primary"
                disabled={saving}
                onClick={saveListing}
              >
                {saving ? 'Сохранение…' : 'Сохранить Конструктор'}
              </button>
            </>
          )}
        </section>
      )}

      {apiDataEnabled && (
        <section className="admin-panel" style={{ marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Тариф справочника (магазины, сервисы, гиды / егеря)</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Этот тариф управляет формой «Разместить в справочнике» на сайте. Пользователь оплачивает
            через ЮKassa, заявка появляется здесь в разделе Справочник → Заявки.
          </p>
          {!directory ? (
            <AdminLoading />
          ) : (
            <>
              <AdminField label="Название">
                <input
                  className="admin-input"
                  value={directory.service?.title || ''}
                  onChange={(e) =>
                    setDirectory((d) => ({
                      ...d,
                      service: { ...d.service, title: e.target.value },
                    }))
                  }
                />
              </AdminField>
              <div className="admin-grid-2">
                <AdminField label="Цена ₽/мес">
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    value={directory.service?.amountPerMonth ?? directory.service?.amount ?? 590}
                    onChange={(e) =>
                      setDirectory((d) => ({
                        ...d,
                        service: { ...d.service, amountPerMonth: Number(e.target.value) },
                      }))
                    }
                  />
                </AdminField>
                <AdminField label="ТОП ₽/мес">
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    value={directory.service?.addonTop ?? 500}
                    onChange={(e) =>
                      setDirectory((d) => ({
                        ...d,
                        service: { ...d.service, addonTop: Number(e.target.value) },
                      }))
                    }
                  />
                </AdminField>
                <AdminField label="Жёлтая рамка ₽/мес">
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    value={directory.service?.addonFrame ?? 100}
                    onChange={(e) =>
                      setDirectory((d) => ({
                        ...d,
                        service: { ...d.service, addonFrame: Number(e.target.value) },
                      }))
                    }
                  />
                </AdminField>
                <AdminField label="Приём заявок">
                  <select
                    className="admin-select"
                    value={directory.service?.enabled !== false ? '1' : '0'}
                    onChange={(e) =>
                      setDirectory((d) => ({
                        ...d,
                        service: { ...d.service, enabled: e.target.value === '1' },
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
                disabled={savingDir === 'service'}
                onClick={() => saveDirectoryKind('service')}
              >
                {savingDir === 'service' ? 'Сохранение…' : 'Сохранить тариф справочника'}
              </button>
            </>
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
  const [dirItems, setDirItems] = useState([]);
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
        const [rows, dirRows] = await Promise.all([
          listingPaymentService.listAdmin({ status: filter || undefined }),
          listingPaymentService.listDirectoryOrdersAdmin({ status: filter || undefined }).catch(() => []),
        ]);
        if (alive) {
          setItems(rows);
          setDirItems(dirRows);
        }
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
        subtitle="Заказы размещения баз и справочника (ЮKassa)"
      />
      <AdminAlert type="error">{error}</AdminAlert>

      {apiDataEnabled ? (
        <>
          <section className="admin-panel" style={{ marginBottom: 16 }}>
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
            <h3 style={{ marginTop: 8 }}>Базы</h3>
            {loading ? (
              <AdminLoading />
            ) : items.length === 0 ? (
              <div className="admin-empty">Нет заказов баз</div>
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
                        <td>{o.user_name || o.user_email || o.user_id?.slice(0, 8)}</td>
                        <td>{o.base_name || o.base_id?.slice(0, 8)}</td>
                        <td>{formatMoney(o.amount, o.currency)}</td>
                        <td>{ORDER_STATUS_RU[o.status] || o.status}</td>
                        <td>
                          <code>{o.provider_payment_id || '—'}</code>
                        </td>
                        <td>{new Date(o.created_at).toLocaleString('ru-RU')}</td>
                        <td>{o.paid_at ? new Date(o.paid_at).toLocaleString('ru-RU') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="admin-panel">
            <h3 style={{ marginTop: 0 }}>Справочник (магазины / сервисы / гиды)</h3>
            {loading ? (
              <AdminLoading />
            ) : dirItems.length === 0 ? (
              <div className="admin-empty">Нет заказов справочника</div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Заказ</th>
                      <th>Пользователь</th>
                      <th>Категория</th>
                      <th>Название</th>
                      <th>Сумма</th>
                      <th>Статус</th>
                      <th>Создан</th>
                      <th>Оплачен</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dirItems.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <code>{o.id.slice(0, 8)}</code>
                        </td>
                        <td>{o.user_name || o.user_email || o.user_id?.slice(0, 8)}</td>
                        <td>{o.category}</td>
                        <td>{o.payload?.name || o.description || '—'}</td>
                        <td>{formatMoney(o.amount, o.currency)}</td>
                        <td>{ORDER_STATUS_RU[o.status] || o.status}</td>
                        <td>{new Date(o.created_at).toLocaleString('ru-RU')}</td>
                        <td>{o.paid_at ? new Date(o.paid_at).toLocaleString('ru-RU') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
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
