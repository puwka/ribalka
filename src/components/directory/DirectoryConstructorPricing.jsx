import { useMemo } from 'react';
import {
  DIRECTORY_PERIODS,
  calcServiceTotal,
  formatRub,
  normalizeServiceTariff,
} from '../../lib/directoryPricing';
import './DirectoryPricingForm.css';

export const DEFAULT_DIRECTORY_OPTIONS = {
  months: 3,
  top: false,
  topDays: 0,
  frame: false,
};

export function buildDirectoryPaymentQuery(options) {
  const qs = new URLSearchParams();
  if (options.months) qs.set('months', String(options.months));
  if (options.frame) qs.set('frame', '1');
  if (options.topDays) qs.set('topDays', String(options.topDays));
  if (options.mode) qs.set('mode', String(options.mode));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/**
 * Live tariff block for shops / services / guides.
 * TOP: choose number of days in the same quote; disabled when category slots are full.
 */
export default function DirectoryConstructorPricing({
  tariff,
  options,
  onChange,
  title = 'Тариф и опции размещения',
  subtitle = 'Выберите срок и доп. опции — стоимость считается сразу, как у баз.',
  hidePeriods = false,
  hideTotal = false,
  topSlots = null,
}) {
  const t = normalizeServiceTariff(tariff || {});
  const { months, frame } = options;
  const topDays = Math.max(0, Number(options.topDays) || 0);
  const dailyPrice = Number(t.addonTopDaily ?? t.addonTop) || 300;
  const topSlotsFull =
    Boolean(topSlots) && topSlots.dailyAvailable === false && !topSlots.alreadyTop;

  const quote = useMemo(
    () =>
      calcServiceTotal(t, {
        months,
        frame,
        topDays: topSlotsFull ? 0 : topDays,
      }),
    [t, months, frame, topDays, topSlotsFull]
  );

  const set = (patch) => {
    const next = { ...options, top: false, ...patch };
    if (topSlotsFull) next.topDays = 0;
    onChange?.(next);
  };

  return (
    <section className="dir-pricing" style={{ marginTop: '1.5rem' }}>
      <header className="dir-pricing__head">
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </header>

      {!t.enabled && (
        <p className="dir-pricing__hint" style={{ color: '#b91c1c' }}>
          Приём оплат временно отключён администратором.
        </p>
      )}

      <div className="dir-pricing__body">
        <div className="dir-pricing__base">
          <strong>{t.title}</strong>
          <span>{formatRub(t.amountPerMonth)} / мес</span>
        </div>
        <p className="dir-pricing__hint" style={{ marginTop: 0 }}>
          В карточке одно изображение. Ниже — продвижение
          {hidePeriods ? '.' : ' и срок оплаты.'}
        </p>
        <div className="dir-pricing__addons">
          <p className="dir-pricing__label">Добавить:</p>
          <label className="dir-pricing__check">
            <input
              type="checkbox"
              checked={Boolean(frame)}
              onChange={(e) => set({ frame: e.target.checked })}
            />
            <span>
              Жёлтая рамка <em>+{formatRub(t.addonFrame)}/мес</em>
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
                  ТОП на сутки <em>+{formatRub(dailyPrice)} / сут</em>
                  <small style={{ display: 'block', opacity: 0.75, marginTop: 2 }}>
                    В категории {topSlots ? `${topSlots.used}/${topSlots.max}` : '0/4'} мест
                    {topSlots?.alreadyTop ? ' · у вас уже есть ТОП — сутки добавятся к сроку' : ''}
                  </small>
                </span>
                <div>
                  <button
                    type="button"
                    aria-label="Меньше суток ТОП"
                    onClick={() => set({ topDays: Math.max(0, topDays - 1) })}
                  >
                    −
                  </button>
                  <strong>{topDays}</strong>
                  <button
                    type="button"
                    aria-label="Больше суток ТОП"
                    onClick={() => set({ topDays: Math.min(90, topDays + 1) })}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {!hidePeriods && (
        <div className="dir-pricing__periods">
          <p className="dir-pricing__label">Срок оплаты (от 3 месяцев):</p>
          <div className="dir-pricing__period-btns">
            {DIRECTORY_PERIODS.map((m) => {
              const disc = m === 3 ? t.discount3 : m === 6 ? t.discount6 : t.discount12;
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
      )}

      {!hideTotal && (
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
          {quote.topDays > 0 && (
            <div>
              <span>
                ТОП {quote.topDays}{' '}
                {quote.topDays === 1 ? 'сутки' : quote.topDays < 5 ? 'суток' : 'суток'}
              </span>
              <strong>+{formatRub(quote.topAmount)}</strong>
            </div>
          )}
          <div className="dir-pricing__grand">
            <span>
              Итого
              {!hidePeriods ? ` за ${quote.months} мес.` : ''}
              {quote.topDays > 0 ? ` + ТОП` : ''}
            </span>
            <strong>{formatRub(quote.total)}</strong>
          </div>
        </div>
      )}
    </section>
  );
}
