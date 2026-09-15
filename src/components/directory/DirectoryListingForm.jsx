import { useEffect, useState } from 'react';
import { ImageUploadField } from '../media/ImageUpload';
import { uploadService } from '../../services/uploadService';
import { api, apiDataEnabled } from '../../lib/apiClient';
import './DirectoryListingForm.css';

const CATEGORIES = [
  { id: 'shop', label: 'Магазин' },
  { id: 'service', label: 'Сервис' },
  { id: 'guide', label: 'Гид / егерь' },
];

export function directoryStatusLabel(status) {
  return (
    {
      draft: 'Черновик',
      pending: 'На модерации',
      published: 'Опубликовано',
      approved: 'Опубликовано',
      rejected: 'Отклонено',
    }[status] || status || '—'
  );
}

/** Owner form for shop / service / guide card */
export default function DirectoryListingForm({
  initial = null,
  submitLabel = 'Сохранить',
  onSubmit,
  lockCategory = false,
}) {
  const [form, setForm] = useState({
    name: '',
    category: 'shop',
    phone: '',
    description: '',
    region: '',
    address: '',
    website: '',
    hours: '',
    image: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [districts, setDistricts] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!apiDataEnabled) return;
        const d = await api.get('/api/cms/districts');
        if (alive) setDistricts((d || []).map((x) => x.name).filter(Boolean));
      } catch {
        if (alive) setDistricts([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!initial) return;
    setForm({
      name: initial.name || '',
      category: initial.category || 'shop',
      phone: initial.phone || '',
      description: initial.description || '',
      region: initial.region || '',
      address: initial.address || '',
      website: initial.website || '',
      hours: initial.hours || '',
      image: initial.image || '',
    });
  }, [initial]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSubmit?.(form);
    } catch (err) {
      setError(err.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="dir-listing-form" onSubmit={handleSubmit}>
      <div className="dir-listing-form__tabs" role="tablist" aria-label="Категория">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            className={form.category === c.id ? 'is-active' : ''}
            disabled={lockCategory}
            onClick={() => !lockCategory && setField('category', c.id)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="dir-listing-form__fields">
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
        <label className="dir-listing-form__full">
          Описание *
          <textarea
            required
            rows={4}
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
              placeholder="Например: Красновишерский район, Соликамск"
            />
          )}
        </label>
        <label>
          Адрес
          <input value={form.address} onChange={(e) => setField('address', e.target.value)} />
        </label>
        <label className="dir-listing-form__full">
          Часы работы
          <textarea
            rows={3}
            value={form.hours}
            onChange={(e) => setField('hours', e.target.value)}
            placeholder={'Пн 11:00–22:00\nВт–Ср выходной\nЧт–Вс 11:00–22:00'}
          />
          <span className="dir-listing-form__hint">Каждый интервал — с новой строки</span>
        </label>
        <label className="dir-listing-form__full">
          Сайт или группа (необязательно)
          <input
            type="text"
            value={form.website}
            onChange={(e) => setField('website', e.target.value)}
            placeholder="https://… — можно оставить пустым"
          />
        </label>
        <div className="dir-listing-form__full dir-listing-form__upload">
          <ImageUploadField
            label="Изображение (необязательно)"
            value={form.image}
            onChange={(url) => setField('image', url)}
            bucket={uploadService.buckets.site}
            disabled={saving}
            hint="JPG, PNG, WebP · до 8 МБ"
          />
        </div>
      </div>

      {error && <p className="dir-listing-form__error">{error}</p>}

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Сохранение…' : submitLabel}
      </button>
    </form>
  );
}
