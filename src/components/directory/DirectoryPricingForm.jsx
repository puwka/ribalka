import { useEffect, useMemo, useState } from 'react';
import { listingPaymentService } from '../../services/listingPaymentService';
import { apiDataEnabled } from '../../lib/apiClient';
import {
  DEFAULT_SERVICE_TARIFF,
  DIRECTORY_PERIODS,
  calcServiceTotal,
  formatRub,
  normalizeServiceTariff,
} from '../../lib/directoryPricing';
import './DirectoryPricingForm.css';

/** Calculator for directory placement (shops / services / guides) */
export default function DirectoryPricingForm() {
  const [tariff, setTariff] = useState(DEFAULT_SERVICE_TARIFF);
  const [months, setMonths] = useState(3);
  const [frame, setFrame] = useState(false);

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
    () => calcServiceTotal(tariff, { months, frame }),
    [tariff, months, frame]
  );

  return (
    <section className="dir-pricing" id="directory-pricing">
      <header className="dir-pricing__head">
        <h2>Размещение в справочнике</h2>
        <p>Магазины, сервисы и гиды — один тариф. Сумма пересчитается автоматически</p>
      </header>

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

      <p className="dir-pricing__hint">
        Для размещения свяжитесь с администрацией сайта. Актуальные цены задаются в админке (Тарифы).
      </p>
    </section>
  );
}
