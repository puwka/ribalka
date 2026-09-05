import { useEffect, useMemo, useState } from 'react';
import { listingPaymentService } from '../../services/listingPaymentService';
import { apiDataEnabled } from '../../lib/apiClient';
import {
  DEFAULT_CONSTRUCTOR,
  DEFAULT_SERVICE_TARIFF,
  DIRECTORY_PERIODS,
  calcConstructorTotal,
  calcServiceTotal,
  formatRub,
  normalizeConstructor,
  normalizeServiceTariff,
} from '../../lib/directoryPricing';
import './DirectoryPricingForm.css';

export default function DirectoryPricingForm({ defaultKind = 'constructor' }) {
  const [prices, setPrices] = useState({
    constructor: DEFAULT_CONSTRUCTOR,
    service: DEFAULT_SERVICE_TARIFF,
  });
  const [kind, setKind] = useState(defaultKind === 'service' ? 'service' : 'constructor');
  const [months, setMonths] = useState(3);
  const [top, setTop] = useState(false);
  const [frame, setFrame] = useState(false);
  const [extraPhotos, setExtraPhotos] = useState(0);
  const [extraVideos, setExtraVideos] = useState(0);

  useEffect(() => {
    setKind(defaultKind === 'service' ? 'service' : 'constructor');
  }, [defaultKind]);

  useEffect(() => {
    if (!apiDataEnabled) return;
    listingPaymentService
      .getDirectoryPrices()
      .then((data) => {
        setPrices({
          constructor: normalizeConstructor(data.constructor || data.shop),
          service: normalizeServiceTariff(data.service),
        });
      })
      .catch(() => {});
  }, []);

  const quote = useMemo(() => {
    if (kind === 'service') {
      return calcServiceTotal(prices.service, { months, frame });
    }
    return calcConstructorTotal(prices.constructor, {
      months,
      top,
      frame,
      extraPhotos,
      extraVideos,
    });
  }, [kind, months, top, frame, extraPhotos, extraVideos, prices]);

  const ctor = prices.constructor;
  const svc = prices.service;

  return (
    <section className="dir-pricing" id="directory-pricing">
      <header className="dir-pricing__head">
        <h2>Размещение в справочнике</h2>
        <p>Соберите тариф и срок оплаты — сумма пересчитается автоматически</p>
      </header>

      <div className="dir-pricing__tabs">
        <button
          type="button"
          className={kind === 'constructor' ? 'is-active' : ''}
          onClick={() => setKind('constructor')}
        >
          Конструктор (магазины и гиды)
        </button>
        <button
          type="button"
          className={kind === 'service' ? 'is-active' : ''}
          onClick={() => setKind('service')}
        >
          Сервисы
        </button>
      </div>

      {kind === 'constructor' ? (
        <div className="dir-pricing__body">
          <div className="dir-pricing__base">
            <strong>{ctor.title}</strong>
            <span>{formatRub(ctor.baseAmount)} / мес</span>
            <p>
              В тариф входит {ctor.includedPhotos} фото и {ctor.includedVideos} видео
            </p>
          </div>

          <div className="dir-pricing__addons">
            <p className="dir-pricing__label">Добавить:</p>
            <label className="dir-pricing__check">
              <input type="checkbox" checked={top} onChange={(e) => setTop(e.target.checked)} />
              <span>
                Размещение в ТОП <em>+{formatRub(ctor.addonTop)}/мес</em>
              </span>
            </label>
            <label className="dir-pricing__check">
              <input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} />
              <span>
                Выделение рамкой жёлтого цвета <em>+{formatRub(ctor.addonFrame)}/мес</em>
              </span>
            </label>

            <div className="dir-pricing__counter">
              <span>
                + 1 фото <em>+{formatRub(ctor.addonPhoto)} за каждое</em>
              </span>
              <div className="dir-pricing__counter-controls">
                <button
                  type="button"
                  onClick={() => setExtraPhotos((n) => Math.max(0, n - 1))}
                  aria-label="Убрать фото"
                >
                  −
                </button>
                <strong>{extraPhotos}</strong>
                <button
                  type="button"
                  onClick={() => setExtraPhotos((n) => n + 1)}
                  aria-label="Добавить фото"
                >
                  +
                </button>
              </div>
            </div>

            <div className="dir-pricing__counter">
              <span>
                + 1 видео <em>+{formatRub(ctor.addonVideo)} за каждое</em>
              </span>
              <div className="dir-pricing__counter-controls">
                <button
                  type="button"
                  onClick={() => setExtraVideos((n) => Math.max(0, n - 1))}
                  aria-label="Убрать видео"
                >
                  −
                </button>
                <strong>{extraVideos}</strong>
                <button
                  type="button"
                  onClick={() => setExtraVideos((n) => n + 1)}
                  aria-label="Добавить видео"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="dir-pricing__body">
          <div className="dir-pricing__base">
            <strong>{svc.title}</strong>
            <span>{formatRub(svc.amountPerMonth)} / мес</span>
          </div>
          <div className="dir-pricing__addons">
            <p className="dir-pricing__label">Добавить:</p>
            <label className="dir-pricing__check">
              <input type="checkbox" checked={frame} onChange={(e) => setFrame(e.target.checked)} />
              <span>
                Выделение рамкой жёлтого цвета <em>+{formatRub(svc.addonFrame)}/мес</em>
              </span>
            </label>
          </div>
        </div>
      )}

      <div className="dir-pricing__periods">
        <p className="dir-pricing__label">Срок оплаты (от 3 месяцев):</p>
        <div className="dir-pricing__period-btns">
          {DIRECTORY_PERIODS.map((m) => {
            const disc =
              kind === 'constructor'
                ? m === 3
                  ? ctor.discount3
                  : m === 6
                    ? ctor.discount6
                    : ctor.discount12
                : 0;
            return (
              <button
                key={m}
                type="button"
                className={months === m ? 'is-active' : ''}
                onClick={() => setMonths(m)}
              >
                {m} мес.
                {disc > 0 ? <small>−{disc}%</small> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="dir-pricing__total">
        <div>
          <span>В месяц</span>
          <strong>{formatRub(quote.monthly)}</strong>
        </div>
        {quote.discountPct > 0 && (
          <div>
            <span>Без скидки</span>
            <strong className="dir-pricing__strike">{formatRub(quote.full)}</strong>
          </div>
        )}
        {quote.discountPct > 0 && (
          <div>
            <span>Скидка {quote.discountPct}%</span>
            <strong>−{formatRub(quote.discountAmount)}</strong>
          </div>
        )}
        <div className="dir-pricing__grand">
          <span>Итого за {quote.months} мес.</span>
          <strong>{formatRub(quote.total)}</strong>
        </div>
      </div>

      <p className="dir-pricing__hint">
        Для размещения свяжитесь с администрацией сайта или оформите заявку через личный кабинет.
        Актуальные цены задаются в админке (Тарифы).
      </p>
    </section>
  );
}
