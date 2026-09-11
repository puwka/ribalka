import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listingPaymentService } from '../../services/listingPaymentService';
import { directoryOwnerService } from '../../services/directoryOwnerService';
import { apiDataEnabled } from '../../lib/apiClient';
import { useAuth } from '../auth/AuthContext';
import {
  DEFAULT_SERVICE_TARIFF,
  DIRECTORY_PERIODS,
  calcServiceTotal,
  formatRub,
  normalizeServiceTariff,
} from '../../lib/directoryPricing';
import { directoryStatusLabel } from './DirectoryListingForm';
import './DirectoryPricingForm.css';

/** Pay / renew directory listing from owner cabinet */
export default function OwnerDirectoryCheckout() {
  const { itemId } = useParams();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [tariff, setTariff] = useState(DEFAULT_SERVICE_TARIFF);
  const [months, setMonths] = useState(3);
  const [top, setTop] = useState(false);
  const [frame, setFrame] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        if (!apiDataEnabled) throw new Error('Оплата доступна только при подключении API');
        const [row, prices] = await Promise.all([
          directoryOwnerService.getById(itemId),
          listingPaymentService.getDirectoryPrices().catch(() => null),
        ]);
        if (!alive) return;
        if (!row) throw new Error('Карточка не найдена');
        setItem(row);
        setTop(Boolean(row.isTop));
        setFrame(Boolean(row.yellowFrame));
        if (prices) {
          setTariff(normalizeServiceTariff(prices.service || prices.directory || prices.shop));
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
  }, [itemId]);

  const quote = useMemo(
    () => calcServiceTotal(tariff, { months, frame, top }),
    [tariff, months, frame, top]
  );

  const pay = async () => {
    setError('');
    setPaying(true);
    try {
      await refresh?.();
      const result = await listingPaymentService.directoryCheckout({
        category: item.category,
        months,
        top,
        frame,
        directoryItemId: item.id,
        listing: {
          name: item.name,
          phone: item.phone,
          description: item.description,
          address: item.address,
          website: item.website,
          hours: item.hours,
          image: item.image,
        },
      });
      if (result.order?.status === 'paid') {
        navigate('/owner/directory', { replace: true });
        return;
      }
      if (result.confirmationUrl) {
        window.location.href = result.confirmationUrl;
        return;
      }
      throw new Error('Не удалось получить ссылку на оплату');
    } catch (err) {
      setError(err.message || 'Ошибка оплаты');
    } finally {
      setPaying(false);
    }
  };

  if (loading) {
    return <div className="cabinet-panel">Загрузка оплаты…</div>;
  }

  if (!item) {
    return (
      <div className="cabinet-panel">
        <div className="auth-error">{error || 'Карточка не найдена'}</div>
        <Link className="btn-secondary" to="/owner/directory">
          Назад
        </Link>
      </div>
    );
  }

  const isRenew = Boolean(item.paidUntil) || item.status === 'published' || item.expired;

  return (
    <div className="cabinet-panel">
      <h2>{isRenew || item.expired ? 'Продлить размещение' : 'Оплатить размещение'}</h2>
      <p className="cabinet-panel__lead">
        {item.name} · {directoryStatusLabel(item.status)}
        {item.paidUntil
          ? ` · оплачено до ${new Date(item.paidUntil).toLocaleDateString('ru-RU')}`
          : ''}
        {item.expired ? ' · срок истёк — карточка скрыта с сайта, но сохранена у вас' : ''}
      </p>

      <section className="dir-pricing" style={{ marginTop: 0 }}>
        {!tariff.enabled && (
          <p className="dir-pricing__hint" style={{ color: '#b91c1c' }}>
            Приём оплат временно отключён.
          </p>
        )}

        <div className="dir-pricing__body">
          <div className="dir-pricing__base">
            <strong>{tariff.title}</strong>
            <span>{formatRub(tariff.amountPerMonth)} / мес</span>
          </div>
          <div className="dir-pricing__addons">
            <p className="dir-pricing__label">Добавить:</p>
            <label className="dir-pricing__check">
              <input type="checkbox" checked={top} onChange={(e) => setTop(e.target.checked)} />
              <span>
                Размещение в ТОП <em>+{formatRub(tariff.addonTop)}/мес</em>
              </span>
            </label>
            <label className="dir-pricing__check">
              <input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} />
              <span>
                Жёлтая рамка <em>+{formatRub(tariff.addonFrame)}/мес</em>
              </span>
            </label>
          </div>
        </div>

        <div className="dir-pricing__periods">
          <p className="dir-pricing__label">Срок оплаты:</p>
          <div className="dir-pricing__period-btns">
            {DIRECTORY_PERIODS.map((m) => (
              <button
                key={m}
                type="button"
                className={months === m ? 'is-active' : ''}
                onClick={() => setMonths(m)}
              >
                {m} мес.
              </button>
            ))}
          </div>
        </div>

        <div className="dir-pricing__total">
          <div>
            <span>В месяц</span>
            <strong>{formatRub(quote.monthly)}</strong>
          </div>
          <div className="dir-pricing__grand">
            <span>Итого за {quote.months} мес.</span>
            <strong>{formatRub(quote.total)}</strong>
          </div>
        </div>

        {error && <p className="dir-pricing__error">{error}</p>}

        <div className="cabinet-actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn-primary"
            disabled={paying || !tariff.enabled}
            onClick={pay}
          >
            {paying ? 'Создаём платёж…' : `Оплатить ${formatRub(quote.total)}`}
          </button>
          <Link className="btn-secondary" to={`/owner/directory/${item.id}/edit`}>
            Редактировать карточку
          </Link>
          <Link className="btn-secondary" to="/owner/directory">
            К списку
          </Link>
        </div>
      </section>
    </div>
  );
}
