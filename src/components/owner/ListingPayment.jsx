import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listingPaymentService } from '../../services/listingPaymentService';
import { basesService } from '../../services/basesService';
import { useAuth } from '../auth/AuthContext';
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

/** Checkout page before redirect to YooKassa */
export function OwnerListingCheckoutPage() {
  const { baseId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [base, setBase] = useState(null);
  const [price, setPrice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [b, preview] = await Promise.all([
          basesService.getById(baseId, { ownerId: user.id }),
          listingPaymentService.getCheckoutPreview(baseId).catch(async () => {
            const p = await listingPaymentService.getPrice();
            return { settings: p, displayAmount: p.amount, frozen: false };
          }),
        ]);
        if (!alive) return;
        if (!b || b.owner_id !== user.id) throw new Error('База не найдена');
        setBase(b);
        setPrice({
          ...(preview.settings || {}),
          amount: preview.displayAmount ?? preview.settings?.amount,
          frozen: preview.frozen,
        });
      } catch (err) {
        if (alive) setError(err.message || 'Ошибка загрузки');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [baseId, user]);

  const pay = async () => {
    setPaying(true);
    setError('');
    try {
      const result = await listingPaymentService.checkout(baseId);
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

  const amount = price?.amount ?? 0;

  return (
    <div className="cabinet-panel listing-pay">
      <h2>Размещение базы</h2>
      <p className="cabinet-panel__lead">
        Оплата размещения на сайте. Сумма фиксируется в заказе и не меняется после создания.
      </p>

      <div className="listing-pay__card">
        <div className="listing-pay__row">
          <span>База</span>
          <strong>{base.name}</strong>
        </div>
        <div className="listing-pay__row">
          <span>Услуга</span>
          <strong>{price?.title || 'Размещение рыболовной базы'}</strong>
        </div>
        <div className="listing-pay__row listing-pay__row--total">
          <span>Стоимость размещения</span>
          <strong>{formatMoney(amount, price?.currency)}</strong>
        </div>
      </div>

      {price?.frozen && (
        <p className="listing-pay__note" style={{ marginTop: 0 }}>
          Сумма зафиксирована в уже созданном платеже ЮKassa. Чтобы оплатить новую цену из
          админки — дождитесь обновления сервера или создайте заказ заново после деплоя.
        </p>
      )}

      {error && <div className="auth-error">{error}</div>}

      {!price?.enabled && (
        <div className="auth-error">Размещение временно отключено администратором</div>
      )}

      <div className="listing-pay__actions">
        <button
          type="button"
          className="btn-primary"
          disabled={paying || !price?.enabled}
          onClick={pay}
        >
          {paying
            ? 'Создаём платёж…'
            : amount === 0
              ? 'Разместить бесплатно'
              : `Оплатить ${formatMoney(amount, price?.currency)}`}
        </button>
        <Link className="btn-secondary" to={`/owner/bases/${baseId}/edit`}>
          Вернуться к карточке
        </Link>
      </div>

      <p className="listing-pay__note">
        После оплаты заявка уйдёт на модерацию. Статус оплаты подтверждается сервером через ЮKassa —
        возврат на сайт сам по себе не означает успешную оплату.
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
          setState({
            phase: 'pending',
            order: result.order,
            error: '',
          });
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
    if (order?.base_id) {
      navigate(`/owner/payment/${order.base_id}`);
    } else {
      navigate('/owner/payments');
    }
  };

  return (
    <div className="cabinet-panel listing-pay">
      <h2>Результат оплаты</h2>

      {state.phase === 'checking' && (
        <p className="listing-pay__status">Проверяем оплату…</p>
      )}

      {state.phase === 'success' && (
        <>
          <div className="listing-pay__ok">Оплата прошла успешно</div>
          <p>Заявка на размещение базы отправлена на модерацию.</p>
          <div className="listing-pay__actions">
            <Link
              className="btn-primary"
              to={`/owner/bases/${state.order?.base_id}/edit`}
            >
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
            Статус: {ORDER_STATUS_RU[state.order?.status] || state.order?.status}. Если вы только
            что оплатили — подождите минуту и обновите страницу.
          </p>
          <div className="listing-pay__actions">
            <button
              type="button"
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
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
          <div className="auth-error">
            {state.error || 'Не удалось завершить оплату'}
          </div>
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
        const rows = await listingPaymentService.listMine({
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
            {s === ''
              ? 'Все'
              : s === 'waiting_for_payment'
                ? 'Ожидают'
                : ORDER_STATUS_RU[s] || s}
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
                    {o.status === 'paid' && (
                      <Link to={`/owner/payment/result/${o.id}`}>Открыть</Link>
                    )}
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

export { formatMoney, ORDER_STATUS_RU };
