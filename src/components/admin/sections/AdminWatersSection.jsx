import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { catalogAdminService } from '../../../services/catalogAdminService';
import {
  AdminPageHead,
  AdminAlert,
  AdminField,
  AdminLoading,
  AdminStatus,
} from '../AdminUI';
import { ImageUploadListField } from '../../media/ImageUpload';
import { uploadService } from '../../../services/uploadService';
import { api, apiDataEnabled } from '../../../lib/apiClient';

export default function AdminWatersSection() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [filter, setFilter] = useState({ type: '', q: '' });
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(catalogAdminService.emptyForm());
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setItems(await catalogAdminService.listAll(filter));
      if (apiDataEnabled) {
        try {
          const d = await api.get('/api/cms/districts');
          setDistricts((d || []).map((x) => x.name).filter(Boolean));
        } catch {
          /* optional */
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter.type, filter.q]);

  const openItem = async (id) => {
    setIsNew(false);
    setError('');
    setMessage('');
    const row = await catalogAdminService.getById(id);
    setSelected(row);
    setForm(catalogAdminService.recordToForm(row));
  };

  const startNew = () => {
    setIsNew(true);
    setSelected(null);
    setForm(catalogAdminService.emptyForm());
    setError('');
    setMessage('');
  };

  const save = async (status) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = { ...form, status: status || form.status };
      const saved = await catalogAdminService.save(
        user.id,
        payload,
        isNew ? null : selected?.id,
        profile?.display_name
      );
      setSelected(saved);
      setIsNew(false);
      setForm(catalogAdminService.recordToForm(saved));
      setMessage('Сохранено');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const archive = async () => {
    if (!selected || !window.confirm('Скрыть водоём из каталога?')) return;
    setSaving(true);
    setError('');
    try {
      await catalogAdminService.archive(user.id, selected.id, profile?.display_name);
      setSelected(null);
      setIsNew(false);
      setMessage('Скрыто из каталога');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected || !window.confirm('Удалить водоём безвозвратно?')) return;
    setSaving(true);
    setError('');
    try {
      await catalogAdminService.remove(user.id, selected.id, profile?.display_name);
      setSelected(null);
      setIsNew(false);
      setForm(catalogAdminService.emptyForm());
      setMessage('Удалено');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <>
      <AdminPageHead
        title="Водоёмы"
        subtitle="Изменения сохраняются на сервер и видны всем посетителям"
        actions={
          <button type="button" className="admin-btn admin-btn--primary" onClick={startNew}>
            + Создать
          </button>
        }
      />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      <div className="admin-toolbar">
        <select
          className="admin-select"
          style={{ maxWidth: 160 }}
          value={filter.type}
          onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value }))}
        >
          <option value="">Все типы</option>
          <option value="paid">Платные</option>
          <option value="free">Бесплатные</option>
        </select>
        <input
          className="admin-input"
          style={{ maxWidth: 240 }}
          placeholder="Поиск…"
          value={filter.q}
          onChange={(e) => setFilter((f) => ({ ...f, q: e.target.value }))}
        />
      </div>

      {loading ? (
        <AdminLoading />
      ) : (
        <div className="admin-split">
          <div>
            {items.map((w) => (
              <button
                key={w.id}
                type="button"
                className={`admin-list-item${selected?.id === w.id ? ' is-active' : ''}`}
                onClick={() => openItem(w.id)}
              >
                <div className="admin-list-item__title">{w.name}</div>
                <div className="admin-list-item__meta">
                  <AdminStatus status={w.type}>{w.type === 'free' ? 'Бесплатный' : 'Платный'}</AdminStatus>
                  {' · '}
                  {w.region}
                </div>
              </button>
            ))}
          </div>

          <div className="admin-panel">
            {!selected && !isNew ? (
              <div className="admin-empty">Выберите водоём или создайте новый</div>
            ) : (
              <>
                <h3>{isNew ? 'Новый водоём' : form.name}</h3>

                <div className="admin-grid-2">
                  <AdminField label="Название">
                    <input className="admin-input" value={form.name} onChange={(e) => setField('name', e.target.value)} />
                  </AdminField>
                  <AdminField label="Slug">
                    <input className="admin-input" value={form.slug} onChange={(e) => setField('slug', e.target.value)} />
                  </AdminField>
                </div>

                <div className="admin-grid-2">
                  <AdminField label="Тип">
                    <select className="admin-select" value={form.type} onChange={(e) => setField('type', e.target.value)}>
                      <option value="paid">Платный</option>
                      <option value="free">Бесплатный</option>
                    </select>
                  </AdminField>
                  <AdminField label="Статус">
                    <select className="admin-select" value={form.status} onChange={(e) => setField('status', e.target.value)}>
                      <option value="published">Опубликован</option>
                      <option value="draft">Черновик</option>
                      <option value="archived">В архиве</option>
                    </select>
                  </AdminField>
                </div>

                <AdminField label="Описание">
                  <textarea className="admin-textarea" rows={4} value={form.description} onChange={(e) => setField('description', e.target.value)} />
                </AdminField>

                <div className="admin-grid-2">
                  <AdminField
                    label="Район / регион"
                    hint="Список районов: Админка → Районы"
                  >
                    {districts.length > 0 ? (
                      <select
                        className="admin-select"
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
                        className="admin-input"
                        value={form.region}
                        onChange={(e) => setField('region', e.target.value)}
                        placeholder="Сначала добавьте районы в разделе «Районы»"
                      />
                    )}
                  </AdminField>
                  <AdminField label="Адрес">
                    <input className="admin-input" value={form.address} onChange={(e) => setField('address', e.target.value)} />
                  </AdminField>
                </div>

                <div className="admin-grid-2">
                  <AdminField label="Широта (lat)" hint="Например 58.8333 — точка с запятой тоже ок">
                    <input className="admin-input" value={form.lat} onChange={(e) => setField('lat', e.target.value)} placeholder="58.8333" />
                  </AdminField>
                  <AdminField label="Долгота (lng)" hint="Например 57.8167">
                    <input className="admin-input" value={form.lng} onChange={(e) => setField('lng', e.target.value)} placeholder="57.8167" />
                  </AdminField>
                </div>

                {form.type === 'paid' && (
                  <div className="admin-grid-2">
                    <AdminField label="Цена (текст)">
                      <input className="admin-input" value={form.price_label} onChange={(e) => setField('price_label', e.target.value)} />
                    </AdminField>
                    <AdminField label="Цена от (число)">
                      <input className="admin-input" type="number" value={form.price_from} onChange={(e) => setField('price_from', e.target.value)} />
                    </AdminField>
                  </div>
                )}

                <ImageUploadListField
                  label="Фотографии"
                  value={form.imagesText}
                  onChange={(v) => setField('imagesText', v)}
                  bucket={uploadService.buckets.base}
                  max={15}
                />

                <AdminField
                  label="Видео"
                  hint="YouTube / VK Video — ссылка или embed, каждая с новой строки"
                >
                  <textarea
                    className="admin-textarea"
                    rows={3}
                    value={form.videosText}
                    onChange={(e) => setField('videosText', e.target.value)}
                    placeholder="https://www.youtube.com/embed/…"
                  />
                </AdminField>

                <div className="admin-grid-2">
                  <AdminField label="SEO-заголовок">
                    <input className="admin-input" value={form.seo_title} onChange={(e) => setField('seo_title', e.target.value)} />
                  </AdminField>
                  <AdminField label="SEO-описание">
                    <input className="admin-input" value={form.seo_description} onChange={(e) => setField('seo_description', e.target.value)} />
                  </AdminField>
                </div>

                <div className="admin-toolbar">
                  <button type="button" className="admin-btn admin-btn--primary" disabled={saving} onClick={() => save()}>
                    {saving ? 'Сохранение…' : 'Сохранить'}
                  </button>
                  <button type="button" className="admin-btn" disabled={saving} onClick={() => save('draft')}>
                    Черновик
                  </button>
                  {!isNew && selected && (
                    <>
                      <Link to={`/waters/${selected.id}`} className="admin-btn" target="_blank">
                        Предпросмотр
                      </Link>
                      <button type="button" className="admin-btn admin-btn--danger" disabled={saving} onClick={remove}>
                        Удалить
                      </button>
                      {selected?._isSeed && (
                        <button type="button" className="admin-btn" disabled={saving} onClick={archive}>
                          Скрыть из каталога
                        </button>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
