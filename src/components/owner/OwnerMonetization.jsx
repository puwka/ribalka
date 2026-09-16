import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { paymentService } from '../../services/paymentService';
import { advertisingService } from '../../services/advertisingService';
import { basesService } from '../../services/basesService';
import { listingPaymentService } from '../../services/listingPaymentService';
import {
  DEFAULT_CONSTRUCTOR,
  DEFAULT_SERVICE_TARIFF,
  formatRub,
  normalizeConstructor,
  normalizeServiceTariff,
} from '../../lib/directoryPricing';
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
  const [baseTariff, setBaseTariff] = useState(() => normalizeConstructor(DEFAULT_CONSTRUCTOR));
  const [directoryTariff, setDirectoryTariff] = useState(() =>
    normalizeServiceTariff(DEFAULT_SERVICE_TARIFF)
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ctor, directory] = await Promise.all([
          listingPaymentService
            .getPublicListingPrice()
            .catch(() => listingPaymentService.getPrice().catch(() => null)),
          listingPaymentService.getDirectoryPrices().catch(() => null),
        ]);
        if (!alive) return;
        if (ctor) setBaseTariff(normalizeConstructor(ctor));
        if (directory?.service || directory?.directory) {
          setDirectoryTariff(normalizeServiceTariff(directory.service || directory.directory));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const ctor = baseTariff;
  const dir = directoryTariff;

  return (
    <div className="cabinet-panel mon-panel owner-tariffs">
      <h2>Тарифы</h2>
      <p className="cabinet-panel__lead">
        Два направления размещения: платные рыболовные базы и карточки в справочнике. Оплата и
        опции подключаются при оформлении конкретной карточки.
      </p>
      {loading ? <p className="owner-tariffs__loading">Загружаем актуальные цены…</p> : null}

      <div className="owner-tariffs__grid">
        <article className="owner-tariff-card">
          <div className="owner-tariff-card__top">
            <h3>{ctor.title || 'Конструктор'}</h3>
            <div className="owner-tariff-card__price">
              <strong>{formatRub(ctor.baseAmount)}</strong>
              <span>/ мес</span>
            </div>
          </div>
          <p className="owner-tariff-card__desc">
            Размещение рыболовной базы на сайте. В тарифе{' '}
            <strong>{ctor.includedPhotos ?? 1} фото</strong> и{' '}
            <strong>{ctor.includedVideos ?? 1} видео</strong>.
          </p>

          <h4>Дополнительно</h4>
          <ul>
            <li>
              Размещение в ТОП — <strong>+{formatRub(ctor.addonTop)}/мес</strong>
            </li>
            <li>
              Жёлтая рамка — <strong>+{formatRub(ctor.addonFrame)}/мес</strong>
            </li>
            <li>
              +1 фото — <strong>+{formatRub(ctor.addonPhoto)}</strong>
            </li>
            <li>
              +1 видео — <strong>+{formatRub(ctor.addonVideo)}</strong>
            </li>
          </ul>

          <h4>Сроки и скидки</h4>
          <ul>
            <li>Минимальный срок — от 3 месяцев</li>
            <li>
              3 месяца — скидка <strong>{ctor.discount3 ?? 10}%</strong>
            </li>
            <li>
              6 месяцев — скидка <strong>{ctor.discount6 ?? 20}%</strong>
            </li>
            <li>
              12 месяцев — скидка <strong>{ctor.discount12 ?? 30}%</strong>
            </li>
          </ul>

          <div className="owner-tariff-card__actions">
            <Link className="btn-primary" to="/owner/bases/new">
              Добавить базу
            </Link>
            <Link className="btn-secondary" to="/owner/bases">
              Мои базы
            </Link>
          </div>
        </article>

        <article className="owner-tariff-card owner-tariff-card--alt">
          <div className="owner-tariff-card__top">
            <h3>{dir.title || 'Тариф справочника'}</h3>
            <div className="owner-tariff-card__price">
              <strong>{formatRub(dir.amountPerMonth)}</strong>
              <span>/ мес</span>
            </div>
          </div>
          <p className="owner-tariff-card__desc">
            Один тариф для магазинов, сервисов, гидов и егерей.
          </p>

          <h4>Категории</h4>
          <ul>
            <li>
              <strong>Магазины</strong> — снасти, экипировка
            </li>
            <li>
              <strong>Сервисы</strong> — ремонт, прокат
            </li>
            <li>
              <strong>Гиды и егеря</strong> — сопровождение, маршруты
            </li>
          </ul>

          <h4>Дополнительно</h4>
          <ul>
            {(Number(dir.addonTop) || 0) > 0 ? (
              <li>
                Размещение в ТОП — <strong>+{formatRub(dir.addonTop)}/мес</strong>
              </li>
            ) : null}
            <li>
              Жёлтая рамка — <strong>+{formatRub(dir.addonFrame)}/мес</strong>
            </li>
          </ul>

          <h4>Сроки</h4>
          <ul>
            <li>Оплата на 3, 6 или 12 месяцев</li>
            {(Number(dir.discount3) || 0) > 0 ||
            (Number(dir.discount6) || 0) > 0 ||
            (Number(dir.discount12) || 0) > 0 ? (
              <>
                {(Number(dir.discount3) || 0) > 0 ? (
                  <li>
                    3 месяца — скидка <strong>{dir.discount3}%</strong>
                  </li>
                ) : null}
                {(Number(dir.discount6) || 0) > 0 ? (
                  <li>
                    6 месяцев — скидка <strong>{dir.discount6}%</strong>
                  </li>
                ) : null}
                {(Number(dir.discount12) || 0) > 0 ? (
                  <li>
                    12 месяцев — скидка <strong>{dir.discount12}%</strong>
                  </li>
                ) : null}
              </>
            ) : (
              <li>Скидки за срок настраиваются в админке</li>
            )}
            <li>После оплаты заявка проходит модерацию</li>
          </ul>

          <div className="owner-tariff-card__actions">
            <Link className="btn-primary" to="/owner/directory/new">
              Добавить в справочник
            </Link>
            <Link className="btn-secondary" to="/directory">
              Смотреть справочник
            </Link>
          </div>
        </article>
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
