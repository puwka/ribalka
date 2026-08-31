import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useSmartNavigation } from '../../hooks/useSmartNavigation';
import { useAuth } from '../auth/AuthContext';
import SearchBar from '../SearchBar/SearchBar';
import NotificationCenter from '../notifications/NotificationCenter';
import Logo from '../Logo/Logo';
import './Header.css';

/** Быстрые ссылки в шапке (desktop) */
const DESKTOP_NAV = [
  { to: '/paid-waters', label: 'Платные' },
  { to: '/free-waters', label: 'Бесплатные' },
  { to: '/map', label: 'Карта' },
  { to: '/reports', label: 'Отчёты' },
  { to: '/forum', label: 'Форум' },
  { to: '/directory', label: 'Справочник' },
];

/** Основные разделы — в бургере на мобиле (на desktop уже в шапке) */
const DRAWER_PRIMARY = [
  { href: '/paid-waters', label: 'Платные водоёмы' },
  { href: '/free-waters', label: 'Бесплатные водоёмы' },
  { href: '/map', label: 'Карта' },
  { href: '/reports', label: 'Отчёты о рыбалке' },
  { href: '/forum', label: 'Форум' },
  { href: '/directory', label: 'Справочник' },
];

/** Остальные пункты — всегда в бургере */
const DRAWER_MORE = [
  { href: '/lunar', label: 'Лунный календарь' },
  { href: '/news/all', label: 'Новости' },
  { href: '/about', label: 'О нас' },
];

function IconStar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2l2.9 6.9L22 10.2l-5.2 4.5L18.2 22 12 18.3 5.8 22l1.4-7.3L2 10.2l7.1-1.3L12 2z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { handleClick } = useSmartNavigation();
  const { isAuthenticated, loading, profile, isOwner, isAdmin, logout } = useAuth();

  useEffect(() => {
    document.body.style.overflow = isMenuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMenuOpen]);

  const closeMenu = () => setIsMenuOpen(false);

  const onNavClick = (e, target) => {
    closeMenu();
    handleClick(e, target);
  };

  return (
    <header className="site-header">
      <div className="site-header__bar section-inner section-inner--wide">
        <Logo to="/" onClick={(e) => onNavClick(e, '/')} className="site-header__logo" />

        <nav className="site-header__nav" aria-label="Основная навигация">
          {DESKTOP_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `site-header__link${isActive ? ' is-active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="site-header__actions">
          <SearchBar />
          {isAuthenticated && <NotificationCenter />}

          {!loading && isAuthenticated && (
            <Link
              to="/cabinet/favorites"
              className="site-header__icon-btn"
              title="Избранное"
              aria-label="Избранное"
            >
              <IconStar />
            </Link>
          )}

          {!loading && isAuthenticated ? (
            <Link to="/cabinet" className="site-header__user" title="Кабинет">
              {profile?.display_name?.slice(0, 16) || 'Кабинет'}
            </Link>
          ) : !loading ? (
            <Link to="/login" className="btn btn--primary btn--sm site-header__login">
              Войти
            </Link>
          ) : null}

          <button
            type="button"
            className={`site-header__burger ${isMenuOpen ? 'is-open' : ''}`}
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-label={isMenuOpen ? 'Закрыть меню' : 'Ещё разделы'}
            aria-expanded={isMenuOpen}
            aria-controls="site-header-menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <button
          type="button"
          className="site-header__scrim"
          aria-label="Закрыть меню"
          onClick={closeMenu}
        />
      )}

      <nav
        id="site-header-menu"
        className={`site-header__drawer ${isMenuOpen ? 'is-open' : ''}`}
        aria-hidden={!isMenuOpen}
        aria-label="Дополнительное меню"
      >
        <div className="site-header__drawer-brand">
          <Logo to="/" onClick={closeMenu} />
          <p className="site-header__drawer-title">Меню</p>
        </div>

        <Link
          to="/"
          className="site-header__drawer-item site-header__drawer-item--home"
          onClick={closeMenu}
        >
          Главная
        </Link>

        {DRAWER_PRIMARY.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="site-header__drawer-item site-header__drawer-item--primary"
            onClick={closeMenu}
          >
            {item.label}
          </Link>
        ))}

        <p className="site-header__drawer-label site-header__drawer-label--more">Ещё</p>

        {DRAWER_MORE.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className="site-header__drawer-item"
            onClick={closeMenu}
          >
            {item.label}
          </Link>
        ))}

        <div className="site-header__drawer-auth">
          {loading ? null : isAuthenticated ? (
            <>
              <Link to="/cabinet/favorites" onClick={closeMenu}>
                Избранное
              </Link>
              <Link to="/cabinet" onClick={closeMenu}>
                Кабинет
              </Link>
              {isOwner && (
                <Link to="/owner" onClick={closeMenu}>
                  Кабинет владельца
                </Link>
              )}
              {isAdmin && (
                <Link to="/admin" onClick={closeMenu}>
                  Админ-панель
                </Link>
              )}
              <button
                type="button"
                className="site-header__logout"
                onClick={async () => {
                  closeMenu();
                  await logout();
                }}
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link to="/register" onClick={closeMenu}>
                Регистрация
              </Link>
              <Link to="/login" className="is-primary" onClick={closeMenu}>
                Войти
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
