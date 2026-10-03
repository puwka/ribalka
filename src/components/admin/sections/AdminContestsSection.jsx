import { useEffect, useState } from 'react';
import { api, apiDataEnabled } from '../../../lib/apiClient';
import { AdminPageHead, AdminAlert, AdminLoading, AdminField } from '../AdminUI';

const STATUS_RU = {
  draft: 'Черновик',
  active: 'Активен',
  settled: 'Завершён',
  cancelled: 'Отменён',
};

const TYPE_RU = {
  reports: 'Конкурс отчётов',
  monthly_activity: 'Рейтинг (отзывы + комментарии)',
};

function formatMoney(n) {
  return `${Number(n || 0).toLocaleString('ru-RU')} ₽`;
}

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

function currentMonthValue() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const emptyForm = () => ({
  type: 'reports',
  title: '',
  description: '',
  month: currentMonthValue(),
  starts_at: '',
  ends_at: '',
  prize1: '3000',
  prize2: '2000',
  prize3: '1000',
  prize4: '500',
});

export default function AdminContestsSection() {
  const [tab, setTab] = useState('contests');
  const [list, setList] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [wdFilter, setWdFilter] = useState('pending');
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!apiDataEnabled) {
      setError('API выключен');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const [contests, wds] = await Promise.all([
        api.get('/api/contests/admin/all'),
        api.get(`/api/contests/wallet/withdrawals?status=${wdFilter}`),
      ]);
      setList(contests || []);
      setWithdrawals(wds || []);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wdFilter]);

  const createContest = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        type: form.type,
        title: form.title.trim(),
        description: form.description.trim(),
        prize1: Number(form.prize1) || 0,
        prize2: Number(form.prize2) || 0,
        prize3: Number(form.prize3) || 0,
        prize4: Number(form.prize4) || 0,
        status: 'active',
      };
      if (form.type === 'monthly_activity') {
        payload.month = form.month;
      } else {
        if (!form.starts_at || !form.ends_at) {
          throw new Error('Укажите даты начала и окончания');
        }
        payload.starts_at = new Date(form.starts_at).toISOString();
        payload.ends_at = new Date(form.ends_at).toISOString();
      }
      await api.post('/api/contests', payload);
      setForm(emptyForm());
      setMessage('Розыгрыш создан и запущен');
      await load();
    } catch (err) {
      setError(err.message || 'Не удалось создать');
    } finally {
      setSaving(false);
    }
  };

  const settle = async (id, force = false) => {
    if (!window.confirm(force ? 'Принудительно подвести итоги сейчас?' : 'Подвести итоги и начислить призы?')) {
      return;
    }
    setError('');
    try {
      await api.post(`/api/contests/${id}/settle`, { force });
      setMessage('Итоги подведены, призы начислены на балансы');
      await load();
    } catch (err) {
      setError(err.message || 'Ошибка подведения итогов');
    }
  };

  const reviewWd = async (id, status) => {
    const note =
      status === 'rejected'
        ? window.prompt('Причина отклонения (необязательно):') || ''
        : window.prompt('Комментарий (необязательно):') || '';
    try {
      await api.post(`/api/contests/wallet/withdrawals/${id}/review`, { status, note });
      setMessage(status === 'paid' ? 'Вывод подтверждён' : 'Вывод отклонён, сумма возвращена');
      await load();
    } catch (err) {
      setError(err.message || 'Ошибка');
    }
  };

  if (loading) return <AdminLoading />;

  return (
    <>
      <AdminPageHead
        title="Конкурсы и выводы"
        subtitle="Призы за отчёты (1–4) и месячный рейтинг отзывов/комментариев (1–3). Выводы на карту."
      />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      <div className="admin-toolbar" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`admin-btn ${tab === 'contests' ? 'admin-btn--primary' : ''}`}
          onClick={() => setTab('contests')}
        >
          Розыгрыши
        </button>
        <button
          type="button"
          className={`admin-btn ${tab === 'withdrawals' ? 'admin-btn--primary' : ''}`}
          onClick={() => setTab('withdrawals')}
        >
          Выводы
        </button>
        <button type="button" className="admin-btn" onClick={load}>
          Обновить
        </button>
      </div>

      {tab === 'contests' && (
        <>
          <section className="admin-panel">
            <h3>Новый розыгрыш</h3>
            <form onSubmit={createContest} className="admin-form-grid">
              <AdminField label="Тип">
                <select
                  className="admin-input"
                  value={form.type}
                  onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                >
                  <option value="reports">Конкурс среди отчётов (места 1–4)</option>
                  <option value="monthly_activity">Месячный рейтинг отзывов и комментариев (1–3)</option>
                </select>
              </AdminField>
              <AdminField label="Название">
                <input
                  className="admin-input"
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Осенний конкурс отчётов"
                />
              </AdminField>
              <AdminField label="Описание">
                <textarea
                  className="admin-textarea"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </AdminField>

              {form.type === 'monthly_activity' ? (
                <AdminField label="Месяц">
                  <input
                    className="admin-input"
                    type="month"
                    value={form.month}
                    onChange={(e) => setForm((f) => ({ ...f, month: e.target.value }))}
                  />
                </AdminField>
              ) : (
                <>
                  <AdminField label="Начало">
                    <input
                      className="admin-input"
                      type="datetime-local"
                      required
                      value={form.starts_at}
                      onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                    />
                  </AdminField>
                  <AdminField label="Окончание">
                    <input
                      className="admin-input"
                      type="datetime-local"
                      required
                      value={form.ends_at}
                      onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                    />
                  </AdminField>
                </>
              )}

              <AdminField label="1 место, ₽">
                <input
                  className="admin-input"
                  type="number"
                  min="0"
                  value={form.prize1}
                  onChange={(e) => setForm((f) => ({ ...f, prize1: e.target.value }))}
                />
              </AdminField>
              <AdminField label="2 место, ₽">
                <input
                  className="admin-input"
                  type="number"
                  min="0"
                  value={form.prize2}
                  onChange={(e) => setForm((f) => ({ ...f, prize2: e.target.value }))}
                />
              </AdminField>
              <AdminField label="3 место, ₽">
                <input
                  className="admin-input"
                  type="number"
                  min="0"
                  value={form.prize3}
                  onChange={(e) => setForm((f) => ({ ...f, prize3: e.target.value }))}
                />
              </AdminField>
              {form.type === 'reports' && (
                <AdminField label="4 место, ₽">
                  <input
                    className="admin-input"
                    type="number"
                    min="0"
                    value={form.prize4}
                    onChange={(e) => setForm((f) => ({ ...f, prize4: e.target.value }))}
                  />
                </AdminField>
              )}

              <div className="admin-toolbar">
                <button type="submit" className="admin-btn admin-btn--primary" disabled={saving}>
                  {saving ? 'Создание…' : 'Создать и запустить'}
                </button>
              </div>
            </form>
            <p className="cabinet-panel__lead" style={{ marginTop: 12 }}>
              После окончания периода призы начисляются на баланс автоматически (или кнопкой «Подвести
              итоги»). Участие: отчёты — лучший отчёт автора по лайкам/голосам; рейтинг — одобренные
              отзывы и комментарии за месяц.
            </p>
          </section>

          <section className="admin-panel" style={{ marginTop: 16 }}>
            <h3>Список</h3>
            {!list.length ? (
              <p className="cabinet-panel__lead">Пока нет розыгрышей</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Название</th>
                      <th>Тип</th>
                      <th>Период</th>
                      <th>Призы</th>
                      <th>Статус</th>
                      <th>Победители</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <strong>{c.title}</strong>
                          {c.description ? (
                            <>
                              <br />
                              <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                                {c.description}
                              </span>
                            </>
                          ) : null}
                        </td>
                        <td>{TYPE_RU[c.type] || c.type}</td>
                        <td>
                          {formatWhen(c.starts_at)}
                          <br />→ {formatWhen(c.ends_at)}
                        </td>
                        <td>
                          {(c.prizes || []).map((p) => (
                            <div key={p.place}>
                              {p.place}. {formatMoney(p.amount_rub)}
                            </div>
                          ))}
                        </td>
                        <td>{STATUS_RU[c.status] || c.status}</td>
                        <td>
                          {(c.awards || []).length === 0
                            ? '—'
                            : c.awards.map((a) => (
                                <div key={a.id}>
                                  {a.place}. {a.display_name || a.user_id?.slice(0, 8)} —{' '}
                                  {formatMoney(a.amount_rub)}
                                </div>
                              ))}
                        </td>
                        <td>
                          {c.status === 'active' && (
                            <div className="admin-toolbar" style={{ flexDirection: 'column' }}>
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm admin-btn--primary"
                                onClick={() => settle(c.id, false)}
                              >
                                Подвести итоги
                              </button>
                              <button
                                type="button"
                                className="admin-btn admin-btn--sm"
                                onClick={() => settle(c.id, true)}
                              >
                                Принудительно
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {tab === 'withdrawals' && (
        <section className="admin-panel">
          <div className="admin-toolbar" style={{ marginBottom: 12 }}>
            {['pending', 'paid', 'rejected', 'all'].map((s) => (
              <button
                key={s}
                type="button"
                className={`admin-btn ${wdFilter === s ? 'admin-btn--primary' : ''}`}
                onClick={() => setWdFilter(s)}
              >
                {s === 'pending'
                  ? 'На модерации'
                  : s === 'paid'
                    ? 'Выплачено'
                    : s === 'rejected'
                      ? 'Отклонено'
                      : 'Все'}
              </button>
            ))}
          </div>
          {!withdrawals.length ? (
            <p className="cabinet-panel__lead">Заявок нет</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Сумма</th>
                    <th>Карта</th>
                    <th>Реквизиты</th>
                    <th>Статус</th>
                    <th>Дата</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id}>
                      <td>
                        {w.display_name || '—'}
                        <br />
                        <span style={{ fontSize: '0.8rem', color: '#64748b' }}>{w.email}</span>
                      </td>
                      <td>{formatMoney(w.amount_rub)}</td>
                      <td>{w.card_masked}</td>
                      <td style={{ maxWidth: 220, whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                        {w.card_details}
                      </td>
                      <td>{w.status}</td>
                      <td>{formatWhen(w.created_at)}</td>
                      <td>
                        {w.status === 'pending' && (
                          <div className="admin-toolbar">
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--primary"
                              onClick={() => reviewWd(w.id, 'paid')}
                            >
                              Переведено
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn--sm admin-btn--danger"
                              onClick={() => reviewWd(w.id, 'rejected')}
                            >
                              Отклонить
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
