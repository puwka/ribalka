import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { cmsService, CMS_PAGES } from '../../../services/cmsService';
import { AdminPageHead, AdminAlert, AdminField, AdminLoading } from '../AdminUI';

export default function AdminContentCatalogPage({ pageKey, title, previewPath }) {
  const { user } = useAuth();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setPage(await cmsService.getPage(pageKey));
      } finally {
        setLoading(false);
      }
    })();
  }, [pageKey]);

  const setField = (key, value) => setPage((p) => ({ ...p, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await cmsService.savePage(user.id, pageKey, page);
      setMessage('Сохранено');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !page) return <AdminLoading />;

  return (
    <>
      <AdminPageHead title={title} subtitle="Контент страницы каталога (не сами водоёмы)" />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      <section className="admin-panel">
        <AdminField label="Заголовок страницы">
          <input className="admin-input" value={page.title} onChange={(e) => setField('title', e.target.value)} />
        </AdminField>
        <AdminField label="Описание">
          <textarea className="admin-textarea" rows={3} value={page.description} onChange={(e) => setField('description', e.target.value)} />
        </AdminField>
        <AdminField label="Intro (доп. блок)">
          <textarea className="admin-textarea" rows={4} value={page.intro || ''} onChange={(e) => setField('intro', e.target.value)} />
        </AdminField>
      </section>

      <div className="admin-toolbar">
        <button type="button" className="admin-btn admin-btn--primary" disabled={saving} onClick={save}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        <a href={previewPath} target="_blank" rel="noreferrer" className="admin-btn">
          Предпросмотр
        </a>
      </div>
    </>
  );
}

export function AdminContentPaidWaters() {
  return (
    <AdminContentCatalogPage
      pageKey={CMS_PAGES.PAID_WATERS}
      title="Контент: Платные водоёмы"
      previewPath="/paid-waters"
    />
  );
}

export function AdminContentFreeWaters() {
  return (
    <AdminContentCatalogPage
      pageKey={CMS_PAGES.FREE_WATERS}
      title="Контент: Бесплатные водоёмы"
      previewPath="/free-waters"
    />
  );
}
