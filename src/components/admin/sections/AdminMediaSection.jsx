import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { cmsDb } from '../../../lib/cmsDb';
import { uploadService } from '../../../services/uploadService';
import { AdminPageHead, AdminAlert, AdminField, AdminLoading } from '../AdminUI';

export default function AdminMediaSection() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [q, setQ] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      setItems(await cmsDb.listMedia());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;

    setUploading(true);
    setError('');
    try {
      for (const file of files) {
        await uploadService.uploadImage(file, { userId: user?.id, bucket: uploadService.buckets.site });
      }
      setMessage(`Загружено файлов: ${files.length}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Удалить файл?')) return;
    await cmsDb.deleteMedia(id);
    await load();
  };

  const copyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setMessage('URL скопирован');
    } catch {
      setError('Не удалось скопировать');
    }
  };

  const filtered = items.filter((m) => !q || m.name?.toLowerCase().includes(q.toLowerCase()));

  if (loading) return <AdminLoading />;

  return (
    <>
      <AdminPageHead title="Медиа" subtitle="Библиотека изображений и файлов" />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      <section className="admin-panel">
        <div className="admin-toolbar">
          <label className={`admin-btn admin-btn--primary${uploading ? ' is-disabled' : ''}`}>
            {uploading ? 'Загрузка…' : 'Загрузить файлы'}
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden disabled={uploading} onChange={onUpload} />
          </label>
          <input className="admin-input" style={{ maxWidth: 240 }} placeholder="Поиск…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>

        {filtered.length === 0 ? (
          <div className="admin-empty">Медиа пока нет</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Превью</th>
                  <th>Имя</th>
                  <th>Размер</th>
                  <th>Дата</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.mime?.startsWith('image/') ? (
                        <img src={m.url} alt="" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 4 }} />
                      ) : '—'}
                    </td>
                    <td>{m.name}</td>
                    <td>{Math.round(m.size / 1024)} KB</td>
                    <td>{new Date(m.created_at).toLocaleDateString('ru-RU')}</td>
                    <td>
                      <div className="admin-table__actions">
                        <button type="button" className="admin-btn admin-btn--sm" onClick={() => copyUrl(m.url)}>Copy URL</button>
                        <button type="button" className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => remove(m.id)}>Удалить</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
