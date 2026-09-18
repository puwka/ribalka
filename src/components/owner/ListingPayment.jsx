import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listingPaymentService } from '../../services/listingPaymentService';
import { basesService } from '../../services/basesService';
import { useAuth } from '../auth/AuthContext';
import {
  DIRECTORY_PERIODS,
  calcConstructorTotal,
  calcListingUpgradeTotal,
  formatRub,
  normalizeConstructor,
} from '../../lib/directoryPricing';
import './ListingPayment.css';

function formatMoney(amount, currency = 'RUB') {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

const ORDER_STATUS_RU = {
  pending: 'Ожидает оплаты',
  waiting_for_payment: 'Ожидает оплаты',
  paid: 'Оплачен',
  cancelled: 'Отменён',
  failed: 'Ошибка',
  refunded: 'Возврат',
  expired: 'Истёк',
};

export { formatMoney, ORDER_STATUS_RU };

/** Checkout page before redirect to YooKassa */
export function OwnerListingCheckoutPage() {
  const { baseId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isUpgrade = searchParams.get('mode') === 'upgrade';
  const [base, setBase] = useState(null);
  const [tariff, setTariff] = useState(null);
  const [extraPhotos, setExtraPhotos] = useState(() =>
    Math.max(0, Number(searchParams.get('extraPhotos')) || 0)
  );
  const [extraVideos, setExtraVideos] = useState(() =>
    Math.max(0, Number(searchParams.get('extraVideos')) || 0)
  );
  const [months, setMonths] = useState(() => {
    const m = Number(searchParams.get('months'));
    return [3, 6, 12].includes(m) ? m : 3;
  });
  const [frame, setFrame] = useState(() => searchParams.get('frame') === '1');
  const [pendingPaymentUrl, setPendingPaymentUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [payingDaily, setPayingDaily] = useState(false);
  const [error, setError] = useState('');
  const [topSlots, setTopSlots] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [b, preview] = await Promise.all([
          basesService.getById(baseId, { ownerId: user.id }),
          listingPaymentService.getCheckoutPreview(baseId, { months: 3 }).catch(async () => {
            const p = await listingPaymentService.getPublicListingPrice().catch(() =>
              listingPaymentService.getPrice()
            );
            return { settings: p, displayAmount: p.baseAmount || p.amount, frozen: false };
          }),
        ]);
        if (!alive) return;
        if (!b || b.owner_id !== user.id) throw new Error('База не найдена');
        setBase(b);
        setTariff(normalizeConstructor(preview.settings || {}));
        if (preview.topSlots) {
          setTopSlots(preview.topSlots);
        } else {
          listingPaymentService
            .getTopSlots(baseId)
            .then((slots) => {
              if (alive) setTopSlots(slots);
            })
            .catch(() => {});
        }

        const opts = preview.activeOrder?.meta?.constructor_options || preview.quote?.options;
        const qPhotos = Math.max(0, Number(searchParams.get('extraPhotos')) || 0);
        const qVideos = Math.max(0, Number(searchParams.get('extraVideos')) || 0);
        const qMonths = Number(searchParams.get('months'));
        const qFrame = searchParams.get('frame') === '1';

        // Seed from already paid options so upgrade counters don't go below paid slots
        const paidPhotos = Math.max(0, Number(b.paid_extra_photos) || 0);
        const paidVideos = Math.max(0, Number(b.paid_extra_videos) || 0);

        if (isUpgrade) {
          setFrame(qFrame || Boolean(b.yellow_frame));
          setExtraPhotos(Math.max(qPhotos, paidPhotos));
          setExtraVideos(Math.max(qVideos, paidVideos));
        } else if (opts) {
          if ([3, 6, 12].includes(Number(opts.months))) setMonths(Number(opts.months));
          setFrame(Boolean(opts.frame) || qFrame);
          setExtraPhotos(Math.max(qPhotos, Number(opts.extraPhotos) || 0));
          setExtraVideos(Math.max(qVideos, Number(opts.extraVideos) || 0));
        } else {
          if ([3, 6, 12].includes(qMonths)) setMonths(qMonths);
          if (qFrame) setFrame(true);
          if (qPhotos) setExtraPhotos(qPhotos);
          if (qVideos) setExtraVideos(qVideos);
        }

        if (!isUpgrade && preview.frozen && preview.activeOrder?.confirmation_url) {
          setPendingPaymentUrl(preview.activeOrder.confirmation_url);
        }
      } catch (err) {
        if (alive) setError(err.message || 'Ошибка загрузки');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [baseId, user, searchParams, isUpgrade]);

  const renewQuote = useMemo(() => {
    if (!tariff) return null;
    return calcConstructorTotal(tariff, { months, top: false, frame, extraPhotos, extraVideos });
  }, [tariff, months, frame, extraPhotos, extraVideos]);

  const upgradeQuote = useMemo(() => {
    if (!tariff || !base || !isUpgrade) return null;
    return calcListingUpgradeTotal(tariff, base, {
      top: false,
      frame,
      extraPhotos,
      extraVideos,
    });
  }, [tariff, base, isUpgrade, frame, extraPhotos, extraVideos]);

  const amount = isUpgrade ? upgradeQuote?.total ?? 0 : renewQuote?.total ?? 0;
  const paidUntilMs = base?.paid_until || base?.paidUntil
    ? new Date(base.paid_until || base.paidUntil).getTime()
    : null;
  const basePeriodActive = paidUntilMs == null || paidUntilMs > Date.now();
  const dailyPrice =
    Number(topSlots?.addonTopDaily ?? tariff?.addonTopDaily) || 300;
  const topSlotsFull =
    Boolean(topSlots) && topSlots.dailyAvailable === false && !topSlots.alreadyTop;
  const showDailyTop =
    Boolean(base) && base.status === 'approved' && basePeriodActive;
  const canBuyDaily = showDailyTop && !topSlotsFull;

  const pay = async () => {
    setPaying(true);
    setError('');
    try {
      const result = await listingPaymentService.checkout(baseId, {
        months,
        top: false,
        frame,
        extraPhotos,
        extraVideos,
        mode: isUpgrade ? 'upgrade' : undefined,
      });
      if (result.order?.status === 'paid') {
        navigate(`/owner/payment/result/${result.order.id}`, { replace: true });
        return;
      }
      if (result.confirmationUrl) {
        window.location.href = result.confirmationUrl;
        return;
      }
      throw new Error('Не удалось получить ссылку на оплату');
    } catch (err) {
      setError(err.message || 'Ошибка оплаты');
      setPaying(false);
    }
  };

  const payDailyTop = async () => {
    if (!canBuyDaily) {
      setError('Все места в ТОП на главной заняты. Попробуйте позже.');
      return;
    }
    setPayingDaily(true);
    setError('');
    try {
      const result = await listingPaymentService.checkoutTopDaily(baseId);
      if (result.order?.status === 'paid') {
        navigate(`/owner/payment/result/${result.order.id}`, { replace: true });
        return;
      }
      if (result.confirmationUrl) {
        window.location.href = result.confirmationUrl;
        return;
      }
      throw new Error('Не удалось получить ссылку на оплату');
    } catch (err) {
      setError(err.message || 'Ошибка оплаты');
      setPayingDaily(false);
    }
  };

  if (loading) {
    return (
      <div className="cabinet-panel listing-pay">
        <p>Загрузка…</p>
      </div>
    );
  }

  if (error && !base) {
    return (
      <div className="cabinet-panel listing-pay">
        <div className="auth-error">{error}</div>
        <Link className="btn-secondary" to="/owner/bases">
          Назад
        </Link>
      </div>
    );
  }

  const ctor = tariff || normalizeConstructor({});
  const minPhotos = Math.max(0, Number(base?.paid_extra_photos) || 0);
  const minVideos = Math.max(0, Number(base?.paid_extra_videos) || 0);

  return (
    <div className="cabinet-panel listing-pay">
      <h2>{isUpgrade ? 'Доплата опций' : 'Размещение базы'}</h2>
      <p className="cabinet-panel__lead">
        {isUpgrade
          ? 'Оплатите только новые опции — срок размещения не продлевается.'
          : 'Тариф Конструктор: выберите срок и дополнительные опции, затем оплатите через ЮKassa.'}
      </p>

      <div className="listing-pay__card">
        <div className="listing-pay__row">
          <span>База</span>
          <strong>{base.name}</strong>
        </div>
        <div className="listing-pay__row">
          <span>{ctor.title}</span>
          <strong>{formatRub(ctor.baseAmount)} / мес</strong>
        </div>
        {isUpgrade && upgradeQuote ? (
          <p className="listing-pay__note" style={{ marginTop: 8 }}>
            Осталось ≈ {upgradeQuote.remainingMonths} мес. до конца оплаченного периода
            {upgradeQuote.deltaPhotos
              ? ` · +${upgradeQuote.deltaPhotos} фото`
              : ''}
            {upgradeQuote.deltaVideos
              ? ` · +${upgradeQuote.deltaVideos} видео`
              : ''}
            {upgradeQuote.addFrame ? ' · рамка' : ''}
          </p>
        ) : (
          <p className="listing-pay__note" style={{ marginTop: 8 }}>
            В базе: {ctor.includedPhotos} фото и {ctor.includedVideos} видео
          </p>
        )}
      </div>

      {!isUpgrade && (
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
                  onClick={() => {
                    setMonths(m);
                    setPendingPaymentUrl(null);
                  }}
                >
                  {m} мес.
                  {disc > 0 ? <small>−{disc}%</small> : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="listing-pay__opts">
        <p className="listing-pay__label">Дополнительные опции</p>
        <div
          className="listing-pay__check"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            opacity: showDailyTop && !canBuyDaily ? 0.55 : 1,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 18,
              height: 18,
              marginTop: 2,
              borderRadius: 4,
              border: '2px solid currentColor',
              flexShrink: 0,
              background:
                topSlots?.alreadyTop && !topSlotsFull ? 'currentColor' : 'transparent',
            }}
          />
          <span style={{ flex: 1 }}>
            ТОП на сутки{' '}
            <em>+{formatMoney(dailyPrice, 'RUB')}</em>
            <small style={{ display: 'block', opacity: 0.75, marginTop: 2 }}>
              На главной {topSlots ? `${topSlots.used}/${topSlots.max}` : '0/4'} мест · 24 часа
              {topSlotsFull
                ? ' · сейчас занято — кнопка неактивна'
                : showDailyTop
                  ? ''
                  : ' · доступно после оплаты и одобрения базы'}
            </small>
          </span>
          {showDailyTop ? (
            <button
              type="button"
              className="btn-secondary"
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              disabled={paying || payingDaily || !ctor.enabled || !canBuyDaily}
              title={
                topSlotsFull
                  ? 'Все места в ТОП на сегодня заняты'
                  : 'Поднять базу в ТОП на главной на 24 часа'
              }
              onClick={payDailyTop}
            >
              {payingDaily
                ? '…'
                : topSlotsFull
                  ? 'Занято'
                  : topSlots?.alreadyTop
                    ? 'Продлить'
                    : 'Купить'}
            </button>
          ) : null}
        </div>
        <label className="listing-pay__check">
          <input
            type="checkbox"
            checked={frame}
            disabled={isUpgrade && Boolean(base?.yellow_frame)}
            onChange={(e) => {
              setFrame(e.target.checked);
              setPendingPaymentUrl(null);
            }}
          />
          <span>
            Жёлтая рамка{' '}
            <em>
              +{formatRub(ctor.addonFrame)}
              {isUpgrade ? ` × ${upgradeQuote?.remainingMonths || 1} мес.` : '/мес'}
            </em>
          </span>
        </label>
        <div className="listing-pay__counter">
          <span>
            + фото <em>+{formatRub(ctor.addonPhoto)} каждое</em>
            {isUpgrade ? (
              <small style={{ display: 'block', opacity: 0.75, marginTop: 2 }}>
                Уже оплачено: {minPhotos}. Доплата только за новые — без продления срока.
              </small>
            ) : (
              <small style={{ display: 'block', opacity: 0.75, marginTop: 2 }}>
                Потом можно докупить ещё фото в любой момент за {formatRub(ctor.addonPhoto)}.
              </small>
            )}
          </span>
          <div>
            <button
              type="button"
              onClick={() => {
                setExtraPhotos((n) => Math.max(isUpgrade ? minPhotos : 0, n - 1));
                setPendingPaymentUrl(null);
              }}
            >
              −
            </button>
            <strong>{extraPhotos}</strong>
            <button
              type="button"
              onClick={() => {
                setExtraPhotos((n) => n + 1);
                setPendingPaymentUrl(null);
              }}
            >
              +
            </button>
          </div>
        </div>
        <div className="listing-pay__counter">
          <span>
            + видео <em>+{formatRub(ctor.addonVideo)} каждое</em>
            {isUpgrade ? (
              <small style={{ display: 'block', opacity: 0.75, marginTop: 2 }}>
                Уже оплачено: {minVideos}. Доплата только за новые.
              </small>
            ) : null}
          </span>
          <div>
            <button
              type="button"
              onClick={() => {
                setExtraVideos((n) => Math.max(isUpgrade ? minVideos : 0, n - 1));
                setPendingPaymentUrl(null);
              }}
            >
              −
            </button>
            <strong>{extraVideos}</strong>
            <button
              type="button"
              onClick={() => {
                setExtraVideos((n) => n + 1);
                setPendingPaymentUrl(null);
              }}
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="listing-pay__card listing-pay__card--total">
        {!isUpgrade && renewQuote && (
          <>
            <div className="listing-pay__row">
              <span>В месяц</span>
              <strong>{formatRub(renewQuote.monthly)}</strong>
            </div>
            {renewQuote.discountPct > 0 && (
              <div className="listing-pay__row">
                <span>Скидка {renewQuote.discountPct}%</span>
                <strong>−{formatRub(renewQuote.discountAmount)}</strong>
              </div>
            )}
          </>
        )}
        <div className="listing-pay__row listing-pay__row--total">
          <span>
            {isUpgrade
              ? 'К доплате'
              : `Итого${renewQuote ? ` за ${renewQuote.months} мес.` : ''}`}
          </span>
          <strong>{formatMoney(amount, 'RUB')}</strong>
        </div>
      </div>

      {pendingPaymentUrl && (
        <p className="listing-pay__note">
          Есть незавершённый платёж с этими же опциями — можно продолжить его или изменить опции
          выше и оплатить заново.
        </p>
      )}

      {error && <div className="auth-error">{error}</div>}

      {!ctor.enabled && (
        <div className="auth-error">Размещение временно отключено администратором</div>
      )}

      <div className="listing-pay__actions">
        <button
          type="button"
          className="btn-primary"
          disabled={paying || payingDaily || !ctor.enabled || (isUpgrade && amount === 0)}
          onClick={pay}
        >
          {paying
            ? 'Создаём платёж…'
            : isUpgrade && amount === 0
              ? 'Нет новых опций'
              : amount === 0
                ? 'Разместить бесплатно'
                : isUpgrade
                  ? `Доплатить ${formatMoney(amount, 'RUB')}`
                  : `Оплатить ${formatMoney(amount, 'RUB')}`}
        </button>
        {showDailyTop ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={paying || payingDaily || !ctor.enabled || !canBuyDaily}
            title={
              topSlotsFull
                ? 'Все места в ТОП на сегодня заняты'
                : topSlots?.alreadyTop
                  ? 'Продлить ТОП ещё на сутки'
                  : 'Поднять базу в ТОП на главной на 24 часа'
            }
            onClick={payDailyTop}
          >
            {payingDaily
              ? 'Создаём платёж…'
              : topSlotsFull
                ? `ТОП занят (${topSlots?.used || 4}/${topSlots?.max || 4})`
                : topSlots?.alreadyTop
                  ? `Продлить ТОП на сутки ${formatMoney(dailyPrice, 'RUB')}`
                  : `ТОП на сутки ${formatMoney(dailyPrice, 'RUB')}`}
          </button>
        ) : null}
        {pendingPaymentUrl && (
          <a className="btn-secondary" href={pendingPaymentUrl}>
            Продолжить оплату
          </a>
        )}
        <Link className="btn-secondary" to={`/owner/bases/${baseId}/edit`}>
          Вернуться к карточке
        </Link>
      </div>

      <p className="listing-pay__note">
        На главной — {topSlots?.max || 4} места в ТОП. «ТОП на сутки» действует 24 часа и недоступен,
        если все слоты заняты. Доп. фото можно докупить в любой момент за{' '}
        {formatRub(ctor.addonPhoto)} каждое (режим доплаты). После оплаты заявка уйдёт на модерацию
        (кроме уже одобренных баз при доплате / суточном ТОП).
      </p>
    </div>
  );
}

/** Return URL page — verifies with backend */
export function OwnerListingPaymentResultPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ phase: 'checking', order: null, error: '' });

  useEffect(() => {
    let alive = true;
    let tries = 0;

    const run = async () => {
      try {
        const result = await listingPaymentService.verify(orderId);
        if (!alive) return;
        if (result.paid || result.order?.status === 'paid') {
          setState({ phase: 'success', order: result.order, error: '' });
          return;
        }
        if (['cancelled', 'failed', 'expired'].includes(result.order?.status)) {
          setState({ phase: 'failed', order: result.order, error: '' });
          return;
        }
        tries += 1;
        if (tries < 8) {
          setState({ phase: 'checking', order: result.order, error: '' });
          setTimeout(run, 2000);
        } else {
          setState({ phase: 'pending', order: result.order, error: '' });
        }
      } catch (err) {
        if (alive) setState({ phase: 'error', order: null, error: err.message });
      }
    };

    run();
    return () => {
      alive = false;
    };
  }, [orderId]);

  const retry = async () => {
    const order = state.order;
    if (order?.base_id) navigate(`/owner/payment/${order.base_id}`);
    else navigate('/owner/payments');
  };

  return (
    <div className="cabinet-panel listing-pay">
      <h2>Результат оплаты</h2>
      {state.phase === 'checking' && <p className="listing-pay__status">Проверяем оплату…</p>}
      {state.phase === 'success' && (
        <>
          <div className="listing-pay__ok">Оплата прошла успешно</div>
          <p>Заявка на размещение базы отправлена на модерацию.</p>
          <div className="listing-pay__actions">
            <Link className="btn-primary" to={`/owner/bases/${state.order?.base_id}/edit`}>
              Перейти к моей базе
            </Link>
            <Link className="btn-secondary" to="/owner/bases">
              Мои базы
            </Link>
          </div>
        </>
      )}
      {state.phase === 'pending' && (
        <>
          <p className="listing-pay__status">Оплата ещё не подтверждена</p>
          <p>
            Статус: {ORDER_STATUS_RU[state.order?.status] || state.order?.status}. Если вы только что
            оплатили — подождите минуту и обновите страницу.
          </p>
          <div className="listing-pay__actions">
            <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
              Проверить снова
            </button>
            <button type="button" className="btn-secondary" onClick={retry}>
              Попробовать снова
            </button>
          </div>
        </>
      )}
      {(state.phase === 'failed' || state.phase === 'error') && (
        <>
          <div className="auth-error">{state.error || 'Не удалось завершить оплату'}</div>
          <div className="listing-pay__actions">
            <button type="button" className="btn-primary" onClick={retry}>
              Попробовать снова
            </button>
            <Link className="btn-secondary" to="/owner/payments">
              История платежей
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

export function OwnerListingOrdersPanel() {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        if (!listingPaymentService.isEnabled()) {
          setItems([]);
          return;
        }
        const rows = await listingPaymentService.listMine({ status: filter || undefined });
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
    <div className="cabinet-panel">
      <h2>Платежи за размещение</h2>
      <p className="cabinet-panel__lead">Заказы на размещение баз (сумма фиксируется при создании)</p>
      <div className="cabinet-actions" style={{ marginTop: 0 }}>
        {['', 'waiting_for_payment', 'paid', 'cancelled', 'expired'].map((s) => (
          <button
            key={s || 'all'}
            type="button"
            className={`btn-secondary${filter === s ? ' is-active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {s === '' ? 'Все' : s === 'waiting_for_payment' ? 'Ожидают' : ORDER_STATUS_RU[s] || s}
          </button>
        ))}
      </div>
      {error && <div className="auth-error">{error}</div>}
      {loading ? (
        <p>Загрузка…</p>
      ) : items.length === 0 ? (
        <div className="empty-state">Заказов пока нет</div>
      ) : (
        <div className="listing-pay__table-wrap">
          <table className="listing-pay__table">
            <thead>
              <tr>
                <th>Заказ</th>
                <th>База</th>
                <th>Сумма</th>
                <th>Статус</th>
                <th>Дата</th>
                <th>Платёж</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((o) => (
                <tr key={o.id}>
                  <td>
                    <code>{o.id.slice(0, 8)}</code>
                  </td>
                  <td>{o.base_name || o.base_id?.slice(0, 8)}</td>
                  <td>{formatMoney(o.amount, o.currency)}</td>
                  <td>{ORDER_STATUS_RU[o.status] || o.status}</td>
                  <td>{new Date(o.created_at).toLocaleString('ru-RU')}</td>
                  <td>
                    <code>{o.provider_payment_id?.slice(0, 10) || '—'}</code>
                  </td>
                  <td>
                    {['pending', 'waiting_for_payment'].includes(o.status) && (
                      <Link to={`/owner/payment/${o.base_id}`}>Оплатить</Link>
                    )}
                    {o.status === 'paid' && <Link to={`/owner/payment/result/${o.id}`}>Открыть</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
