import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { newsAdminService } from '../../../services/newsAdminService';
import {
  AdminPageHead,
  AdminAlert,
  AdminField,
  AdminLoading,
  AdminStatus,
} from '../AdminUI';
import { ImageUploadField } from '../../media/ImageUpload';
import { uploadService } from '../../../services/uploadService';

export default function AdminNewsSection() {
  const { user, profile } = useAuth();
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(newsAdminService.emptyForm());
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setItems(await newsAdminService.listAdmin(user.id, filter));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter, user?.id]);

  const openItem = async (id) => {
    setIsNew(false);
    setError('');
    setMessage('');
    const row = await newsAdminService.getById(id);
    if (!row) {
      setError('Новость не найдена');
      setSelected(null);
      return;
    }
    setSelected(row);
    setForm({
      title: row.title || '',
      slug: row.slug || String(row.id),
      excerpt: row.excerpt || '',
      content: row.content || '',
      cover_url: row.cover_url || row.image || '',
      category: row.category || 'Новости',
      author: row.author || '',
      status: row.status || 'published',
      published_at: row.published_at || row.date || '',
    });
  };

  const startNew = () => {
    setIsNew(true);
    setSelected(null);
    setForm(newsAdminService.emptyForm());
  };

  const save = async (status) => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form, status: status || form.status };
      const saved = await newsAdminService.save(
        user.id,
        payload,
        isNew ? null : selected?.id,
        profile?.display_name
      );
      setSelected(saved);
      setIsNew(false);
      setMessage('Сохранено');
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
        title="Новости"
        subtitle="CMS-редактор новостей и статей"
        actions={
          <button type="button" className="admin-btn admin-btn--primary" onClick={startNew}>
            + Создать
          </button>
        }
      />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      <div className="admin-toolbar">
        {[
          { id: 'all', label: 'Все' },
          { id: 'published', label: 'Опубликованные' },
          { id: 'draft', label: 'Черновики' },
          { id: 'archived', label: 'В архиве' },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            className={`admin-btn ${filter === s.id ? 'admin-btn--primary' : ''}`}
            onClick={() => setFilter(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminLoading />
      ) : (
        <div className="admin-split">
          <div>
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`admin-list-item${selected?.id === n.id ? ' is-active' : ''}`}
                onClick={() => openItem(n.id)}
              >
                <div className="admin-list-item__title">{n.title}</div>
                <div className="admin-list-item__meta">
                  <AdminStatus status={n.status || 'published'}>{n.status || 'published'}</AdminStatus>
                  {' · '}
                  {n.date || n.published_at?.slice(0, 10)}
                </div>
              </button>
            ))}
          </div>

          <div className="admin-panel">
            {!selected && !isNew ? (
              <div className="admin-empty">Выберите новость</div>
            ) : (
              <>
                <AdminField label="Заголовок">
                  <input className="admin-input" value={form.title} onChange={(e) => setField('title', e.target.value)} />
                </AdminField>
                <div className="admin-grid-2">
                  <AdminField label="Категория">
                    <input className="admin-input" value={form.category} onChange={(e) => setField('category', e.target.value)} />
                  </AdminField>
                  <AdminField label="Автор">
                    <input className="admin-input" value={form.author} onChange={(e) => setField('author', e.target.value)} />
                  </AdminField>
                </div>
                <AdminField label="Краткое описание">
                  <textarea className="admin-textarea" rows={2} value={form.excerpt} onChange={(e) => setField('excerpt', e.target.value)} />
                </AdminField>
                <AdminField label="Текст (Markdown)">
                  <textarea className="admin-textarea" rows={12} value={form.content} onChange={(e) => setField('content', e.target.value)} />
                </AdminField>
                <ImageUploadField
                  label="Обложка"
                  value={form.cover_url}
                  onChange={(url) => setField('cover_url', url)}
                  bucket={uploadService.buckets.news}
                />
                <div className="admin-toolbar">
                  <button type="button" className="admin-btn admin-btn--primary" disabled={saving} onClick={() => save('published')}>
                    Опубликовать
                  </button>
                  <button type="button" className="admin-btn" disabled={saving} onClick={() => save('draft')}>
                    Черновик
                  </button>
                  {!isNew && selected && (
                    <Link to={`/news/${selected.id}`} className="admin-btn" target="_blank">
                      Предпросмотр
                    </Link>
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
