import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { directoryAdminService } from '../../../services/directoryAdminService';
import {
  AdminPageHead,
  AdminAlert,
  AdminField,
  AdminLoading,
  AdminStatus,
} from '../AdminUI';
import { ImageUploadField } from '../../media/ImageUpload';
import { uploadService } from '../../../services/uploadService';

const FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'shop', label: 'Магазины' },
  { id: 'service', label: 'Сервисы' },
  { id: 'guide', label: 'Гиды' },
];

export default function AdminDirectorySection() {
  const { user } = useAuth();
  const [pageMeta, setPageMeta] = useState({ title: '', description: '' });
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(directoryAdminService.emptyForm());
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const page = await directoryAdminService.getPage();
      setPageMeta({ title: page.title || '', description: page.description || '' });
      setItems(await directoryAdminService.listAdmin(user.id, filter));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) load();
  }, [filter, user?.id]);

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const openItem = (item) => {
    setIsNew(false);
    setSelectedId(item.id);
    setError('');
    setMessage('');
    setForm({
      name: item.name || '',
      category: item.category || 'shop',
      description: item.description || '',
      address: item.address || '',
      phone: item.phone || '',
      website: item.website || '',
      hours: item.hours || '',
      image: item.image || '',
      tags: Array.isArray(item.tags) ? item.tags.join(', ') : '',
      status: item.status || 'published',
    });
  };

  const startNew = () => {
    setIsNew(true);
    setSelectedId(null);
    setForm(directoryAdminService.emptyForm());
    setError('');
    setMessage('');
  };

  const saveMeta = async () => {
    setSaving(true);
    setError('');
    try {
      await directoryAdminService.saveMeta(user.id, pageMeta);
      setMessage('Заголовок страницы сохранён');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const save = async (status) => {
    setSaving(true);
    setError('');
    try {
      const saved = await directoryAdminService.saveItem(
        user.id,
        { ...form, status: status || form.status },
        isNew ? null : selectedId
      );
      setSelectedId(saved.id);
      setIsNew(false);
      setMessage('Запись сохранена');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selectedId || isNew) return;
    if (!window.confirm('Удалить запись из справочника?')) return;
    setSaving(true);
    setError('');
    try {
      await directoryAdminService.removeItem(user.id, selectedId);
      setSelectedId(null);
      setIsNew(false);
      setForm(directoryAdminService.emptyForm());
      setMessage('Запись удалена');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AdminPageHead
        title="Справочник"
        subtitle="Магазины, сервисы, гиды и егеря"
        actions={
          <button type="button" className="admin-btn admin-btn--primary" onClick={startNew}>
            + Создать
          </button>
        }
      />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      <section className="admin-panel">
        <h3>Страница /directory</h3>
        <AdminField label="Заголовок">
          <input
            className="admin-input"
            value={pageMeta.title}
            onChange={(e) => setPageMeta((p) => ({ ...p, title: e.target.value }))}
          />
        </AdminField>
        <AdminField label="Описание">
          <textarea
            className="admin-textarea"
            rows={2}
            value={pageMeta.description}
            onChange={(e) => setPageMeta((p) => ({ ...p, description: e.target.value }))}
          />
        </AdminField>
        <div className="admin-toolbar">
          <button type="button" className="admin-btn" disabled={saving} onClick={saveMeta}>
            Сохранить заголовок
          </button>
          <a href="/directory" target="_blank" rel="noreferrer" className="admin-btn">
            Предпросмотр
          </a>
        </div>
      </section>

      <div className="admin-toolbar">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={`admin-btn ${filter === f.id ? 'admin-btn--primary' : ''}`}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminLoading />
      ) : (
        <div className="admin-split">
          <div>
            {items.length === 0 ? (
              <div className="admin-empty">Нет записей</div>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`admin-list-item${String(selectedId) === String(item.id) ? ' is-active' : ''}`}
                  onClick={() => openItem(item)}
                >
                  <div className="admin-list-item__title">{item.name}</div>
                  <div className="admin-list-item__meta">
                    <AdminStatus status={item.status || 'published'}>
                      {item.status || 'published'}
                    </AdminStatus>
                    {' · '}
                    {item.category}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="admin-panel">
            {!selectedId && !isNew ? (
              <div className="admin-empty">Выберите запись или создайте новую</div>
            ) : (
              <>
                <AdminField label="Название">
                  <input
                    className="admin-input"
                    value={form.name}
                    onChange={(e) => setField('name', e.target.value)}
                  />
                </AdminField>
                <div className="admin-grid-2">
                  <AdminField label="Категория">
                    <select
                      className="admin-input"
                      value={form.category}
                      onChange={(e) => setField('category', e.target.value)}
                    >
                      <option value="shop">Магазин</option>
                      <option value="service">Сервис</option>
                      <option value="guide">Гид / егерь</option>
                    </select>
                  </AdminField>
                  <AdminField label="Статус">
                    <select
                      className="admin-input"
                      value={form.status}
                      onChange={(e) => setField('status', e.target.value)}
                    >
                      <option value="published">published</option>
                      <option value="draft">draft</option>
                      <option value="hidden">hidden</option>
                    </select>
                  </AdminField>
                </div>
                <AdminField label="Описание">
                  <textarea
                    className="admin-textarea"
                    rows={4}
                    value={form.description}
                    onChange={(e) => setField('description', e.target.value)}
                  />
                </AdminField>
                <AdminField label="Адрес">
                  <input
                    className="admin-input"
                    value={form.address}
                    onChange={(e) => setField('address', e.target.value)}
                  />
                </AdminField>
                <div className="admin-grid-2">
                  <AdminField label="Телефон">
                    <input
                      className="admin-input"
                      value={form.phone}
                      onChange={(e) => setField('phone', e.target.value)}
                    />
                  </AdminField>
                  <AdminField label="Часы работы">
                    <input
                      className="admin-input"
                      value={form.hours}
                      onChange={(e) => setField('hours', e.target.value)}
                    />
                  </AdminField>
                </div>
                <AdminField label="Сайт">
                  <input
                    className="admin-input"
                    value={form.website}
                    onChange={(e) => setField('website', e.target.value)}
                    placeholder="https://"
                  />
                </AdminField>
                <AdminField label="Теги (через запятую)">
                  <input
                    className="admin-input"
                    value={form.tags}
                    onChange={(e) => setField('tags', e.target.value)}
                  />
                </AdminField>
                <ImageUploadField
                  label="Фото"
                  value={form.image}
                  onChange={(url) => setField('image', url)}
                  bucket={uploadService.buckets.site}
                />
                <div className="admin-toolbar">
                  <button
                    type="button"
                    className="admin-btn admin-btn--primary"
                    disabled={saving}
                    onClick={() => save('published')}
                  >
                    Сохранить
                  </button>
                  <button
                    type="button"
                    className="admin-btn"
                    disabled={saving}
                    onClick={() => save('draft')}
                  >
                    Черновик
                  </button>
                  {!isNew && selectedId && (
                    <button
                      type="button"
                      className="admin-btn admin-btn--danger"
                      disabled={saving}
                      onClick={remove}
                    >
                      Удалить
                    </button>
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
