import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { cmsService } from '../../../services/cmsService';
import { AdminPageHead, AdminAlert, AdminField, AdminLoading } from '../AdminUI';
import { ImageUploadField } from '../../media/ImageUpload';
import { uploadService } from '../../../services/uploadService';

const PAGE_PATHS = [
  { path: '/', label: 'Главная' },
  { path: '/paid-waters', label: 'Платные' },
  { path: '/free-waters', label: 'Бесплатные' },
  { path: '/map', label: 'Карта' },
];

export default function AdminSeoSection() {
  const { user } = useAuth();
  const [seo, setSeo] = useState(null);
  const [activePath, setActivePath] = useState('/');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setSeo(await cmsService.getSeo());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const page = seo?.[activePath] || {};

  const setPageField = (key, value) =>
    setSeo((s) => ({ ...s, [activePath]: { ...s[activePath], [key]: value } }));

  const setGlobal = (key, value) => setSeo((s) => ({ ...s, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await cmsService.saveSeo(user.id, seo);
      setMessage('SEO сохранено');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !seo) return <AdminLoading />;

  const activeLabel = PAGE_PATHS.find((p) => p.path === activePath)?.label || activePath;

  return (
    <>
      <AdminPageHead title="SEO" subtitle="Мета-теги и технические настройки для поисковиков" />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      <div className="admin-toolbar">
        {PAGE_PATHS.map((p) => (
          <button
            key={p.path}
            type="button"
            className={`admin-btn ${activePath === p.path ? 'admin-btn--primary' : ''}`}
            onClick={() => setActivePath(p.path)}
          >
            {p.label}
          </button>
        ))}
      </div>

      <section className="admin-panel">
        <h3>Страница: {activeLabel}</h3>
        <AdminField label="Заголовок (title)" hint="Отображается во вкладке браузера и в поиске">
          <input
            className="admin-input"
            value={page.title || ''}
            onChange={(e) => setPageField('title', e.target.value)}
          />
        </AdminField>
        <AdminField label="Описание (description)" hint="Краткий текст в выдаче поиска">
          <textarea
            className="admin-textarea"
            rows={2}
            value={page.description || ''}
            onChange={(e) => setPageField('description', e.target.value)}
          />
        </AdminField>
        <div className="admin-grid-2">
          <AdminField label="Ключевые слова">
            <input
              className="admin-input"
              value={page.keywords || ''}
              onChange={(e) => setPageField('keywords', e.target.value)}
            />
          </AdminField>
          <AdminField label="Канонический URL" hint="Основной адрес страницы">
            <input
              className="admin-input"
              value={page.canonical || ''}
              onChange={(e) => setPageField('canonical', e.target.value)}
            />
          </AdminField>
        </div>
        <div className="admin-grid-2">
          <AdminField label="Заголовок для соцсетей (Open Graph)">
            <input
              className="admin-input"
              value={page.ogTitle || ''}
              onChange={(e) => setPageField('ogTitle', e.target.value)}
            />
          </AdminField>
          <ImageUploadField
            label="Картинка для соцсетей"
            value={page.ogImage || ''}
            onChange={(url) => setPageField('ogImage', url)}
            bucket={uploadService.buckets.site}
          />
        </div>
        <AdminField label="Описание для соцсетей">
          <textarea
            className="admin-textarea"
            rows={2}
            value={page.ogDescription || ''}
            onChange={(e) => setPageField('ogDescription', e.target.value)}
          />
        </AdminField>
      </section>

      <section className="admin-panel">
        <h3>Общие настройки</h3>
        <AdminField label="Файл robots.txt">
          <textarea
            className="admin-textarea"
            rows={4}
            value={seo.robots || ''}
            onChange={(e) => setGlobal('robots', e.target.value)}
          />
        </AdminField>
        <label className="admin-check">
          <input
            type="checkbox"
            checked={Boolean(seo.sitemapEnabled)}
            onChange={(e) => setGlobal('sitemapEnabled', e.target.checked)}
          />
          Карта сайта (sitemap) включена
        </label>
        <AdminField label="Разметка Schema.org (JSON-LD)">
          <textarea
            className="admin-textarea"
            rows={4}
            value={seo.schemaOrg || ''}
            onChange={(e) => setGlobal('schemaOrg', e.target.value)}
          />
        </AdminField>
      </section>

      <button type="button" className="admin-btn admin-btn--primary" disabled={saving} onClick={save}>
        {saving ? 'Сохранение…' : 'Сохранить'}
      </button>
    </>
  );
}
