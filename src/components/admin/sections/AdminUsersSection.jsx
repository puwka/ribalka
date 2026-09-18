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

const ROLE_OPTIONS = [
  { value: 'user', label: 'Пользователь' },
  { value: 'owner', label: 'Владелец' },
  { value: 'admin', label: 'Админ' },
];

const ROLE_RU = {
  user: 'Пользователь',
  owner: 'Владелец',
  admin: 'Админ',
};

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

async function setUserRoleAdmin(adminId, targetId, role) {
  if (apiDataEnabled) {
    return api.patch(`/api/users/${encodeURIComponent(targetId)}/role`, { role });
  }
  localAuthStore.setUserRole(adminId, targetId, role);
}

export default function AdminUsersSection() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

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
    setBusyId(targetId);
    try {
      await setUserStatusAdmin(user.id, targetId, status);
      setMessage(`Статус обновлён: ${status}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const setRole = async (targetId, role) => {
    setError('');
    setMessage('');
    setBusyId(targetId);
    try {
      await setUserRoleAdmin(user.id, targetId, role);
      setMessage(`Роль обновлена: ${ROLE_RU[role] || role}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const filtered = users.filter((u) => {
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.display_name?.toLowerCase().includes(q) ||
      u.primary_role?.toLowerCase().includes(q) ||
      (ROLE_RU[u.primary_role] || '').toLowerCase().includes(q)
    );
  });

  if (loading) return <AdminLoading />;

  return (
    <>
      <AdminPageHead
        title="Пользователи"
        subtitle="Управление аккаунтами, ролями и статусами"
      />
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
              render: (u) => (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 140 }}>
                  <AdminStatus status={u.primary_role}>
                    {ROLE_RU[u.primary_role] || u.primary_role}
                  </AdminStatus>
                  <select
                    className="admin-input"
                    style={{ fontSize: '0.85rem', padding: '4px 8px' }}
                    value={u.primary_role || 'user'}
                    disabled={busyId === u.id}
                    title={
                      u.id === user.id
                        ? 'Свою роль admin снять нельзя'
                        : 'Сменить роль (нужен повторный вход у пользователя)'
                    }
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === u.primary_role) return;
                      if (
                        !window.confirm(
                          `Сменить роль «${u.display_name || u.email}» на «${ROLE_RU[next] || next}»?`
                        )
                      ) {
                        e.target.value = u.primary_role || 'user';
                        return;
                      }
                      setRole(u.id, next);
                    }}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option
                        key={opt.value}
                        value={opt.value}
                        disabled={u.id === user.id && opt.value !== 'admin'}
                      >
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              ),
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
                      disabled={u.id === user.id || busyId === u.id}
                      onClick={() => setStatus(u.id, 'blocked')}
                    >
                      Блок
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="admin-btn admin-btn--sm admin-btn--primary"
                      disabled={busyId === u.id}
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
        <p className="admin-field__hint" style={{ marginTop: 12 }}>
          После смены роли пользователю нужно выйти и войти снова, чтобы обновились права в
          кабинете.
        </p>
      </section>
    </>
  );
}
