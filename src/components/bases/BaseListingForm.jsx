import { useState } from 'react';
import { Link } from 'react-router-dom';
import { basesService } from '../../services/basesService';
import { ImageUploadListField } from '../media/ImageUpload';
import { uploadService } from '../../services/uploadService';
import { DEFAULT_CONSTRUCTOR, formatRub } from '../../lib/directoryPricing';
import './BaseListingForm.css';

function parseLines(text) {
  return String(text || '')
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function BaseListingForm({
  initialForm,
  onSubmit,
  onSubmitAndSend,
  submitLabel = 'Сохранить',
  sendLabel = 'Сохранить и отправить на модерацию',
  disabled = false,
  showPromoOptions = false,
  /** Admin can place free waters; owners only commercial (paid) bases */
  allowFreeType = false,
  mediaQuota = null,
}) {
  const [form, setForm] = useState(() => {
    const initial = initialForm || basesService.emptyForm();
    if (!allowFreeType) return { ...initial, type: 'paid' };
    return initial;
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [videoDraft, setVideoDraft] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setBool = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));

  const enforceQuota = Boolean(mediaQuota);
  const includedPhotos = Number(mediaQuota?.includedPhotos ?? DEFAULT_CONSTRUCTOR.includedPhotos) || 1;
  const includedVideos = Number(mediaQuota?.includedVideos ?? DEFAULT_CONSTRUCTOR.includedVideos) || 1;
  const extraPhotos = Math.max(0, Number(mediaQuota?.extraPhotos) || 0);
  const extraVideos = Math.max(0, Number(mediaQuota?.extraVideos) || 0);
  const maxPhotos = enforceQuota ? includedPhotos + extraPhotos : 15;
  const maxVideos = enforceQuota ? includedVideos + extraVideos : 15;
  const photoPrice = Number(mediaQuota?.addonPhoto ?? DEFAULT_CONSTRUCTOR.addonPhoto) || 100;
  const videoPrice = Number(mediaQuota?.addonVideo ?? DEFAULT_CONSTRUCTOR.addonVideo) || 100;
  const payHref = mediaQuota?.payHref || null;
  const payHrefPhotos = mediaQuota?.payHrefPhotos || payHref;
  const payHrefVideos = mediaQuota?.payHrefVideos || payHref;

  const videos = parseLines(form.videosText);

  const run = async (handler) => {
    setSaving(true);
    setError('');
    try {
      if (enforceQuota) {
        const imgs = parseLines(form.imagesText);
        const vids = parseLines(form.videosText);
        if (imgs.length > maxPhotos) {
          throw new Error(
            `Доступно только ${maxPhotos} фото. Оплатите доп. фото (+${formatRub(photoPrice)}).`
          );
        }
        if (vids.length > maxVideos) {
          throw new Error(
            `Доступно только ${maxVideos} видео. Оплатите доп. видео (+${formatRub(videoPrice)}).`
          );
        }
      }
      await handler(form);
    } catch (err) {
      setError(err.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await run(onSubmit);
  };

  const addVideo = () => {
    const url = videoDraft.trim();
    if (!url) return;
    if (videos.length >= maxVideos) return;
    setForm((f) => ({
      ...f,
      videosText: [...parseLines(f.videosText), url].join('\n'),
    }));
    setVideoDraft('');
  };

  const removeVideo = (index) => {
    setForm((f) => ({
      ...f,
      videosText: parseLines(f.videosText)
        .filter((_, i) => i !== index)
        .join('\n'),
    }));
  };

  return (
    <form className="base-form" onSubmit={handleSubmit}>
      {showPromoOptions && (
        <div className="base-form__promo">
          <p className="base-form__promo-title">Опции размещения</p>
          <label className="base-form__check">
            <input
              type="checkbox"
              checked={Boolean(form.is_top)}
              onChange={setBool('is_top')}
              disabled={disabled}
            />
            Размещение в ТОП (показывать первыми в каталоге)
          </label>
          <label className="base-form__check">
            <input
              type="checkbox"
              checked={Boolean(form.yellow_frame)}
              onChange={setBool('yellow_frame')}
              disabled={disabled}
            />
            Выделение жёлтой рамкой
          </label>
        </div>
      )}

      <div className="base-form__grid">
        <label>
          Название *
          <input required value={form.name} onChange={set('name')} disabled={disabled} />
        </label>
        <label>
          Тип
          {allowFreeType ? (
            <select value={form.type} onChange={set('type')} disabled={disabled}>
              <option value="paid">Платная база</option>
              <option value="free">Бесплатное место</option>
            </select>
          ) : (
            <>
              <input type="hidden" value="paid" readOnly />
              <div className="base-form__type-fixed">Платная база (коммерческое размещение)</div>
            </>
          )}
        </label>
        <label className="base-form__full">
          Краткое описание
          <input
            value={form.short_description}
            onChange={set('short_description')}
            disabled={disabled}
            maxLength={180}
          />
        </label>
        <label className="base-form__full">
          Описание *
          <textarea required rows={5} value={form.description} onChange={set('description')} disabled={disabled} />
        </label>
        <label>
          Регион *
          <input required value={form.region} onChange={set('region')} disabled={disabled} />
        </label>
        <label>
          Адрес *
          <input required value={form.address} onChange={set('address')} disabled={disabled} />
        </label>
        <label>
          Широта (lat)
          <input value={form.lat} onChange={set('lat')} placeholder="58.01" disabled={disabled} />
        </label>
        <label>
          Долгота (lng)
          <input value={form.lng} onChange={set('lng')} placeholder="56.25" disabled={disabled} />
        </label>
        <label>
          Телефон *
          <input required value={form.phone} onChange={set('phone')} disabled={disabled} />
        </label>
        <label>
          Контакты
          <input
            value={form.contacts}
            onChange={set('contacts')}
            placeholder="WhatsApp, email, менеджер…"
            disabled={disabled}
          />
        </label>
        <label>
          Сайт
          <input value={form.website_url} onChange={set('website_url')} placeholder="https://" disabled={disabled} />
        </label>
        <label>
          Виды рыб
          <input value={form.fish_species} onChange={set('fish_species')} disabled={disabled} />
        </label>
        <label>
          VK
          <input value={form.social_vk} onChange={set('social_vk')} disabled={disabled} />
        </label>
        <label>
          Telegram
          <input value={form.social_telegram} onChange={set('social_telegram')} disabled={disabled} />
        </label>
        <label>
          MAX
          <input value={form.social_max} onChange={set('social_max')} disabled={disabled} />
        </label>
        <label>
          Другая соцсеть
          <input value={form.social_other} onChange={set('social_other')} disabled={disabled} />
        </label>
        <label>
          Цены (подпись)
          <input
            value={form.price_label}
            onChange={set('price_label')}
            placeholder="от 2500 ₽/сутки"
            disabled={disabled}
          />
        </label>
        <label>
          Цена от (число)
          <input value={form.price_from} onChange={set('price_from')} placeholder="2500" disabled={disabled} />
        </label>
        <label>
          График работы
          <input
            value={form.work_hours}
            onChange={set('work_hours')}
            placeholder="Круглосуточно / 08:00–22:00"
            disabled={disabled}
          />
        </label>
        <label className="base-form__full">
          Услуги (через запятую)
          <input
            value={form.servicesText}
            onChange={set('servicesText')}
            placeholder="Баня, прокат лодок, кафе"
            disabled={disabled}
          />
        </label>
        <label className="base-form__full">
          Условия
          <textarea
            rows={3}
            value={form.conditions}
            onChange={set('conditions')}
            placeholder="Правила посещения, норма вылова…"
            disabled={disabled}
          />
        </label>
        <label className="base-form__full">
          Особенности
          <textarea
            rows={3}
            value={form.features}
            onChange={set('features')}
            placeholder="Пирс, домики, детская площадка…"
            disabled={disabled}
          />
        </label>

        <div className="base-form__full">
          {enforceQuota && (
            <p className="base-form__media-note">
              В тарифе: {includedPhotos} фото и {includedVideos} видео бесплатно. Доп. слоты — по{' '}
              {formatRub(photoPrice)} / {formatRub(videoPrice)}.
              Сейчас доступно: {maxPhotos} фото, {maxVideos} видео.
            </p>
          )}
          <ImageUploadListField
            label="Фотографии"
            value={form.imagesText}
            onChange={(v) => setForm((f) => ({ ...f, imagesText: v }))}
            bucket={uploadService.buckets.base}
            disabled={disabled}
            max={maxPhotos}
            hint={
              enforceQuota
                ? `В тарифе ${maxPhotos} фото (из них ${includedPhotos} в базе)`
                : undefined
            }
            upgradeHint={
              enforceQuota
                ? `Лимит фото исчерпан. Оплатите +${formatRub(photoPrice)} за каждое дополнительное фото.`
                : null
            }
            upgradeHref={payHrefPhotos}
          />
        </div>

        <div className="base-form__full">
          <span className="base-form__field-label">Видео (YouTube)</span>
          {enforceQuota ? (
            <div className="base-form__videos">
              {videos.length > 0 && (
                <ul className="base-form__video-list">
                  {videos.map((url, i) => (
                    <li key={`${url}-${i}`}>
                      <span className="base-form__video-url">{url}</span>
                      {!disabled && (
                        <button type="button" onClick={() => removeVideo(i)}>
                          Удалить
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {!disabled && videos.length < maxVideos && (
                <div className="base-form__video-add">
                  <input
                    value={videoDraft}
                    onChange={(e) => setVideoDraft(e.target.value)}
                    placeholder="https://www.youtube.com/embed/…"
                    disabled={disabled}
                  />
                  <button type="button" className="btn-secondary" onClick={addVideo}>
                    Добавить видео
                  </button>
                </div>
              )}
              {!disabled && videos.length >= maxVideos && (
                <div className="media-upgrade-hint">
                  <p>
                    Лимит видео исчерпан. Оплатите +{formatRub(videoPrice)} за каждое дополнительное
                    видео.
                  </p>
                  {payHrefVideos ? (
                    <Link to={payHrefVideos} className="media-upgrade-hint__link">
                      Оплатить доп. видео
                    </Link>
                  ) : (
                    <p className="media-upgrade-hint__muted">
                      Сначала сохраните базу, затем оплатите доп. видео в разделе оплаты размещения.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <textarea
              rows={3}
              value={form.videosText}
              onChange={set('videosText')}
              placeholder="https://www.youtube.com/embed/…"
              disabled={disabled}
            />
          )}
        </div>
      </div>

      {error && <div className="auth-error">{error}</div>}

      <div className="base-form__actions">
        <button className="btn-primary" type="submit" disabled={disabled || saving}>
          {saving ? 'Сохранение…' : submitLabel}
        </button>
        {onSubmitAndSend && (
          <button
            type="button"
            className="btn-secondary"
            disabled={disabled || saving}
            onClick={() => run(onSubmitAndSend)}
          >
            {sendLabel}
          </button>
        )}
      </div>
    </form>
  );
}

export function statusLabel(status) {
  const map = {
    draft: 'Черновик',
    pending: 'На модерации',
    approved: 'Одобрена',
    rejected: 'Отклонена',
    archived: 'В архиве',
  };
  return map[status] || status;
}
