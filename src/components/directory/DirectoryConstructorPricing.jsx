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
  frame: false,
};

export function buildDirectoryPaymentQuery(options) {
  const qs = new URLSearchParams();
  if (options.months) qs.set('months', String(options.months));
  if (options.top) qs.set('top', '1');
  if (options.frame) qs.set('frame', '1');
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/**
 * Live tariff block for shops / services / guides — same UX as bases.
 */
export default function DirectoryConstructorPricing({
  tariff,
  options,
  onChange,
  title = 'Тариф и опции размещения',
  subtitle = 'Выберите срок и доп. опции — стоимость считается сразу, как у баз.',
}) {
  const t = normalizeServiceTariff(tariff || {});
  const { months, top, frame } = options;

  const quote = useMemo(
    () => calcServiceTotal(t, { months, top, frame }),
    [t, months, top, frame]
  );

  const set = (patch) => onChange?.({ ...options, ...patch });

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
          В карточке одно изображение. Ниже — продвижение и срок оплаты.
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
              Размещение в ТОП <em>+{formatRub(t.addonTop)}/мес</em>
            </span>
          </label>
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
        </div>
      </div>

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
