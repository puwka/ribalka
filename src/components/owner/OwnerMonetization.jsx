import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { paymentService } from '../../services/paymentService';
import { advertisingService } from '../../services/advertisingService';
import { basesService } from '../../services/basesService';
import { listingPaymentService } from '../../services/listingPaymentService';
import {
  DIRECTORY_PERIODS,
  calcConstructorTotal,
  formatRub,
  normalizeConstructor,
} from '../../lib/directoryPricing';
import { statusLabel } from '../bases/BaseListingForm';
import '../auth/AuthShared.css';
import './OwnerMonetization.css';
import './ListingPayment.css';

function formatMoney(amount, currency = 'RUB') {
  return `${Number(amount || 0).toLocaleString('ru-RU')} ${currency}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU');
}

export function OwnerSubscriptionPanel() {
  const { user } = useAuth();
  const [bases, setBases] = useState([]);
  const [tariff, setTariff] = useState(null);
  const [baseId, setBaseId] = useState('');
  const [months, setMonths] = useState(3);
  const [top, setTop] = useState(false);
  const [frame, setFrame] = useState(false);
  const [extraPhotos, setExtraPhotos] = useState(0);
  const [extraVideos, setExtraVideos] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [list, price] = await Promise.all([
          basesService.listMine(user.id).catch(() => []),
          listingPaymentService
            .getPublicListingPrice()
            .catch(() => listingPaymentService.getPrice().catch(() => null)),
        ]);
        if (!alive) return;
        setBases(Array.isArray(list) ? list : []);
        if (price) setTariff(normalizeConstructor(price));
        if (list?.[0]?.id) setBaseId(String(list[0].id));
      } catch (err) {
        if (alive) setError(err.message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  const quote = useMemo(() => {
    if (!tariff) return null;
    return calcConstructorTotal(tariff, { months, top, frame, extraPhotos, extraVideos });
  }, [tariff, months, top, frame, extraPhotos, extraVideos]);

  const payNow = async () => {
    setBusy(true);
    setError('');
    try {
      if (!baseId) throw new Error('Выберите базу');
      const result = await listingPaymentService.checkout(baseId, {
        months,
        top,
        frame,
        extraPhotos,
        extraVideos,
      });
      if (result.order?.status === 'paid') {
        navigate(`/owner/payment/result/${result.order.id}`, { replace: true });
        return;
      }
      if (result.confirmationUrl) {
        window.location.href = result.confirmationUrl;
        return;
      }
      throw new Error('Не удалось получить ссылку на оплату ЮKassa');
    } catch (err) {
      setError(err.message || 'Ошибка оплаты');
    } finally {
      setBusy(false);
    }
  };

  const ctor = tariff || normalizeConstructor({});

  return (
    <div className="cabinet-panel mon-panel">
      <h2>Тарифы размещения</h2>
      <p className="cabinet-panel__lead">
        Тариф <strong>Конструктор</strong> для платных баз. Оплата через ЮKassa (без ложной
        «успешной» симуляции).
      </p>
      {error && <div className="auth-error">{error}</div>}

      <div className="listing-pay__card">
        <div className="listing-pay__row">
          <span>{ctor.title}</span>
          <strong>{formatRub(ctor.baseAmount)} / мес</strong>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '0.9rem', color: '#64748b' }}>
          В базе: {ctor.includedPhotos} фото и {ctor.includedVideos} видео
        </p>
      </div>

      <div className="listing-pay__opts">
        <p className="listing-pay__label">База для размещения</p>
        {bases.length === 0 ? (
          <p>
            Нет баз. <Link to="/owner/bases/new">Добавить базу</Link>
          </p>
        ) : (
          <select
            className="admin-select"
            style={{ width: '100%', maxWidth: 420 }}
            value={baseId}
            onChange={(e) => setBaseId(e.target.value)}
          >
            {bases.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} ({statusLabel(b.status)})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="listing-pay__opts">
        <p className="listing-pay__label">Срок оплаты</p>
        <div className="listing-pay__period-btns">
          {DIRECTORY_PERIODS.map((m) => {
            const disc = m === 3 ? ctor.discount3 : m === 6 ? ctor.discount6 : ctor.discount12;
            return (
              <button
                key={m}
                type="button"
                className={months === m ? 'is-active' : ''}
                onClick={() => setMonths(m)}
              >
                {m} мес.
                {disc > 0 ? <small>−{disc}%</small> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="listing-pay__opts">
        <p className="listing-pay__label">Дополнительные опции</p>
        <label className="listing-pay__check">
          <input type="checkbox" checked={top} onChange={(e) => setTop(e.target.checked)} />
          <span>
            Размещение в ТОП <em>+{formatRub(ctor.addonTop)}/мес</em>
          </span>
        </label>
        <label className="listing-pay__check">
          <input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} />
          <span>
            Жёлтая рамка <em>+{formatRub(ctor.addonFrame)}/мес</em>
          </span>
        </label>
        <div className="listing-pay__counter">
          <span>
            + фото <em>+{formatRub(ctor.addonPhoto)}</em>
          </span>
          <div>
            <button type="button" onClick={() => setExtraPhotos((n) => Math.max(0, n - 1))}>
              −
            </button>
            <strong>{extraPhotos}</strong>
            <button type="button" onClick={() => setExtraPhotos((n) => n + 1)}>
              +
            </button>
          </div>
        </div>
        <div className="listing-pay__counter">
          <span>
            + видео <em>+{formatRub(ctor.addonVideo)}</em>
          </span>
          <div>
            <button type="button" onClick={() => setExtraVideos((n) => Math.max(0, n - 1))}>
              −
            </button>
            <strong>{extraVideos}</strong>
            <button type="button" onClick={() => setExtraVideos((n) => n + 1)}>
              +
            </button>
          </div>
        </div>
      </div>

      {quote && (
        <div className="listing-pay__card listing-pay__card--total">
          <div className="listing-pay__row">
            <span>В месяц</span>
            <strong>{formatRub(quote.monthly)}</strong>
          </div>
          {quote.discountPct > 0 && (
            <div className="listing-pay__row">
              <span>Скидка {quote.discountPct}%</span>
              <strong>−{formatRub(quote.discountAmount)}</strong>
            </div>
          )}
          <div className="listing-pay__row listing-pay__row--total">
            <span>Итого за {quote.months} мес.</span>
            <strong>{formatRub(quote.total)}</strong>
          </div>
        </div>
      )}

      <div className="cabinet-actions">
        <button type="button" className="btn-primary" disabled={busy || !baseId} onClick={payNow}>
          {busy ? 'Создаём платёж…' : `Оплатить ${quote ? formatRub(quote.total) : ''}`}
        </button>
        <Link className="btn-secondary" to="/owner/bases/new">
          Добавить базу
        </Link>
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
