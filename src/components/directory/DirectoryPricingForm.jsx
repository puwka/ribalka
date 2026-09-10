import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listingPaymentService } from '../../services/listingPaymentService';
import { apiDataEnabled } from '../../lib/apiClient';
import { useAuth } from '../auth/AuthContext';
import {
  DEFAULT_SERVICE_TARIFF,
  DIRECTORY_PERIODS,
  calcServiceTotal,
  formatRub,
  normalizeServiceTariff,
} from '../../lib/directoryPricing';
import './DirectoryPricingForm.css';

const CATEGORIES = [
  { id: 'shop', label: 'Магазин' },
  { id: 'service', label: 'Сервис' },
  { id: 'guide', label: 'Гид / егерь' },
];

/** Apply + pay for directory placement (shops / services / guides) */
export default function DirectoryPricingForm({ defaultCategory = 'shop' }) {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [tariff, setTariff] = useState(DEFAULT_SERVICE_TARIFF);
  const [category, setCategory] = useState(defaultCategory);
  const [months, setMonths] = useState(3);
  const [top, setTop] = useState(false);
  const [frame, setFrame] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    description: '',
    address: '',
    website: '',
    hours: '',
  });
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (CATEGORIES.some((c) => c.id === defaultCategory)) {
      setCategory(defaultCategory);
    }
  }, [defaultCategory]);

  useEffect(() => {
    if (!apiDataEnabled) return;
    listingPaymentService
      .getDirectoryPrices()
      .then((data) => {
        setTariff(normalizeServiceTariff(data.service || data.directory || data.shop));
      })
      .catch(() => {});
  }, []);

  const quote = useMemo(
    () => calcServiceTotal(tariff, { months, frame, top }),
    [tariff, months, frame, top]
  );

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (!apiDataEnabled) {
      setError('Оплата доступна только при подключении API');
      return;
    }
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/directory#directory-pricing' } });
      return;
    }
    if (!tariff.enabled) {
      setError('Размещение временно отключено администратором');
      return;
    }
    setPaying(true);
    try {
      const result = await listingPaymentService.directoryCheckout({
        category,
        months,
        top,
        frame,
        listing: form,
      });
      if (result.order?.status === 'paid') {
        setMessage('Оплата прошла. Заявка отправлена на модерацию.');
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

  return (
    <section className="dir-pricing" id="directory-pricing">
      <header className="dir-pricing__head">
        <h2>Разместить в справочнике</h2>
        <p>
          Магазины, сервисы, гиды и егеря — один тариф из админки. После оплаты заявка уходит на
          модерацию.
        </p>
      </header>

      {!tariff.enabled && (
        <p className="dir-pricing__hint" style={{ color: '#b91c1c' }}>
          Приём заявок временно отключён.
        </p>
      )}

      <form className="dir-pricing__form" onSubmit={submit}>
        <div className="dir-pricing__tabs" role="tablist" aria-label="Категория">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={category === c.id ? 'is-active' : ''}
              onClick={() => setCategory(c.id)}
            >
              {c.label}
            </button>
          ))}
        </div>

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
                Выделение рамкой жёлтого цвета <em>+{formatRub(tariff.addonFrame)}/мес</em>
              </span>
            </label>
          </div>
        </div>

        <div className="dir-pricing__periods">
          <p className="dir-pricing__label">Срок оплаты (от 3 месяцев):</p>
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

        <div className="dir-pricing__fields">
          <label>
            Название *
            <input
              required
              value={form.name}
              onChange={(e) => setField('name', e.target.value)}
              placeholder="Например: Егерь Михаил / Магазин «Клёво»"
            />
          </label>
          <label>
            Телефон *
            <input
              required
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              placeholder="+7 …"
            />
          </label>
          <label className="dir-pricing__full">
            Описание *
            <textarea
              required
              rows={3}
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              placeholder="Чем занимаетесь, район работы, услуги…"
            />
          </label>
          <label>
            Адрес
            <input value={form.address} onChange={(e) => setField('address', e.target.value)} />
          </label>
          <label>
            Часы работы
            <input value={form.hours} onChange={(e) => setField('hours', e.target.value)} />
          </label>
          <label className="dir-pricing__full">
            Сайт
            <input
              type="url"
              value={form.website}
              onChange={(e) => setField('website', e.target.value)}
              placeholder="https://"
            />
          </label>
        </div>

        {error && <p className="dir-pricing__error">{error}</p>}
        {message && <p className="dir-pricing__ok">{message}</p>}

        {!isAuthenticated ? (
          <p className="dir-pricing__hint">
            Чтобы оплатить размещение,{' '}
            <Link to="/login" state={{ from: '/directory#directory-pricing' }}>
              войдите в аккаунт
            </Link>
            .
          </p>
        ) : null}

        <button
          type="submit"
          className="dir-pricing__submit"
          disabled={paying || !tariff.enabled}
        >
          {paying
            ? 'Создаём платёж…'
            : !isAuthenticated
              ? 'Войти и оплатить'
              : `Оплатить ${formatRub(quote.total)}`}
        </button>
      </form>
    </section>
  );
}
