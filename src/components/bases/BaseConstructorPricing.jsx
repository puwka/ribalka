import { useMemo } from 'react';
import {
  DIRECTORY_PERIODS,
  calcConstructorTotal,
  formatRub,
  normalizeConstructor,
} from '../../lib/directoryPricing';
import '../directory/DirectoryPricingForm.css';

/**
 * Live tariff constructor for bases (same UX idea as directory checkout).
 * Controlled: options + onChange.
 */
export default function BaseConstructorPricing({
  tariff,
  options,
  onChange,
  title = 'Тариф и опции размещения',
}) {
  const ctor = normalizeConstructor(tariff || {});
  const { months, top, frame, extraPhotos, extraVideos } = options;

  const quote = useMemo(
    () =>
      calcConstructorTotal(ctor, {
        months,
        top,
        frame,
        extraPhotos,
        extraVideos,
      }),
    [ctor, months, top, frame, extraPhotos, extraVideos]
  );

  const set = (patch) => onChange?.({ ...options, ...patch });

  return (
    <section className="dir-pricing" style={{ marginTop: '1.5rem' }}>
      <header className="dir-pricing__head">
        <h2>{title}</h2>
        <p>
          Выберите срок и доп. опции — стоимость считается сразу. После сохранения карточки можно
          оплатить выбранный пакет.
        </p>
      </header>

      {!ctor.enabled && (
        <p className="dir-pricing__hint" style={{ color: '#b91c1c' }}>
          Приём оплат временно отключён администратором.
        </p>
      )}

      <div className="dir-pricing__body">
        <div className="dir-pricing__base">
          <strong>{ctor.title}</strong>
          <span>{formatRub(ctor.baseAmount)} / мес</span>
        </div>
        <p className="dir-pricing__hint" style={{ marginTop: 0 }}>
          В тарифе: {ctor.includedPhotos} фото и {ctor.includedVideos} видео. Доп. медиа — ниже.
        </p>
        <div className="dir-pricing__addons">
          <p className="dir-pricing__label">Добавить:</p>
          <label className="dir-pricing__check">
            <input
              type="checkbox"
              checked={Boolean(top)}
              onChange={(e) => set({ top: e.target.checked })}
            />
            <span>
              Размещение в ТОП <em>+{formatRub(ctor.addonTop)}/мес</em>
            </span>
          </label>
          <label className="dir-pricing__check">
            <input
              type="checkbox"
              checked={Boolean(frame)}
              onChange={(e) => set({ frame: e.target.checked })}
            />
            <span>
              Жёлтая рамка <em>+{formatRub(ctor.addonFrame)}/мес</em>
            </span>
          </label>
        </div>
      </div>

      <div className="dir-pricing__periods">
        <p className="dir-pricing__label">Срок оплаты (от 3 месяцев):</p>
        <div className="dir-pricing__period-btns">
          {DIRECTORY_PERIODS.map((m) => {
            const disc = m === 3 ? ctor.discount3 : m === 6 ? ctor.discount6 : ctor.discount12;
            return (
              <button
                key={m}
                type="button"
                className={months === m ? 'is-active' : ''}
                onClick={() => set({ months: m })}
              >
                {m} мес.
                {disc > 0 ? ` (−${disc}%)` : ''}
              </button>
            );
          })}
        </div>
      </div>

      <div className="dir-pricing__addons" style={{ marginTop: '1rem' }}>
        <p className="dir-pricing__label">Доп. медиа:</p>
        <div className="base-ctor__counters">
          <div className="base-ctor__counter">
            <span>
              + фото <em>+{formatRub(ctor.addonPhoto)}</em>
            </span>
            <div>
              <button type="button" onClick={() => set({ extraPhotos: Math.max(0, extraPhotos - 1) })}>
                −
              </button>
              <strong>{extraPhotos}</strong>
              <button type="button" onClick={() => set({ extraPhotos: extraPhotos + 1 })}>
                +
              </button>
            </div>
          </div>
          <div className="base-ctor__counter">
            <span>
              + видео <em>+{formatRub(ctor.addonVideo)}</em>
            </span>
            <div>
              <button type="button" onClick={() => set({ extraVideos: Math.max(0, extraVideos - 1) })}>
                −
              </button>
              <strong>{extraVideos}</strong>
              <button type="button" onClick={() => set({ extraVideos: extraVideos + 1 })}>
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="dir-pricing__total">
        <div>
          <span>В месяц</span>
          <strong>{formatRub(quote.monthly)}</strong>
        </div>
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
    </section>
  );
}

export function buildPaymentQuery(options) {
  const qs = new URLSearchParams();
  if (options.months) qs.set('months', String(options.months));
  if (options.top) qs.set('top', '1');
  if (options.frame) qs.set('frame', '1');
  if (options.extraPhotos) qs.set('extraPhotos', String(options.extraPhotos));
  if (options.extraVideos) qs.set('extraVideos', String(options.extraVideos));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export const DEFAULT_BASE_OPTIONS = {
  months: 3,
  top: false,
  frame: false,
  extraPhotos: 0,
  extraVideos: 0,
};
