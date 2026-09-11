import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { listingPaymentService } from '../../services/listingPaymentService';
import { directoryOwnerService } from '../../services/directoryOwnerService';
import { apiDataEnabled } from '../../lib/apiClient';
import { useAuth } from '../auth/AuthContext';
import {
  DEFAULT_SERVICE_TARIFF,
  calcServiceTotal,
  formatRub,
  normalizeServiceTariff,
} from '../../lib/directoryPricing';
import { directoryStatusLabel } from './DirectoryListingForm';
import DirectoryConstructorPricing, {
  DEFAULT_DIRECTORY_OPTIONS,
} from './DirectoryConstructorPricing';
import './DirectoryPricingForm.css';

/** Pay / renew directory listing from owner cabinet */
export default function OwnerDirectoryCheckout() {
  const { itemId } = useParams();
  const [searchParams] = useSearchParams();
  const { refresh } = useAuth();
  const navigate = useNavigate();
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

  const quote = useMemo(
    () => calcServiceTotal(tariff, options),
    [tariff, options]
  );

  const pay = async () => {
    setError('');
    setPaying(true);
    try {
      await refresh?.();
      const result = await listingPaymentService.directoryCheckout({
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
  const categoryTitle = {
    shop: 'Размещение магазина',
    service: 'Размещение сервиса',
    guide: 'Размещение гида / егеря',
  }[item.category] || 'Размещение в справочнике';

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

      <DirectoryConstructorPricing
        tariff={tariff}
        options={options}
        onChange={setOptions}
        title={categoryTitle}
        subtitle="ТОП, рамка и срок — итоговая сумма обновляется сразу."
      />

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
    </div>
  );
}
