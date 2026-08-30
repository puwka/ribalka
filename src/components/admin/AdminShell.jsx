import { NavLink, Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import './AdminShell.css';

const NAV_GROUPS = [
  {
    title: 'Обзор',
    items: [
      { to: '/admin', label: 'Dashboard', end: true },
      { to: '/admin/moderation', label: 'Модерация' },
      { to: '/admin/audit', label: 'История' },
    ],
  },
  {
    title: 'Контент',
    items: [
      { to: '/admin/content/home', label: 'Главная' },
      { to: '/admin/content/paid-waters', label: 'Платные водоёмы' },
      { to: '/admin/content/free-waters', label: 'Бесплатные водоёмы' },
      { to: '/admin/content/directory', label: 'Справочник' },
      { to: '/admin/news', label: 'Новости' },
      { to: '/admin/waters', label: 'Водоёмы' },
      { to: '/admin/bases', label: 'Базы' },
      { to: '/admin/reports', label: 'Отчёты' },
      { to: '/admin/forum', label: 'Форум' },
      { to: '/admin/media', label: 'Медиа' },
    ],
  },
  {
    title: 'Пользователи',
    items: [
      { to: '/admin/users', label: 'Пользователи' },
      { to: '/admin/reviews', label: 'Отзывы' },
    ],
  },
  {
    title: 'Коммерция',
    items: [
      { to: '/admin/plans', label: 'Тарифы' },
      { to: '/admin/payments', label: 'Платежи' },
      { to: '/admin/bookings', label: 'Бронирования' },
      { to: '/admin/ads', label: 'Реклама' },
      { to: '/admin/referrals', label: 'Партнёрка' },
    ],
  },
  {
    title: 'Система',
    items: [
      { to: '/admin/notifications', label: 'Уведомления' },
      { to: '/admin/seo', label: 'SEO' },
      { to: '/admin/settings', label: 'Настройки' },
    ],
  },
];

function breadcrumbLabel(pathname) {
  const map = {
    '/admin': 'Dashboard',
    '/admin/moderation': 'Модерация',
    '/admin/audit': 'История',
    '/admin/content/home': 'Главная',
    '/admin/content/paid-waters': 'Платные водоёмы',
    '/admin/content/free-waters': 'Бесплатные водоёмы',
    '/admin/content/directory': 'Справочник',
    '/admin/news': 'Новости',
    '/admin/waters': 'Водоёмы',
    '/admin/bases': 'Базы',
    '/admin/reports': 'Отчёты',
    '/admin/forum': 'Форум',
    '/admin/media': 'Медиа',
    '/admin/users': 'Пользователи',
    '/admin/reviews': 'Отзывы',
    '/admin/plans': 'Тарифы',
    '/admin/payments': 'Платежи',
    '/admin/bookings': 'Бронирования',
    '/admin/ads': 'Реклама',
    '/admin/referrals': 'Партнёрка',
    '/admin/notifications': 'Уведомления',
    '/admin/seo': 'SEO',
    '/admin/settings': 'Настройки',
  };
  return map[pathname] || 'Админка';
}

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
            <Link to="/admin" className="admin-topbar__brand">
              Админка
            </Link>
            <span className="admin-topbar__crumb">/</span>
            <span className="admin-topbar__crumb admin-topbar__crumb--current">
              {breadcrumbLabel(location.pathname)}
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
              value={current?.to || '/admin'}
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
