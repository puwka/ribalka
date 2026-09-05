import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { localAuthStore } from '../../../lib/localAuthStore';
import { api, apiDataEnabled } from '../../../lib/apiClient';
import {
  AdminPageHead,
  AdminAlert,
  AdminLoading,
  AdminStatus,
  AdminTable,
} from '../AdminUI';

async function listUsersForAdmin() {
  if (apiDataEnabled) {
    return api.get('/api/users');
  }
  return localAuthStore.listUsersForAdmin();
}

async function setUserStatusAdmin(adminId, targetId, status) {
  if (apiDataEnabled) {
    return api.patch(`/api/users/${encodeURIComponent(targetId)}/status`, { status });
  }
  localAuthStore.setUserStatus(adminId, targetId, status);
}

export default function AdminUsersSection() {
  const { user, profile } = useAuth();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await listUsersForAdmin());
    } catch (err) {
      setError(err.message);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setStatus = async (targetId, status) => {
    setError('');
    setMessage('');
    try {
      await setUserStatusAdmin(user.id, targetId, status);
      setMessage(`Статус обновлён: ${status}`);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const filtered = users.filter((u) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q) ||
      u.primary_role?.toLowerCase().includes(q)
    );
  });

  if (loading) return <AdminLoading />;

  return (
    <>
      <AdminPageHead title="Пользователи" subtitle="Управление аккаунтами и статусами" />
      <AdminAlert type="error">{error}</AdminAlert>
      <AdminAlert type="success">{message}</AdminAlert>

      <section className="admin-panel">
        <div className="admin-toolbar">
          <input
            className="admin-input"
            style={{ maxWidth: 280 }}
            placeholder="Поиск по email, имени, роли…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <AdminTable
          emptyText="Пользователи не найдены"
          columns={[
            { key: 'name', label: 'Имя', render: (u) => u.display_name || '—' },
            { key: 'email', label: 'Email' },
            {
              key: 'role',
              label: 'Роль',
              render: (u) => <AdminStatus status={u.primary_role}>{u.primary_role}</AdminStatus>,
            },
            {
              key: 'status',
              label: 'Статус',
              render: (u) => <AdminStatus status={u.status}>{u.status}</AdminStatus>,
            },
            {
              key: 'created',
              label: 'Регистрация',
              render: (u) =>
                u.created_at ? new Date(u.created_at).toLocaleDateString('ru-RU') : '—',
            },
            {
              key: 'actions',
              label: 'Действия',
              render: (u) => (
                <div className="admin-table__actions">
                  <Link to={`/u/${u.id}`} className="admin-btn admin-btn--sm">
                    Профиль
                  </Link>
                  {u.status === 'active' ? (
                    <button
                      type="button"
                      className="admin-btn admin-btn--sm admin-btn--danger"
                      disabled={u.id === user.id}
                      onClick={() => setStatus(u.id, 'blocked')}
                    >
                      Блок
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-btn admin-btn--sm admin-btn--primary"
                      onClick={() => setStatus(u.id, 'active')}
                    >
                      Разблок
                    </button>
                  )}
                </div>
              ),
            },
          ]}
          rows={filtered.map((u) => ({ ...u, _key: u.id }))}
        />
      </section>
    </>
  );
}
