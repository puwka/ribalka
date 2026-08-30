import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { cmsService } from '../../../services/cmsService';
import { AdminPageHead, AdminAlert, AdminField, AdminLoading } from '../AdminUI';
import { ImageUploadField } from '../../media/ImageUpload';
import { uploadService } from '../../../services/uploadService';

const PAGE_PATHS = ['/', '/paid-waters', '/free-waters', '/map'];

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

  return (
    <>
      <AdminPageHead title="SEO" subtitle="Meta-теги и технические настройки" />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      <div className="admin-toolbar">
        {PAGE_PATHS.map((p) => (
          <button
            key={p}
            type="button"
            className={`admin-btn ${activePath === p ? 'admin-btn--primary' : ''}`}
            onClick={() => setActivePath(p)}
          >
            {p}
          </button>
        ))}
      </div>

      <section className="admin-panel">
        <h3>Страница: {activePath}</h3>
        <AdminField label="Title">
          <input className="admin-input" value={page.title || ''} onChange={(e) => setPageField('title', e.target.value)} />
        </AdminField>
        <AdminField label="Description">
          <textarea className="admin-textarea" rows={2} value={page.description || ''} onChange={(e) => setPageField('description', e.target.value)} />
        </AdminField>
        <div className="admin-grid-2">
          <AdminField label="Keywords">
            <input className="admin-input" value={page.keywords || ''} onChange={(e) => setPageField('keywords', e.target.value)} />
          </AdminField>
          <AdminField label="Canonical">
            <input className="admin-input" value={page.canonical || ''} onChange={(e) => setPageField('canonical', e.target.value)} />
          </AdminField>
        </div>
        <div className="admin-grid-2">
          <AdminField label="OG Title">
            <input className="admin-input" value={page.ogTitle || ''} onChange={(e) => setPageField('ogTitle', e.target.value)} />
          </AdminField>
          <ImageUploadField
            label="OG Image"
            value={page.ogImage || ''}
            onChange={(url) => setPageField('ogImage', url)}
            bucket={uploadService.buckets.site}
          />
        </div>
        <AdminField label="OG Description">
          <textarea className="admin-textarea" rows={2} value={page.ogDescription || ''} onChange={(e) => setPageField('ogDescription', e.target.value)} />
        </AdminField>
      </section>

      <section className="admin-panel">
        <h3>Глобальные настройки</h3>
        <AdminField label="robots.txt">
          <textarea className="admin-textarea" rows={4} value={seo.robots || ''} onChange={(e) => setGlobal('robots', e.target.value)} />
        </AdminField>
        <label className="admin-check">
          <input type="checkbox" checked={Boolean(seo.sitemapEnabled)} onChange={(e) => setGlobal('sitemapEnabled', e.target.checked)} />
          Sitemap включён
        </label>
        <AdminField label="Schema.org (JSON-LD)">
          <textarea className="admin-textarea" rows={4} value={seo.schemaOrg || ''} onChange={(e) => setGlobal('schemaOrg', e.target.value)} />
        </AdminField>
      </section>

      <button type="button" className="admin-btn admin-btn--primary" disabled={saving} onClick={save}>
        {saving ? 'Сохранение…' : 'Сохранить'}
      </button>
    </>
  );
}
