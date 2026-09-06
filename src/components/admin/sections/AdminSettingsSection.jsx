import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { authService } from '../../../services/authService';
import { cmsService } from '../../../services/cmsService';
import { AdminPageHead, AdminAlert, AdminField, AdminLoading } from '../AdminUI';
import { ImageUploadField } from '../../media/ImageUpload';
import { uploadService } from '../../../services/uploadService';

export default function AdminSettingsSection() {
  const { user } = useAuth();
  const [settings, setSettings] = useState(null);
  const [footer, setFooter] = useState(null);
  const [tab, setTab] = useState('site');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [s, f] = await Promise.all([cmsService.getSettings(), cmsService.getFooter()]);
        setSettings(s);
        setFooter(f);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await cmsService.saveSettings(user.id, settings);
      await cmsService.saveFooter(user.id, footer);
      setMessage('Настройки сохранены');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading || !settings || !footer) return <AdminLoading />;

  return (
    <>
      <AdminPageHead title="Настройки" subtitle="Сайт, контакты, footer и система" />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      <div className="admin-toolbar">
        <button type="button" className={`admin-btn ${tab === 'site' ? 'admin-btn--primary' : ''}`} onClick={() => setTab('site')}>Сайт</button>
        <button type="button" className={`admin-btn ${tab === 'footer' ? 'admin-btn--primary' : ''}`} onClick={() => setTab('footer')}>Footer</button>
        <button type="button" className={`admin-btn ${tab === 'system' ? 'admin-btn--primary' : ''}`} onClick={() => setTab('system')}>Система</button>
      </div>

      {tab === 'site' && (
        <section className="admin-panel">
          <AdminField label="Название сайта">
            <input className="admin-input" value={settings.siteName} onChange={(e) => setSettings((s) => ({ ...s, siteName: e.target.value }))} />
          </AdminField>
          <AdminField label="Слоган">
            <textarea className="admin-textarea" rows={2} value={settings.tagline} onChange={(e) => setSettings((s) => ({ ...s, tagline: e.target.value }))} />
          </AdminField>
          <div className="admin-grid-2">
            <ImageUploadField
              label="Логотип"
              value={settings.logoUrl}
              onChange={(url) => setSettings((s) => ({ ...s, logoUrl: url }))}
              bucket={uploadService.buckets.site}
            />
            <ImageUploadField
              label="Favicon"
              value={settings.faviconUrl}
              onChange={(url) => setSettings((s) => ({ ...s, faviconUrl: url }))}
              bucket={uploadService.buckets.site}
              hint="Квадратное изображение, 32–512 px"
            />
          </div>
          <div className="admin-grid-2">
            <AdminField label="Email">
              <input className="admin-input" value={settings.contactEmail} onChange={(e) => setSettings((s) => ({ ...s, contactEmail: e.target.value }))} />
            </AdminField>
            <AdminField label="Телефон">
              <input className="admin-input" value={settings.contactPhone} onChange={(e) => setSettings((s) => ({ ...s, contactPhone: e.target.value }))} />
            </AdminField>
          </div>
          <div className="admin-grid-2">
            <AdminField label="ОГРНИП">
              <input className="admin-input" value={settings.legalOgrnip} onChange={(e) => setSettings((s) => ({ ...s, legalOgrnip: e.target.value }))} />
            </AdminField>
            <AdminField label="ИНН">
              <input className="admin-input" value={settings.legalInn} onChange={(e) => setSettings((s) => ({ ...s, legalInn: e.target.value }))} />
            </AdminField>
          </div>
          <AdminField label="Cookie текст">
            <textarea className="admin-textarea" rows={2} value={settings.cookieText} onChange={(e) => setSettings((s) => ({ ...s, cookieText: e.target.value }))} />
          </AdminField>
        </section>
      )}

      {tab === 'footer' && (
        <section className="admin-panel">
          <AdminField label="Текст бренда">
            <textarea className="admin-textarea" rows={3} value={footer.brandText} onChange={(e) => setFooter((f) => ({ ...f, brandText: e.target.value }))} />
          </AdminField>
          <label className="admin-check">
            <input type="checkbox" checked={footer.showSponsors} onChange={(e) => setFooter((f) => ({ ...f, showSponsors: e.target.checked }))} />
            Показывать спонсоров
          </label>
          <label className="admin-check">
            <input type="checkbox" checked={footer.showSocial} onChange={(e) => setFooter((f) => ({ ...f, showSocial: e.target.checked }))} />
            Показывать соцсети
          </label>
          <AdminField label="VK URL">
            <input className="admin-input" value={settings.social?.vk || ''} onChange={(e) => setSettings((s) => ({ ...s, social: { ...s.social, vk: e.target.value } }))} />
          </AdminField>
          <AdminField label="Telegram URL">
            <input className="admin-input" value={settings.social?.telegram || ''} onChange={(e) => setSettings((s) => ({ ...s, social: { ...s.social, telegram: e.target.value } }))} />
          </AdminField>
        </section>
      )}

      {tab === 'system' && (
        <section className="admin-panel">
          <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
            Режим данных: <strong>{authService.mode()}</strong>
          </p>
          <ul style={{ fontSize: '0.875rem', lineHeight: 1.7, paddingLeft: 18 }}>
            <li>ENV: см. <code>.env.example</code></li>
            <li>Миграции: <code>database/migrations/</code></li>
            <li>CMS: настройки и страницы синхронизируются через API (`cms_kv`)</li>
          </ul>
        </section>
      )}

      {tab !== 'system' && (
        <button type="button" className="admin-btn admin-btn--primary" disabled={saving} onClick={save}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      )}
    </>
  );
}
