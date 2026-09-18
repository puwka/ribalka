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
      top: false,
      frame: searchParams.get('frame') === '1',
    };
  });
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
          frame: prev.frame || Boolean(row.yellowFrame),
        }));
        if (prices) {
          setTariff(normalizeServiceTariff(prices.service || prices.directory || prices.shop));
        }
        listingPaymentService
          .getDirectoryTopSlots({ category: row.category, itemId: row.id })
          .then((slots) => {
            if (alive) setTopSlots(slots);
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
  }, [itemId]);

  const renewQuote = useMemo(
    () => calcServiceTotal(tariff, { ...options, top: false }),
    [tariff, options]
  );
  const upgradeQuote = useMemo(
    () =>
      item && isUpgrade
        ? calcDirectoryUpgradeTotal(tariff, item, { ...options, top: false })
        : null,
    [tariff, item, options, isUpgrade]
  );
  const amount = isUpgrade ? upgradeQuote?.total ?? 0 : renewQuote.total;

  const dailyPrice = Number(topSlots?.addonTopDaily ?? tariff.addonTopDaily) || 300;
  const topSlotsFull =
    Boolean(topSlots) && topSlots.dailyAvailable === false && !topSlots.alreadyTop;
  const expired =
    Boolean(item?.paidUntil) && new Date(item.paidUntil).getTime() <= Date.now();
  const showDailyTop =
    apiDataEnabled &&
    item &&
    !expired &&
    (item.status === 'published' || item.status === 'approved');
  const canBuyDaily = showDailyTop && !topSlotsFull;

  const pay = async () => {
    setError('');
    setPaying(true);
    try {
      await refresh?.();
      const result = isUpgrade
        ? await listingPaymentService.directoryUpgradeCheckout({
            directoryItemId: item.id,
            top: false,
            frame: options.frame,
          })
        : await listingPaymentService.directoryCheckout({
            category: item.category,
            months: options.months,
            top: false,
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

  const buyDailyTop = async () => {
    if (!canBuyDaily) {
      setError('Все места в ТОП на сегодня заняты. Попробуйте позже.');
      return;
    }
    setPayingDaily(true);
    setError('');
    try {
      await refresh?.();
      const result = await listingPaymentService.checkoutDirectoryTopDaily(item.id);
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
      setPayingDaily(false);
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
        {topSlots ? ` · ТОП ${topSlots.used}/${topSlots.max}` : ''}
      </p>
      {isUpgrade ? (
        <p className="dir-pricing__hint">
          Оплачиваются только новые опции (рамка). Срок размещения не продлевается
          {upgradeQuote?.remainingMonths
            ? ` (осталось ≈ ${upgradeQuote.remainingMonths} мес.)`
            : ''}
          . ТОП — отдельно за сутки, без помесячной опции.
        </p>
      ) : null}

      <DirectoryConstructorPricing
        tariff={tariff}
        options={options}
        onChange={setOptions}
        topSlots={topSlots}
        title={isUpgrade ? 'Новые опции' : 'Тариф и срок'}
        subtitle={
          isUpgrade
            ? 'Отметьте рамку, если её ещё не было в тарифе.'
            : 'Выберите срок и доп. опции — стоимость считается сразу.'
        }
        hidePeriods={isUpgrade}
        hideTotal={isUpgrade}
      />

      <div className="dir-pricing__addons" style={{ marginTop: 12 }}>
        <div
          className="dir-pricing__check"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            opacity: showDailyTop && !canBuyDaily ? 0.55 : 1,
          }}
        >
          <span style={{ flex: 1 }}>
            ТОП на сутки <em>+{formatRub(dailyPrice)}</em>
            <small style={{ display: 'block', opacity: 0.75, marginTop: 2 }}>
              В категории {topSlots ? `${topSlots.used}/${topSlots.max}` : '0/4'} мест · 24 часа
              {topSlotsFull
                ? ' · сейчас занято — кнопка неактивна'
                : showDailyTop
                  ? ''
                  : ' · доступно после оплаты и публикации карточки'}
            </small>
          </span>
          {showDailyTop ? (
            <button
              type="button"
              className="btn-secondary"
              style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
              disabled={paying || payingDaily || !canBuyDaily}
              title={
                topSlotsFull
                  ? 'Все места в ТОП на сегодня заняты'
                  : 'Поднять карточку в ТОП на 24 часа'
              }
              onClick={buyDailyTop}
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
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="cabinet-actions" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="btn-primary"
          disabled={paying || payingDaily || !tariff.enabled || (isUpgrade && amount === 0)}
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
        {showDailyTop ? (
          <button
            type="button"
            className="btn-secondary"
            disabled={payingDaily || !canBuyDaily}
            title={
              topSlotsFull
                ? 'Все места в ТОП на сегодня заняты'
                : 'Поднять карточку в ТОП на 24 часа'
            }
            onClick={buyDailyTop}
          >
            {payingDaily
              ? 'Создаём платёж…'
              : topSlotsFull
                ? `ТОП занят (${topSlots?.used || 4}/${topSlots?.max || 4})`
                : topSlots?.alreadyTop
                  ? `Продлить ТОП на сутки ${formatRub(dailyPrice)}`
                  : `ТОП на сутки ${formatRub(dailyPrice)}`}
          </button>
        ) : null}
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
