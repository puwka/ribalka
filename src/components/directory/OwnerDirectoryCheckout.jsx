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

/** Pay / renew / upgrade / top_daily directory listing from owner cabinet */
export default function OwnerDirectoryCheckout() {
  const { itemId } = useParams();
  const [searchParams] = useSearchParams();
  const { refresh } = useAuth();
  const navigate = useNavigate();
  const isUpgrade = searchParams.get('mode') === 'upgrade';
  const isTopDaily = searchParams.get('mode') === 'top_daily';
  const [item, setItem] = useState(null);
  const [tariff, setTariff] = useState(DEFAULT_SERVICE_TARIFF);
  const [options, setOptions] = useState(() => {
    const m = Number(searchParams.get('months'));
    const rawTop = Math.max(0, Math.min(90, Number(searchParams.get('topDays')) || 0));
    const topDays =
      searchParams.get('mode') === 'top_daily' ? Math.max(1, rawTop || 1) : rawTop;
    return {
      ...DEFAULT_DIRECTORY_OPTIONS,
      months: [3, 6, 12].includes(m) ? m : 3,
      top: false,
      topDays,
      frame: searchParams.get('frame') === '1',
    };
  });
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [topSlots, setTopSlots] = useState(null);

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
          top: false,
          frame: isTopDaily ? false : prev.frame || Boolean(row.yellowFrame),
          topDays: isTopDaily ? Math.max(1, Number(prev.topDays) || 1) : prev.topDays,
        }));
        if (prices) {
          setTariff(normalizeServiceTariff(prices.service || prices.directory || prices.shop));
        }
        listingPaymentService
          .getDirectoryTopSlots({ category: row.category, itemId: row.id })
          .then((slots) => {
            if (!alive) return;
            setTopSlots(slots);
            if (slots?.dailyAvailable === false && !slots?.alreadyTop && !isTopDaily) {
              setOptions((prev) => ({ ...prev, topDays: 0 }));
            }
          })
          .catch(() => {
            if (alive) setTopSlots(null);
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
  }, [itemId, isTopDaily]);

  const topSlotsFull =
    Boolean(topSlots) && topSlots.dailyAvailable === false && !topSlots.alreadyTop;
  const topDailyDays = Math.max(1, Math.min(90, Number(options.topDays) || 1));
  const effectiveOptions = {
    ...options,
    topDays: isTopDaily
      ? topSlotsFull
        ? 0
        : topDailyDays
      : topSlotsFull
        ? 0
        : Math.max(0, Number(options.topDays) || 0),
  };

  const dailyPrice =
    Number(topSlots?.addonTopDaily ?? tariff?.addonTopDaily ?? tariff?.addonTop) || 300;

  const renewQuote = useMemo(
    () => (isTopDaily ? null : calcServiceTotal(tariff, effectiveOptions)),
    [tariff, isTopDaily, effectiveOptions.months, effectiveOptions.frame, effectiveOptions.topDays]
  );
  const upgradeQuote = useMemo(
    () =>
      item && isUpgrade ? calcDirectoryUpgradeTotal(tariff, item, effectiveOptions) : null,
    [tariff, item, isUpgrade, effectiveOptions.frame, effectiveOptions.topDays]
  );
  const topDailyAmount =
    isTopDaily && !topSlotsFull ? Math.round(topDailyDays * dailyPrice) : 0;
  const amount = isTopDaily
    ? topDailyAmount
    : isUpgrade
      ? upgradeQuote?.total ?? 0
      : renewQuote?.total ?? 0;

  const pay = async () => {
    setError('');
    setPaying(true);
    try {
      await refresh?.();
      let result;
      if (isTopDaily) {
        result = await listingPaymentService.checkoutDirectoryTopDaily(item.id, {
          topDays: topDailyDays,
        });
      } else if (isUpgrade) {
        result = await listingPaymentService.directoryUpgradeCheckout({
          directoryItemId: item.id,
          top: false,
          topDays: effectiveOptions.topDays,
          frame: options.frame,
        });
      } else {
        result = await listingPaymentService.directoryCheckout({
          category: item.category,
          months: options.months,
          top: false,
          topDays: effectiveOptions.topDays,
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
      }
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

  if (isTopDaily) {
    return (
      <div className="cabinet-panel">
        <h2>ТОП на сутки</h2>
        <p className="cabinet-panel__lead">
          {item.name} · {directoryStatusLabel(item.status)}
          {item.paidUntil ? ` · до ${new Date(item.paidUntil).toLocaleDateString('ru-RU')}` : ''}
          {topSlots ? ` · ТОП ${topSlots.used}/${topSlots.max}` : ''}
        </p>
        <p className="dir-pricing__hint">
          Отдельная оплата продвижения — без продления тарифа. Выберите число суток.
        </p>

        <DirectoryConstructorPricing
          tariff={tariff}
          options={{ ...effectiveOptions, topDays: topSlotsFull ? 0 : topDailyDays }}
          onChange={(next) =>
            setOptions({
              ...next,
              frame: false,
              topDays: Math.max(1, Math.min(90, Number(next.topDays) || 1)),
            })
          }
          topSlots={topSlots}
          title="Сутки ТОП"
          subtitle={`Цена ${formatRub(dailyPrice)} / сут. Срок размещения не продлевается.`}
          hidePeriods
          hideFrame
          topOnly
        />

        {error && <div className="auth-error">{error}</div>}

        <div className="cabinet-actions" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn-primary"
            disabled={paying || !tariff.enabled || topSlotsFull || amount <= 0}
            onClick={pay}
          >
            {paying
              ? 'Создаём платёж…'
              : topSlotsFull
                ? 'Мест нет'
                : `Оплатить ТОП ${formatRub(amount)}`}
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

  return (
    <div className="cabinet-panel">
      <h2>{isUpgrade ? 'Доплата опций справочника' : 'Оплата размещения'}</h2>
      <p className="cabinet-panel__lead">
        {item.name} · {directoryStatusLabel(item.status)}
        {item.paidUntil ? ` · до ${new Date(item.paidUntil).toLocaleDateString('ru-RU')}` : ''}
        {topSlots ? ` · ТОП ${topSlots.used}/${topSlots.max}` : ''}
      </p>
      {isUpgrade ? (
        <p className="dir-pricing__hint">
          Оплачиваются новые опции (рамка и/или сутки ТОП). Срок размещения не продлевается
          {upgradeQuote?.remainingMonths
            ? ` (осталось ≈ ${upgradeQuote.remainingMonths} мес.)`
            : ''}
          .
        </p>
      ) : null}

      <DirectoryConstructorPricing
        tariff={tariff}
        options={effectiveOptions}
        onChange={setOptions}
        topSlots={topSlots}
        title={isUpgrade ? 'Новые опции' : 'Тариф и срок'}
        subtitle={
          isUpgrade
            ? 'Отметьте рамку и нужное число суток ТОП — сумма считается сразу.'
            : 'Выберите срок, рамку и сутки ТОП — стоимость считается сразу.'
        }
        hidePeriods={isUpgrade}
        hideTotal={false}
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
