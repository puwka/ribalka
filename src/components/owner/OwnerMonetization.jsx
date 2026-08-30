import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { plansService } from '../../services/plansService';
import { paymentService } from '../../services/paymentService';
import { advertisingService } from '../../services/advertisingService';
import { basesService } from '../../services/basesService';
import '../auth/AuthShared.css';
import './OwnerMonetization.css';

function formatMoney(amount, currency = 'RUB') {
  return `${Number(amount || 0).toLocaleString('ru-RU')} ${currency}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU');
}

export function OwnerSubscriptionPanel() {
  const { user, refresh } = useAuth();
  const [plans, setPlans] = useState([]);
  const [sub, setSub] = useState(null);
  const [period, setPeriod] = useState('month');
  const [provider, setProvider] = useState('yookassa');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const navigate = useNavigate();
  const cfg = paymentService.getPublicConfig();

  const load = async () => {
    setPlans(await plansService.list({ activeOnly: true, role: 'owner' }));
    setSub(await paymentService.getActiveSubscription(user.id));
  };

  useEffect(() => {
    load();
  }, [user]);

  const pay = async (plan) => {
    setBusy(plan.id);
    setError('');
    setMessage('');
    try {
      const payment = await paymentService.createPlanPayment({
        userId: user.id,
        planId: plan.id,
        billingPeriod: period,
        provider,
      });
      await refresh();
      if (payment.confirmation_url && !payment.needs_server) {
        navigate(payment.confirmation_url);
        return;
      }
      setMessage(
        payment.needs_server
          ? `Платёж ${payment.id} создан (pending). Нужен Edge Function: ${payment.meta?.edge}`
          : `Платёж создан: ${payment.status}`
      );
      navigate('/owner/payments');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="cabinet-panel mon-panel">
      <h2>Подписка и тарифы</h2>
      <p className="cabinet-panel__lead">
        Текущий тариф:{' '}
        <strong>{sub?.plan_code || 'нет'}</strong>
        {sub ? ` · ${sub.status} · до ${formatDate(sub.current_period_end)}` : ''}
      </p>
      {error && <div className="auth-error">{error}</div>}
      {message && <div className="auth-success">{message}</div>}

      <div className="mon-controls">
        <label>
          Период
          <select value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="month">Месяц</option>
            <option value="year">Год (со скидкой)</option>
          </select>
        </label>
        <label>
          Провайдер
          <select value={provider} onChange={(e) => setProvider(e.target.value)}>
            <option value="yookassa">ЮKassa {cfg.yookassa.enabled ? '' : '(симуляция)'}</option>
            <option value="robokassa">Robokassa {cfg.robokassa.enabled ? '' : '(симуляция)'}</option>
            <option value="manual">Вручную / симулятор</option>
          </select>
        </label>
      </div>

      <div className="cabinet-list">
        {plans.map((p) => {
          const price = period === 'year' ? p.price_year : p.price_month;
          return (
            <div key={p.id} className="cabinet-item">
              <div className="cabinet-item__title">
                {p.name} — {formatMoney(price, p.currency)}/{period === 'year' ? 'год' : 'мес'}
                {period === 'year' && p.discount_year_percent > 0
                  ? ` · −${p.discount_year_percent}%`
                  : ''}
              </div>
              <div className="cabinet-item__meta">
                {p.description}
                <br />
                {p.features?.join(' · ')}
                <br />
                Лимиты: баз {p.limits?.bases ?? '—'}, реклам {p.limits?.ads_active ?? '—'}
                {p.limits?.featured ? ', featured' : ''}
                {p.limits?.search_boost ? ', поиск' : ''}
              </div>
              <div className="cabinet-actions">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={Boolean(busy)}
                  onClick={() => pay(p)}
                >
                  {busy === p.id ? 'Создание…' : 'Оплатить / продлить'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OwnerPaymentsPanel() {
  const { user, refresh } = useAuth();
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setItems(await paymentService.listMine(user.id));
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, [user]);

  const cancel = async (id) => {
    try {
      await paymentService.cancel(id, { userId: user.id });
      await load();
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="cabinet-panel mon-panel">
      <h2>История платежей</h2>
      <p className="cabinet-panel__lead">Сумма, тариф, статус, дата и провайдер</p>
      {error && <div className="auth-error">{error}</div>}
      <div className="cabinet-list">
        {items.length === 0 && <div className="empty-state">Платежей пока нет</div>}
        {items.map((p) => (
          <div key={p.id} className="cabinet-item">
            <div className="cabinet-item__title">
              {formatMoney(p.amount, p.currency)} · {p.status} · {p.provider}
            </div>
            <div className="cabinet-item__meta">
              {p.plan_name} ({p.billing_period}) · {p.description}
              <br />
              Создан: {new Date(p.created_at).toLocaleString('ru-RU')}
              {p.paid_at ? ` · оплачен: ${new Date(p.paid_at).toLocaleString('ru-RU')}` : ''}
              {p.error_message ? (
                <>
                  <br />
                  Ошибка: {p.error_message}
                </>
              ) : null}
            </div>
            <div className="cabinet-actions">
              {p.status === 'pending' && p.confirmation_url && (
                <Link className="btn-primary" to={p.confirmation_url}>
                  Продолжить оплату
                </Link>
              )}
              {p.status === 'pending' && (
                <button type="button" className="btn-secondary" onClick={() => cancel(p.id)}>
                  Отменить
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OwnerPaymentReturnPage() {
  const { user, refresh } = useAuth();
  const [params] = useSearchParams();
  const [state, setState] = useState('working');
  const [error, setError] = useState('');
  const paymentId = params.get('payment_id');
  const simulate = params.get('simulate') === '1';

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!paymentId || !user) {
        setState('error');
        setError('Нет payment_id');
        return;
      }
      try {
        if (simulate) {
          await paymentService.markSucceeded(paymentId, {
            userId: user.id,
            providerPayload: { simulate: true },
          });
        } else {
          // Real return URL: webhook should already confirm; refresh status
          const p = await paymentService.get(paymentId, { userId: user.id });
          if (p.status === 'pending') {
            setState('pending');
            return;
          }
        }
        await refresh();
        if (alive) setState('ok');
      } catch (err) {
        if (alive) {
          setState('error');
          setError(err.message);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [paymentId, user, simulate, refresh]);

  return (
    <div className="cabinet-panel mon-panel">
      <h2>Результат оплаты</h2>
      {state === 'working' && <p>Обрабатываем платёж…</p>}
      {state === 'ok' && (
        <div className="auth-success">
          Оплата успешна. Подписка продлена.
          <div className="cabinet-actions" style={{ marginTop: 12 }}>
            <Link className="btn-primary" to="/owner/subscription">
              К тарифу
            </Link>
            <Link className="btn-secondary" to="/owner/payments">
              История
            </Link>
          </div>
        </div>
      )}
      {state === 'pending' && (
        <p>
          Платёж ещё pending. Дождитесь webhook от ЮKassa/Robokassa или завершите симуляцию.
          <Link to="/owner/payments"> К истории</Link>
        </p>
      )}
      {state === 'error' && <div className="auth-error">{error}</div>}
      {simulate && (
        <div className="cabinet-actions" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              try {
                await paymentService.markFailed(paymentId, 'Оплата отклонена в симуляторе');
                setState('error');
                setError('Оплата отклонена');
                await refresh();
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            Симулировать ошибку
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={async () => {
              try {
                await paymentService.cancel(paymentId, { userId: user.id });
                setState('error');
                setError('Платёж отменён');
                await refresh();
              } catch (err) {
                setError(err.message);
              }
            }}
          >
            Отменить
          </button>
        </div>
      )}
    </div>
  );
}

export function OwnerAdvertisingPanel() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [bases, setBases] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    ad_type: 'banner',
    description: '',
    target_url: '',
    base_id: '',
    budget: advertisingService.catalogPrices.banner,
  });

  const load = async () => {
    setItems(await advertisingService.listMine(user.id));
    setBases(await basesService.listMine(user.id));
  };

  useEffect(() => {
    load();
  }, [user]);

  const prices = advertisingService.catalogPrices;
  const typeLabels = advertisingService.typeLabels;

  const create = async (submit) => {
    setError('');
    try {
      await advertisingService.createOrder(user.id, {
        ...form,
        base_id: form.base_id || null,
        budget: Number(form.budget),
        submit,
      });
      setForm({
        title: '',
        ad_type: 'banner',
        description: '',
        target_url: '',
        base_id: '',
        budget: prices.banner,
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="cabinet-panel mon-panel">
      <h2>Реклама</h2>
      <p className="cabinet-panel__lead">
        Закажите баннер, продвижение в поиске, featured, рассылку или участие в акции. Публикация
        после модерации ADMIN.
      </p>
      {error && <div className="auth-error">{error}</div>}

      <form
        className="cabinet-form"
        onSubmit={(e) => {
          e.preventDefault();
          create(true);
        }}
      >
        <label>
          Тип
          <select
            value={form.ad_type}
            onChange={(e) =>
              setForm({
                ...form,
                ad_type: e.target.value,
                budget: prices[e.target.value] || form.budget,
              })
            }
          >
            {Object.entries(typeLabels).map(([k, v]) => (
              <option key={k} value={k}>
                {v} — от {prices[k]} ₽
              </option>
            ))}
          </select>
        </label>
        <label>
          Заголовок *
          <input
            required
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </label>
        <label>
          Описание
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label>
          Ссылка
          <input
            value={form.target_url}
            onChange={(e) => setForm({ ...form, target_url: e.target.value })}
            placeholder="https://"
          />
        </label>
        <label>
          База
          <select
            value={form.base_id}
            onChange={(e) => setForm({ ...form, base_id: e.target.value })}
          >
            <option value="">Не привязано</option>
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Бюджет, ₽
          <input
            type="number"
            min={0}
            value={form.budget}
            onChange={(e) => setForm({ ...form, budget: e.target.value })}
          />
        </label>
        <div className="cabinet-actions">
          <button type="button" className="btn-secondary" onClick={() => create(false)}>
            Черновик
          </button>
          <button type="submit" className="btn-primary">
            Отправить на модерацию
          </button>
        </div>
      </form>

      <div className="cabinet-list" style={{ marginTop: 16 }}>
        {items.map((ad) => (
          <div key={ad.id} className="cabinet-item">
            <div className="cabinet-item__title">
              {ad.title} · {typeLabels[ad.ad_type] || ad.ad_type}
            </div>
            <div className="cabinet-item__meta">
              {ad.status} · {formatMoney(ad.budget)} · {formatDate(ad.created_at)}
              {ad.moderation_note ? (
                <>
                  <br />
                  {ad.moderation_note}
                </>
              ) : null}
            </div>
            {(ad.status === 'draft' || ad.status === 'rejected') && (
              <div className="cabinet-actions">
                <button
                  type="button"
                  className="btn-primary"
                  onClick={async () => {
                    await advertisingService.submit(user.id, ad.id);
                    await load();
                  }}
                >
                  На модерацию
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
