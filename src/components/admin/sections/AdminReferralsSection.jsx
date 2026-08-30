import { useEffect, useState } from 'react';
import { localAuthStore } from '../../../lib/localAuthStore';
import { supabase, supabaseDataEnabled } from '../../../lib/supabase';
import { unwrap } from '../../../lib/apiError';
import { AdminPageHead, AdminLoading, AdminTable } from '../AdminUI';

async function listReferrals() {
  if (supabaseDataEnabled && supabase) {
    const users = unwrap(
      await supabase
        .from('users')
        .select('id, email, referral_code, referred_by, created_at')
        .order('created_at', { ascending: false })
        .limit(200)
    );
    return users || [];
  }
  return localAuthStore.listUsersForAdmin();
}

export default function AdminReferralsSection() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setUsers(await listReferrals());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const referrers = users.filter((u) => u.referral_code);
  const invited = users.filter((u) => u.referred_by);

  const filtered = referrers.filter((u) => {
    if (!q) return true;
    const needle = q.toLowerCase();
    return u.email?.toLowerCase().includes(needle) || u.referral_code?.toLowerCase().includes(needle);
  });

  if (loading) return <AdminLoading />;

  return (
    <>
      <AdminPageHead title="Партнёрка" subtitle="Рефералы и приглашённые пользователи" />

      <div className="admin-metrics">
        <div className="admin-metric">
          <div className="admin-metric__label">Рефереров</div>
          <div className="admin-metric__value">{referrers.length}</div>
        </div>
        <div className="admin-metric">
          <div className="admin-metric__label">Приглашённых</div>
          <div className="admin-metric__value">{invited.length}</div>
        </div>
      </div>

      <section className="admin-panel">
        <input
          className="admin-input"
          style={{ maxWidth: 280, marginBottom: 12 }}
          placeholder="Поиск…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <AdminTable
          columns={[
            { key: 'email', label: 'Email' },
            { key: 'code', label: 'Код', render: (u) => u.referral_code },
            {
              key: 'invited',
              label: 'Приглашено',
              render: (u) => users.filter((x) => x.referred_by === u.id).length,
            },
            {
              key: 'created',
              label: 'Регистрация',
              render: (u) => (u.created_at ? new Date(u.created_at).toLocaleDateString('ru-RU') : '—'),
            },
          ]}
          rows={filtered.map((u) => ({ ...u, _key: u.id }))}
        />
      </section>
    </>
  );
}
