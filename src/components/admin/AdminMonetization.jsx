import { useEffect, useState } from 'react';
import { plansService } from '../../services/plansService';
import { paymentService } from '../../services/paymentService';
import { advertisingService } from '../../services/advertisingService';
import '../owner/OwnerMonetization.css';

const emptyPlan = () => ({
  code: '',
  name: '',
  description: '',
  price_month: 990,
  price_year: 9900,
  discount_year_percent: 17,
  period_days_month: 30,
  period_days_year: 365,
  features: '',
  bases: 1,
  ads_active: 1,
  featured: false,
  search_boost: false,
  mailing: false,
  target_role: 'owner',
  is_active: true,
  sort_order: 100,
});

export function AdminPlansTab({ adminId }) {
  const [plans, setPlans] = useState([]);
  const [form, setForm] = useState(emptyPlan());
  const [editId, setEditId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => setPlans(await plansService.list());
  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    setError('');
    setMessage('');
    try {
      const payload = {
        ...form,
        features: String(form.features)
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean),
        limits: {
          bases: Number(form.bases),
          ads_active: Number(form.ads_active),
          featured: Boolean(form.featured),
          search_boost: Boolean(form.search_boost),
          mailing: Boolean(form.mailing),
        },
      };
      if (editId) await plansService.update(adminId, editId, payload);
      else await plansService.create(adminId, payload);
      setForm(emptyPlan());
      setEditId(null);
      setMessage('Тариф сохранён');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setForm({
      code: p.code,
      name: p.name,
      description: p.description || '',
      price_month: p.price_month,
      price_year: p.price_year,
      discount_year_percent: p.discount_year_percent || 0,
      period_days_month: p.period_days_month || 30,
      period_days_year: p.period_days_year || 365,
      features: (p.features || []).join('\n'),
      bases: p.limits?.bases ?? 1,
      ads_active: p.limits?.ads_active ?? 0,
      featured: Boolean(p.limits?.featured),
      search_boost: Boolean(p.limits?.search_boost),
      mailing: Boolean(p.limits?.mailing),
      target_role: p.target_role || 'owner',
      is_active: p.is_active !== false,
      sort_order: p.sort_order || 100,
    });
  };

  return (
    <div className="admin-info">
      <h3>Тарифные планы</h3>
      {error && <div className="login-error">{error}</div>}
      {message && <div style={{ color: '#047857', fontWeight: 700, marginBottom: 8 }}>{message}</div>}

      <div className="mon-admin-form">
        <strong>{editId ? 'Редактирование' : 'Новый тариф'}</strong>
        <div className="mon-admin-row">
          <label>
            Code
            <input
              value={form.code}
              disabled={Boolean(editId)}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
          </label>
          <label>
            Название
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
        </div>
        <label>
          Описание
          <textarea
            rows={2}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <div className="mon-admin-row">
          <label>
            Цена / мес
            <input
              type="number"
              value={form.price_month}
              onChange={(e) => setForm({ ...form, price_month: e.target.value })}
            />
          </label>
          <label>
            Цена / год
            <input
              type="number"
              value={form.price_year}
              onChange={(e) => setForm({ ...form, price_year: e.target.value })}
            />
          </label>
        </div>
        <div className="mon-admin-row">
          <label>
            Скидка год %
            <input
              type="number"
              value={form.discount_year_percent}
              onChange={(e) => setForm({ ...form, discount_year_percent: e.target.value })}
            />
          </label>
          <label>
            Срок мес (дни)
            <input
              type="number"
              value={form.period_days_month}
              onChange={(e) => setForm({ ...form, period_days_month: e.target.value })}
            />
          </label>
          <label>
            Срок год (дни)
            <input
              type="number"
              value={form.period_days_year}
              onChange={(e) => setForm({ ...form, period_days_year: e.target.value })}
            />
          </label>
        </div>
        <label>
          Функции (по строке)
          <textarea
            rows={4}
            value={form.features}
            onChange={(e) => setForm({ ...form, features: e.target.value })}
          />
        </label>
        <div className="mon-admin-row">
          <label>
            Лимит баз
            <input
              type="number"
              value={form.bases}
              onChange={(e) => setForm({ ...form, bases: e.target.value })}
            />
          </label>
          <label>
            Лимит реклам
            <input
              type="number"
              value={form.ads_active}
              onChange={(e) => setForm({ ...form, ads_active: e.target.value })}
            />
          </label>
          <label>
            Роль
            <select
              value={form.target_role}
              onChange={(e) => setForm({ ...form, target_role: e.target.value })}
            >
              <option value="owner">Владелец</option>
              <option value="user">Пользователь</option>
            </select>
          </label>
        </div>
        <label>
          <input
            type="checkbox"
            checked={form.featured}
            onChange={(e) => setForm({ ...form, featured: e.target.checked })}
          />{' '}
          Рекомендуемое размещение
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.search_boost}
            onChange={(e) => setForm({ ...form, search_boost: e.target.checked })}
          />{' '}
          Продвижение в поиске
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.mailing}
            onChange={(e) => setForm({ ...form, mailing: e.target.checked })}
          />{' '}
          Рассылка
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
          />{' '}
          Активен
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="admin-btn admin-btn-primary" onClick={save}>
            Сохранить
          </button>
          {editId && (
            <button
              type="button"
              className="admin-btn admin-btn-secondary"
              onClick={() => {
                setEditId(null);
                setForm(emptyPlan());
              }}
            >
              Отмена
            </button>
          )}
        </div>
      </div>

      <div className="mon-admin-grid">
        {plans.map((p) => (
          <div
            key={p.id}
            style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, background: '#fff' }}
          >
            <strong>
              {p.name} ({p.code}) {p.is_active ? '' : '· выкл'}
            </strong>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {p.price_month} ₽/мес · {p.price_year} ₽/год (−{p.discount_year_percent || 0}%)
              <br />
              {(p.features || []).join(' · ')}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => startEdit(p)}>
                Изменить
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={async () => {
                  await plansService.setActive(adminId, p.id, !p.is_active);
                  await load();
                }}
              >
                {p.is_active ? 'Выключить' : 'Включить'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPaymentsTab() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    paymentService.listAll().then(setItems);
  }, []);

  return (
    <div className="admin-info">
      <h3>Платежи</h3>
      <p style={{ color: '#64748b' }}>
        Архитектура: ЮKassa / Robokassa через Edge Function. Секреты только на сервере.
      </p>
      <div className="mon-admin-grid">
        {items.length === 0 && <p>Платежей нет</p>}
        {items.map((p) => (
          <div
            key={p.id}
            style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, background: '#fff' }}
          >
            <strong>
              {p.amount} {p.currency} · {p.status} · {p.provider}
            </strong>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {p.plan_name} · {p.billing_period} · user {p.user_id}
              <br />
              {new Date(p.created_at).toLocaleString('ru-RU')}
              {p.paid_at ? ` · paid ${new Date(p.paid_at).toLocaleString('ru-RU')}` : ''}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminAdsTab({ adminId }) {
  const [filter, setFilter] = useState('pending');
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');
  const [createTitle, setCreateTitle] = useState('');

  const load = async () => {
    setItems(await advertisingService.listForModeration(filter));
  };
  useEffect(() => {
    load();
  }, [filter]);

  const act = async (id, action) => {
    setError('');
    try {
      const note = action === 'reject' ? window.prompt('Причина') || '' : '';
      await advertisingService.moderate(adminId, id, { action, note });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="admin-info">
      <h3>Рекламные размещения</h3>
      {error && <div className="login-error">{error}</div>}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '12px 0' }}>
        {['pending', 'approved', 'active', 'rejected', 'paused', 'disabled', 'draft', 'all'].map((s) => (
          <button
            key={s}
            type="button"
            className={`admin-btn ${filter === s ? 'admin-btn-primary' : 'admin-btn-secondary'}`}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mon-admin-form">
        <strong>Создать размещение (ADMIN)</strong>
        <input
          value={createTitle}
          onChange={(e) => setCreateTitle(e.target.value)}
          placeholder="Заголовок"
        />
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={async () => {
            if (!createTitle.trim()) return;
            await advertisingService.adminCreate(adminId, {
              title: createTitle.trim(),
              ad_type: 'banner',
              status: 'active',
            });
            setCreateTitle('');
            setFilter('active');
            await load();
          }}
        >
          Создать и включить
        </button>
      </div>

      <div className="mon-admin-grid">
        {items.map((ad) => (
          <div
            key={ad.id}
            style={{ border: '1px solid #e2e8f0', borderRadius: 12, padding: 12, background: '#fff' }}
          >
            <strong>
              {ad.title} · {ad.ad_type} · {ad.status}
            </strong>
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {ad.budget} ₽ · owner {ad.owner_id}
              <br />
              {(ad.description || '').slice(0, 160)}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button type="button" className="admin-btn admin-btn-primary" onClick={() => act(ad.id, 'approve')}>
                Одобрить
              </button>
              <button type="button" className="admin-btn admin-btn-primary" onClick={() => act(ad.id, 'enable')}>
                Включить
              </button>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => act(ad.id, 'pause')}>
                Пауза
              </button>
              <button type="button" className="admin-btn admin-btn-secondary" onClick={() => act(ad.id, 'disable')}>
                Выключить
              </button>
              <button type="button" className="admin-btn admin-btn-danger" onClick={() => act(ad.id, 'reject')}>
                Отклонить
              </button>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                onClick={async () => {
                  const title = window.prompt('Новый заголовок', ad.title);
                  if (!title) return;
                  await advertisingService.moderate(adminId, ad.id, {
                    action: ad.status === 'active' ? 'enable' : 'approve',
                    patch: { title },
                  });
                  await load();
                }}
              >
                Изменить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
