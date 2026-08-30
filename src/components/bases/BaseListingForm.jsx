import { useState } from 'react';
import { basesService } from '../../services/basesService';
import { ImageUploadListField } from '../media/ImageUpload';
import { uploadService } from '../../services/uploadService';
import './BaseListingForm.css';

export default function BaseListingForm({
  initialForm,
  onSubmit,
  onSubmitAndSend,
  submitLabel = 'Сохранить',
  sendLabel = 'Сохранить и отправить на модерацию',
  disabled = false,
}) {
  const [form, setForm] = useState(initialForm || basesService.emptyForm());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const run = async (handler) => {
    setSaving(true);
    setError('');
    try {
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

  return (
    <form className="base-form" onSubmit={handleSubmit}>
      <div className="base-form__grid">
        <label>
          Название *
          <input required value={form.name} onChange={set('name')} disabled={disabled} />
        </label>
        <label>
          Тип
          <select value={form.type} onChange={set('type')} disabled={disabled}>
            <option value="paid">Платная база</option>
            <option value="free">Бесплатное место</option>
          </select>
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
          <ImageUploadListField
            label="Фотографии"
            value={form.imagesText}
            onChange={(v) => setForm((f) => ({ ...f, imagesText: v }))}
            bucket={uploadService.buckets.base}
            disabled={disabled}
            max={15}
          />
        </div>
        <label className="base-form__full">
          Видео (YouTube embed/URL, каждый с новой строки)
          <textarea
            rows={3}
            value={form.videosText}
            onChange={set('videosText')}
            placeholder="https://www.youtube.com/embed/…"
            disabled={disabled}
          />
        </label>
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
