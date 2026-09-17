import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listingPaymentService } from '../../services/listingPaymentService';
import { directoryOwnerService } from '../../services/directoryOwnerService';
import { apiDataEnabled } from '../../lib/apiClient';
import { useAuth } from '../auth/AuthContext';
import {
  DEFAULT_SERVICE_TARIFF,
  calcServiceTotal,
  calcDirectoryUpgradeTotal,
  formatRub,
  normalizeServiceTariff,
} from '../../lib/directoryPricing';
import { directoryStatusLabel } from './DirectoryListingForm';
import DirectoryConstructorPricing, {
  DEFAULT_DIRECTORY_OPTIONS,
} from './DirectoryConstructorPricing';
import './DirectoryPricingForm.css';

/** Pay / renew / upgrade directory listing from owner cabinet */
export default function OwnerDirectoryCheckout() {
  const { itemId } = useParams();
  const [searchParams] = useSearchParams();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const isUpgrade = searchParams.get('mode') === 'upgrade';
  const [item, setItem] = useState(null);
  const [tariff, setTariff] = useState(DEFAULT_SERVICE_TARIFF);
  const [options, setOptions] = useState(() => {
    const m = Number(searchParams.get('months'));
    return {
      ...DEFAULT_DIRECTORY_OPTIONS,
      months: [3, 6, 12].includes(m) ? m : 3,
      top: searchParams.get('top') === '1',
      frame: searchParams.get('frame') === '1',
    };
  });
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
        setOptions((prev) => ({
          ...prev,
          top: prev.top || Boolean(row.isTop),
          frame: prev.frame || Boolean(row.yellowFrame),
        }));
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

  const renewQuote = useMemo(() => calcServiceTotal(tariff, options), [tariff, options]);
  const upgradeQuote = useMemo(
    () => (item && isUpgrade ? calcDirectoryUpgradeTotal(tariff, item, options) : null),
    [tariff, item, options, isUpgrade]
  );
  const amount = isUpgrade ? upgradeQuote?.total ?? 0 : renewQuote.total;

  const pay = async () => {
    setError('');
    setPaying(true);
    try {
      await refresh?.();
      const result = isUpgrade
        ? await listingPaymentService.directoryUpgradeCheckout({
            directoryItemId: item.id,
            top: options.top,
            frame: options.frame,
          })
        : await listingPaymentService.directoryCheckout({
            category: item.category,
            months: options.months,
            top: options.top,
            frame: options.frame,
            directoryItemId: item.id,
            listing: {
              name: item.name,
              phone: item.phone,
              description: item.description,
              address: item.address,
              region: item.region,
              website: item.website,
              hours: item.hours,
              image: item.image,
            },
          });
      if (result.order?.status === 'paid') {
        navigate(`/owner/directory/payment/result/${result.order.id}`, { replace: true });
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
    return <div className="cabinet-panel">Загрузка…</div>;
  }

  if (error && !item) {
    return (
      <div className="cabinet-panel">
        <div className="auth-error">{error}</div>
        <Link className="btn-secondary" to="/owner/directory">
          Назад
        </Link>
      </div>
    );
  }

  return (
    <div className="cabinet-panel">
      <h2>{isUpgrade ? 'Доплата опций справочника' : 'Оплата размещения'}</h2>
      <p className="cabinet-panel__lead">
        {item.name} · {directoryStatusLabel(item.status)}
        {item.paidUntil ? ` · до ${new Date(item.paidUntil).toLocaleDateString('ru-RU')}` : ''}
      </p>
      {isUpgrade ? (
        <p className="dir-pricing__hint">
          Оплачиваются только новые опции. Срок размещения не продлевается
          {upgradeQuote?.remainingMonths
            ? ` (осталось ≈ ${upgradeQuote.remainingMonths} мес.)`
            : ''}
          .
        </p>
      ) : null}

      <DirectoryConstructorPricing
        tariff={tariff}
        options={options}
        onChange={setOptions}
        title={isUpgrade ? 'Новые опции' : 'Тариф и срок'}
        subtitle={
          isUpgrade
            ? 'Отметьте ТОП или рамку, если их ещё не было в тарифе.'
            : 'Выберите срок и доп. опции — стоимость считается сразу.'
        }
        hidePeriods={isUpgrade}
        hideTotal={isUpgrade}
      />

      {error && <div className="auth-error">{error}</div>}

      <div className="cabinet-actions" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="btn-primary"
          disabled={paying || !tariff.enabled || (isUpgrade && amount === 0)}
          onClick={pay}
        >
          {paying
            ? 'Создаём платёж…'
            : isUpgrade && amount === 0
              ? 'Нет новых опций'
              : isUpgrade
                ? `Доплатить ${formatRub(amount)}`
                : `Оплатить ${formatRub(amount)}`}
        </button>
        <Link className="btn-secondary" to={`/owner/directory/${item.id}/edit`}>
          К карточке
        </Link>
        <Link className="btn-secondary" to="/owner/directory">
          К списку
        </Link>
      </div>
    </div>
  );
}
