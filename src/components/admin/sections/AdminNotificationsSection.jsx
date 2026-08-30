import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { localAuthStore } from '../../../lib/localAuthStore';
import { notificationService } from '../../../services/notificationService';
import { auditService } from '../../../services/auditService';
import { AdminPageHead, AdminAlert, AdminField } from '../AdminUI';

const AUDIENCES = [
  { id: 'all', label: 'Все пользователи' },
  { id: 'owners', label: 'Владельцы баз' },
  { id: 'users', label: 'Рыболовы' },
];

export default function AdminNotificationsSection() {
  const { user, profile } = useAuth();
  const [form, setForm] = useState({ title: '', body: '', link: '/', audience: 'all' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!form.title.trim() || !form.body.trim()) {
      setError('Заполните название и текст');
      return;
    }
    setSending(true);
    setError('');
    try {
      const users = localAuthStore.listUsersForAdmin();
      const targets = users.filter((u) => {
        if (form.audience === 'owners') return u.primary_role === 'owner';
        if (form.audience === 'users') return u.primary_role === 'user';
        return true;
      });

      for (const u of targets) {
        notificationService.notify(u.id, {
          type: 'system',
          title: form.title.trim(),
          body: form.body.trim(),
          link_path: form.link || '/',
        });
      }

      await auditService.log({
        adminId: user.id,
        adminName: profile?.display_name,
        action: 'broadcast',
        entity: 'notification',
        summary: `Рассылка «${form.title}» → ${targets.length} получателей`,
      });

      setMessage(`Отправлено ${targets.length} пользователям`);
      setForm({ title: '', body: '', link: '/', audience: 'all' });
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <AdminPageHead title="Уведомления" subtitle="Системные уведомления пользователям" />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      <section className="admin-panel">
        <AdminField label="Название">
          <input className="admin-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        </AdminField>
        <AdminField label="Текст">
          <textarea className="admin-textarea" rows={4} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} />
        </AdminField>
        <AdminField label="Ссылка">
          <input className="admin-input" value={form.link} onChange={(e) => setForm((f) => ({ ...f, link: e.target.value }))} />
        </AdminField>
        <AdminField label="Аудитория">
          <select className="admin-select" value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))}>
            {AUDIENCES.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </AdminField>
        <button type="button" className="admin-btn admin-btn--primary" disabled={sending} onClick={send}>
          {sending ? 'Отправка…' : 'Отправить'}
        </button>
      </section>
    </>
  );
}
