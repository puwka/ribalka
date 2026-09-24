import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listingPaymentService } from '../../services/listingPaymentService';
import { api, apiDataEnabled } from '../../lib/apiClient';
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
  const [frame, setFrame] = useState(false);
  const [topDays, setTopDays] = useState(0);
  const [topSlots, setTopSlots] = useState(null);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    description: '',
    region: '',
    address: '',
    website: '',
    hours: '',
  });
  const [districts, setDistricts] = useState([]);
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
    let alive = true;
    api
      .get('/api/cms/districts')
      .then((d) => {
        if (alive) setDistricts((d || []).map((x) => x.name).filter(Boolean));
      })
      .catch(() => {
        if (alive) setDistricts([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!apiDataEnabled) return;
    listingPaymentService
      .getDirectoryPrices()
      .then((data) => {
        setTariff(normalizeServiceTariff(data.service || data.directory || data.shop));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!apiDataEnabled) return;
    let alive = true;
    listingPaymentService
      .getDirectoryTopSlots({ category })
      .then((slots) => {
        if (!alive) return;
        setTopSlots(slots);
        if (slots?.dailyAvailable === false && !slots?.alreadyTop) setTopDays(0);
      })
      .catch(() => {
        if (alive) setTopSlots(null);
      });
    return () => {
      alive = false;
    };
  }, [category]);

  const topSlotsFull =
    Boolean(topSlots) && topSlots.dailyAvailable === false && !topSlots.alreadyTop;
  const effectiveTopDays = topSlotsFull ? 0 : topDays;

  const quote = useMemo(
    () => calcServiceTotal(tariff, { months, frame, topDays: effectiveTopDays }),
    [tariff, months, frame, effectiveTopDays]
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
        top: false,
        topDays: effectiveTopDays,
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
              <input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} />
              <span>
                Выделение рамкой жёлтого цвета <em>+{formatRub(tariff.addonFrame)}/мес</em>
              </span>
            </label>
            {topSlotsFull ? (
              <p className="dir-pricing__hint" style={{ marginTop: 8, color: '#b91c1c' }}>
                К сожалению, все места в топе заняты, попробуйте позже.
                {topSlots ? ` (${topSlots.used}/${topSlots.max})` : ''}
              </p>
            ) : (
              <div className="base-ctor__counters" style={{ marginTop: 8 }}>
                <div className="base-ctor__counter">
                  <span>
                    ТОП на сутки{' '}
                    <em>+{formatRub(tariff.addonTopDaily ?? tariff.addonTop ?? 300)} / сут</em>
                    <small style={{ display: 'block', opacity: 0.75, marginTop: 2 }}>
                      В категории {topSlots ? `${topSlots.used}/${topSlots.max}` : '0/4'} мест
                    </small>
                  </span>
                  <div>
                    <button
                      type="button"
                      onClick={() => setTopDays((n) => Math.max(0, n - 1))}
                    >
                      −
                    </button>
                    <strong>{topDays}</strong>
                    <button
                      type="button"
                      onClick={() => setTopDays((n) => Math.min(90, n + 1))}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )}
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
          {quote.topDays > 0 && (
            <div>
              <span>ТОП {quote.topDays} сут.</span>
              <strong>+{formatRub(quote.topAmount)}</strong>
            </div>
          )}
          <div className="dir-pricing__grand">
            <span>
              Итого за {quote.months} мес.
              {quote.topDays > 0 ? ' + ТОП' : ''}
            </span>
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
              placeholder="Чем занимаетесь, услуги…"
            />
          </label>
          <label>
            Район *
            {districts.length > 0 ? (
              <select
                required
                value={form.region}
                onChange={(e) => setField('region', e.target.value)}
              >
                <option value="">Выберите район</option>
                {districts.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
                {form.region && !districts.includes(form.region) && (
                  <option value={form.region}>{form.region}</option>
                )}
              </select>
            ) : (
              <input
                required
                value={form.region}
                onChange={(e) => setField('region', e.target.value)}
                placeholder="Например: Соликамск"
              />
            )}
          </label>
          <label>
            Адрес
            <input value={form.address} onChange={(e) => setField('address', e.target.value)} />
          </label>
          <label className="dir-pricing__full">
            Часы работы
            <textarea
              rows={3}
              value={form.hours}
              onChange={(e) => setField('hours', e.target.value)}
              placeholder={'Пн 11:00–22:00\nВт–Ср выходной\nЧт–Вс 11:00–22:00'}
            />
            <span className="dir-pricing__hint">Каждый интервал — с новой строки</span>
          </label>
          <label className="dir-pricing__full">
            Сайт или группа (необязательно)
            <input
              type="text"
              value={form.website}
              onChange={(e) => setField('website', e.target.value)}
              placeholder="https://… или ссылка на группу — можно оставить пустым"
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
