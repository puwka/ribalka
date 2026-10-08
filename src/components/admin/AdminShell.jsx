import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ADMIN_BASE, adminPath } from '../../lib/adminPath';
import './AdminShell.css';

const NAV_GROUPS = [
  {
    title: 'Обзор',
    items: [
      { to: adminPath(), label: 'Dashboard', end: true },
      { to: adminPath('analytics'), label: 'Статистика' },
      { to: adminPath('moderation'), label: 'Модерация' },
      { to: adminPath('audit'), label: 'История' },
    ],
  },
  {
    title: 'Контент',
    items: [
      { to: adminPath('content/home'), label: 'Главная' },
      { to: adminPath('content/paid-waters'), label: 'Платные базы' },
      { to: adminPath('content/paid-fishing'), label: 'Платная рыбалка' },
      { to: adminPath('content/free-waters'), label: 'Бесплатные водоёмы' },
      { to: adminPath('content/directory'), label: 'Справочник' },
      { to: adminPath('news'), label: 'Новости' },
      { to: adminPath('waters'), label: 'Водоёмы' },
      { to: adminPath('bases'), label: 'Базы' },
      { to: adminPath('reports'), label: 'Отчёты' },
      { to: adminPath('egorych'), label: 'Егорыч' },
      { to: adminPath('media'), label: 'Медиа' },
    ],
  },
  {
    title: 'Пользователи',
    items: [
      { to: adminPath('users'), label: 'Пользователи' },
      { to: adminPath('reviews'), label: 'Отзывы' },
    ],
  },
  {
    title: 'Коммерция',
    items: [
      { to: adminPath('plans'), label: 'Тарифы' },
      { to: adminPath('payments'), label: 'Платежи' },
      { to: adminPath('contests'), label: 'Конкурсы' },
      { to: adminPath('donations'), label: 'Поддержка' },
      { to: adminPath('ads'), label: 'Реклама' },
    ],
  },
  {
    title: 'Система',
    items: [
      { to: adminPath('seo'), label: 'SEO' },
      { to: adminPath('settings'), label: 'Настройки' },
      { to: adminPath('districts'), label: 'Районы' },
    ],
  },
];

const BREADCRUMB = {
  [adminPath()]: 'Dashboard',
  [adminPath('analytics')]: 'Статистика',
  [adminPath('moderation')]: 'Модерация',
  [adminPath('audit')]: 'История',
  [adminPath('content/home')]: 'Главная',
  [adminPath('content/paid-waters')]: 'Платные базы',
  [adminPath('content/paid-fishing')]: 'Платная рыбалка',
  [adminPath('content/free-waters')]: 'Бесплатные водоёмы',
  [adminPath('content/directory')]: 'Справочник',
  [adminPath('news')]: 'Новости',
  [adminPath('waters')]: 'Водоёмы',
  [adminPath('bases')]: 'Базы',
  [adminPath('reports')]: 'Отчёты',
  [adminPath('egorych')]: 'Егорыч',
  [adminPath('forum')]: 'Егорыч',
  [adminPath('media')]: 'Медиа',
  [adminPath('users')]: 'Пользователи',
  [adminPath('reviews')]: 'Отзывы',
  [adminPath('plans')]: 'Тарифы',
  [adminPath('payments')]: 'Платежи',
  [adminPath('contests')]: 'Конкурсы',
  [adminPath('donations')]: 'Поддержка',
  [adminPath('ads')]: 'Реклама',
  [adminPath('seo')]: 'SEO',
  [adminPath('settings')]: 'Настройки',
  [adminPath('districts')]: 'Районы',
};

export default function AdminShell() {
  const { profile, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const flatLinks = NAV_GROUPS.flatMap((g) => g.items);
  const current =
    flatLinks.find((l) =>
      l.end ? location.pathname === l.to : location.pathname.startsWith(l.to)
    ) || flatLinks[0];

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div className="admin-topbar__inner">
          <div className="admin-topbar__left">
            <Link to={ADMIN_BASE} className="admin-topbar__brand">
              Админка
            </Link>
            <span className="admin-topbar__crumb">/</span>
            <span className="admin-topbar__crumb admin-topbar__crumb--current">
              {BREADCRUMB[location.pathname] || 'Админка'}
            </span>
          </div>
          <div className="admin-topbar__right">
            <span className="admin-topbar__user">
              {profile?.display_name || user?.email}
            </span>
            <Link to="/" className="admin-topbar__link">
              На сайт
            </Link>
            <button type="button" className="admin-topbar__logout" onClick={() => logout()}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <div className="admin-shell__body">
        <aside className="admin-sidebar">
          <nav className="admin-sidebar__nav" aria-label="Админ-навигация">
            {NAV_GROUPS.map((group) => (
              <div key={group.title} className="admin-sidebar__group">
                <div className="admin-sidebar__group-title">{group.title}</div>
                {group.items.map((link) => (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    className={({ isActive }) =>
                      `admin-sidebar__link${isActive ? ' is-active' : ''}`
                    }
                  >
                    {link.label}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>

          <label className="admin-sidebar__mobile-select">
            <span className="visually-hidden">Раздел</span>
            <select
              value={current?.to || ADMIN_BASE}
              onChange={(e) => navigate(e.target.value)}
            >
              {NAV_GROUPS.map((group) => (
                <optgroup key={group.title} label={group.title}>
                  {group.items.map((link) => (
                    <option key={link.to} value={link.to}>
                      {link.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
        </aside>

        <main className="admin-main" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
