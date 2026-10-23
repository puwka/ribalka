import { NavLink, Outlet, Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './CabinetShell.css';

function initials(name, email) {
  const source = (name || email || '?').trim();
  return source.charAt(0).toUpperCase();
}

function roleLabel(role) {
  if (role === 'admin') return 'Админ';
  if (role === 'owner') return 'Владелец';
  return 'Рыболов';
}

export default function CabinetShell({ title, subtitle, navGroups }) {
  const { profile, user, logout, roles } = useAuth();

  const onLogout = async () => {
    await logout();
  };

  return (
    <div className="cabinet">
      <div className="cabinet__container">
        <aside className="cabinet__aside">
          <div className="cabinet__identity">
            <div className="cabinet__avatar" aria-hidden>
              {profile?.avatar_path || profile?.avatar_url ? (
                <img src={profile.avatar_path || profile.avatar_url} alt="" />
              ) : (
                initials(profile?.display_name, user?.email)
              )}
            </div>
            <div className="cabinet__identity-text">
              <div className="cabinet__name">{profile?.display_name || 'Пользователь'}</div>
              <div className="cabinet__email">{user?.email}</div>
              {roles?.length > 0 && (
                <div className="cabinet__roles">
                  {roles.map((r) => (
                    <span key={r} className={`role-chip role-chip--${r}`}>
                      {roleLabel(r)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <nav className="cabinet__nav" aria-label="Навигация кабинета">
            {navGroups.map((group) => (
              <div key={group.title} className="cabinet__nav-group">
                <div className="cabinet__nav-group-title">{group.title}</div>
                {group.items.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      `cabinet__nav-link${isActive ? ' is-active' : ''}`
                    }
                  >
                    {link.label}
                    {link.badge != null && link.badge > 0 ? (
                      <span className="cabinet__nav-badge">{link.badge}</span>
                    ) : null}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <div className="cabinet__aside-actions">
            <Link to="/" className="cabinet__ghost-btn">
              На сайт
            </Link>
            <button type="button" className="cabinet__danger-btn" onClick={onLogout}>
              Выйти
            </button>
          </div>
        </aside>

        <section className="cabinet__main">
          <header className="cabinet__header">
            <div>
              <h1>{title}</h1>
              {subtitle ? <p className="cabinet__subtitle">{subtitle}</p> : null}
            </div>
          </header>

          <nav className="cabinet__mobile-links" aria-label="Навигация кабинета">
            <div className="cabinet__mobile-user">
              <div className="cabinet__avatar" aria-hidden>
                {profile?.avatar_path || profile?.avatar_url ? (
                  <img src={profile.avatar_path || profile.avatar_url} alt="" />
                ) : (
                  initials(profile?.display_name, user?.email)
                )}
              </div>
              <div className="cabinet__mobile-user-text">
                <strong>{profile?.display_name || 'Пользователь'}</strong>
                <span>{user?.email}</span>
              </div>
              <button type="button" className="cabinet__mobile-logout" onClick={onLogout}>
                Выйти
              </button>
            </div>

            {navGroups.map((group) => (
              <div key={group.title} className="cabinet__mobile-group">
                <div className="cabinet__mobile-group-title">{group.title}</div>
                <div className="cabinet__mobile-group-links">
                  {group.items.map((link) => (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      end={link.end}
                      className={({ isActive }) =>
                        `cabinet__mobile-link${isActive ? ' is-active' : ''}`
                      }
                    >
                      {link.label}
                      {link.badge != null && link.badge > 0 ? (
                        <span className="cabinet__nav-badge">{link.badge}</span>
                      ) : null}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}

            <Link to="/" className="cabinet__mobile-site-link">
              ← Вернуться на сайт
            </Link>
          </nav>

          <div className="cabinet__content">
            <Outlet />
          </div>
        </section>
      </div>
    </div>
  );
}
