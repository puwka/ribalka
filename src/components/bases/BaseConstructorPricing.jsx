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
 * TOP is not sold monthly — only «ТОП на сутки» (+300 ₽) after payment.
 */
export default function BaseConstructorPricing({
  tariff,
  options,
  onChange,
  title = 'Тариф и опции размещения',
  topSlots = null,
  mode = 'renew',
}) {
  const ctor = normalizeConstructor(tariff || {});
  const { months, frame, extraPhotos, extraVideos } = options;
  const isUpgrade = mode === 'upgrade';

  const quote = useMemo(
    () =>
      calcConstructorTotal(ctor, {
        months,
        top: false,
        frame,
        extraPhotos,
        extraVideos,
      }),
    [ctor, months, frame, extraPhotos, extraVideos]
  );

  const set = (patch) => onChange?.({ ...options, top: false, ...patch });

  return (
    <section className="dir-pricing" style={{ marginTop: '1.5rem' }}>
      <header className="dir-pricing__head">
        <h2>{title}</h2>
        <p>
          {isUpgrade
            ? `Доплата без продления срока: увеличьте число фото/видео (+${formatRub(ctor.addonPhoto)} / +${formatRub(ctor.addonVideo)}) или включите рамку.`
            : 'Выберите срок и доп. опции — стоимость считается сразу. После сохранения карточки можно оплатить выбранный пакет.'}
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
              checked={Boolean(frame)}
              onChange={(e) => set({ frame: e.target.checked })}
            />
            <span>
              Жёлтая рамка <em>+{formatRub(ctor.addonFrame)}/мес</em>
            </span>
          </label>
          {topSlots ? (
            <p className="dir-pricing__hint" style={{ marginTop: 8 }}>
              ТОП на сутки — <strong>{formatRub(ctor.addonTopDaily ?? 300)}</strong> · мест на
              главной {topSlots.used}/{topSlots.max}
              {!topSlots.dailyAvailable && !topSlots.alreadyTop
                ? ' · сейчас занято, кнопка неактивна'
                : ' · кнопка ниже на странице карточки'}
              .
            </p>
          ) : (
            <p className="dir-pricing__hint" style={{ marginTop: 8 }}>
              ТОП на сутки — <strong>{formatRub(ctor.addonTopDaily ?? 300)}</strong>. Если все 4
              места на главной заняты — кнопка неактивна.
            </p>
          )}
        </div>
      </div>

      {!isUpgrade && (
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
      )}

      <div className="dir-pricing__addons" style={{ marginTop: '1rem' }}>
        <p className="dir-pricing__label">
          {isUpgrade
            ? 'Докупить фото / видео (только новые слоты):'
            : 'Доп. медиа (можно докупить в любой момент за доплату):'}
        </p>
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

      {!isUpgrade && (
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
      )}
    </section>
  );
}

export function buildPaymentQuery(options) {
  const qs = new URLSearchParams();
  if (options.months) qs.set('months', String(options.months));
  // Monthly TOP removed from constructor — only daily TOP is sold separately
  if (options.frame) qs.set('frame', '1');
  if (options.extraPhotos) qs.set('extraPhotos', String(options.extraPhotos));
  if (options.extraVideos) qs.set('extraVideos', String(options.extraVideos));
  if (options.mode) qs.set('mode', String(options.mode));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

/**
 * Mid-period media-only upgrade (no renew, no accidental frame upsell).
 * Charges only addonPhoto/addonVideo deltas on the server.
 */
export function buildMediaUpgradeQuery(base, patch = {}) {
  const paidPhotos = Math.max(0, Number(base?.paid_extra_photos) || 0);
  const paidVideos = Math.max(0, Number(base?.paid_extra_videos) || 0);
  const hasFrame = Boolean(base?.yellow_frame || base?.yellowFrame);
  return buildPaymentQuery({
    mode: 'upgrade',
    // Preserve already-paid frame; do not force buying a new one with photos
    frame: hasFrame,
    extraPhotos:
      patch.extraPhotos != null ? Math.max(0, Number(patch.extraPhotos) || 0) : paidPhotos,
    extraVideos:
      patch.extraVideos != null ? Math.max(0, Number(patch.extraVideos) || 0) : paidVideos,
  });
}

export const DEFAULT_BASE_OPTIONS = {
  months: 3,
  top: false,
  frame: false,
  extraPhotos: 0,
  extraVideos: 0,
};
