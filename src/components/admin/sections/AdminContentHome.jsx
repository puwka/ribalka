import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { cmsService, CMS_PAGES } from '../../../services/cmsService';
import { ImageUploadField } from '../../media/ImageUpload';
import { uploadService } from '../../../services/uploadService';
import {
  AdminPageHead,
  AdminAlert,
  AdminField,
  AdminLoading,
} from '../AdminUI';

function BlockToggle({ label, checked, onChange }) {
  return (
    <label className="admin-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export default function AdminContentHome() {
  const { user, profile } = useAuth();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        setPage(await cmsService.getPage(CMS_PAGES.HOME));
      } catch (err) {
        setError(err.message || 'Не удалось загрузить страницу');
        setPage(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const setHero = (key, value) =>
    setPage((p) => ({ ...p, hero: { ...p.hero, [key]: value } }));

  const setBlock = (blockKey, patch) =>
    setPage((p) => ({
      ...p,
      blocks: { ...p.blocks, [blockKey]: { ...p.blocks[blockKey], ...patch } },
    }));

  const save = async () => {
    if (!page || !user?.id) return;
    setSaving(true);
    setError('');
    try {
      await cmsService.savePage(user.id, CMS_PAGES.HOME, page);
      setMessage('Главная страница сохранена');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLoading />;

  if (!page) {
    return (
      <>
        <AdminPageHead title="Контент: Главная" subtitle="Hero, секции и CTA главной страницы" />
        <AdminAlert type="error">{error || 'Не удалось загрузить данные'}</AdminAlert>
      </>
    );
  }

  return (
    <>
      <AdminPageHead title="Контент: Главная" subtitle="Hero, секции и CTA главной страницы" />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      <section className="admin-panel">
        <h3>Hero</h3>
        <AdminField label="Заголовок">
          <input className="admin-input" value={page.hero.title} onChange={(e) => setHero('title', e.target.value)} />
        </AdminField>
        <AdminField label="Описание (пусто = авто со статистикой)">
          <textarea className="admin-textarea" rows={2} value={page.hero.description} onChange={(e) => setHero('description', e.target.value)} />
        </AdminField>
        <ImageUploadField
          label="Изображение Hero"
          value={page.hero.image}
          onChange={(url) => setHero('image', url)}
          bucket={uploadService.buckets.site}
        />
        <div className="admin-grid-2">
          <AdminField label="CTA 1">
            <input className="admin-input" value={page.hero.ctaPrimary?.label} onChange={(e) => setHero('ctaPrimary', { ...page.hero.ctaPrimary, label: e.target.value })} />
          </AdminField>
          <AdminField label="URL CTA 1">
            <input className="admin-input" value={page.hero.ctaPrimary?.url} onChange={(e) => setHero('ctaPrimary', { ...page.hero.ctaPrimary, url: e.target.value })} />
          </AdminField>
        </div>
        <BlockToggle label="Показывать статистику водоёмов" checked={page.hero.showStats} onChange={(v) => setHero('showStats', v)} />
      </section>

      <section className="admin-panel">
        <h3>Секции</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <BlockToggle label="Навигационная полоса" checked={page.blocks.navStrip?.enabled} onChange={(v) => setBlock('navStrip', { enabled: v })} />
          <BlockToggle label="Блок водоёмов" checked={page.blocks.watersSection?.enabled} onChange={(v) => setBlock('watersSection', { enabled: v })} />
          <BlockToggle label="Новости" checked={page.blocks.newsSection?.enabled} onChange={(v) => setBlock('newsSection', { enabled: v })} />
          <BlockToggle label="CTA внизу" checked={page.blocks.cta?.enabled} onChange={(v) => setBlock('cta', { enabled: v })} />
        </div>
        <AdminField label="CTA заголовок">
          <input className="admin-input" value={page.blocks.cta?.title || ''} onChange={(e) => setBlock('cta', { title: e.target.value })} />
        </AdminField>
        <AdminField label="CTA описание">
          <textarea className="admin-textarea" rows={2} value={page.blocks.cta?.description || ''} onChange={(e) => setBlock('cta', { description: e.target.value })} />
        </AdminField>
      </section>

      <div className="admin-toolbar">
        <button type="button" className="admin-btn admin-btn--primary" disabled={saving} onClick={save}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
        <a href="/" target="_blank" rel="noreferrer" className="admin-btn">
          Предпросмотр
        </a>
      </div>
    </>
  );
}
