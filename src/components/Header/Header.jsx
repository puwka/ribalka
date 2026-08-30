import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useSmartNavigation } from '../../hooks/useSmartNavigation';
import { useAuth } from '../auth/AuthContext';
import SearchBar from '../SearchBar/SearchBar';
import NotificationCenter from '../notifications/NotificationCenter';
import './Header.css';

const SITE_NAME = 'Рыбалка в Прикамье';

const MENU_ITEMS = [
  { href: '/', label: 'Главная', route: true },
  { href: '/paid-waters', label: 'Платные водоёмы', route: true },
  { href: '/free-waters', label: 'Бесплатные водоёмы', route: true },
  { href: '/map', label: 'Карта', route: true },
  { href: '/calendar', label: 'Календарь рыболова', route: true },
  { href: '/lunar', label: 'Лунный календарь', route: true },
  { href: '/directory', label: 'Справочник', route: true },
  { href: '/reports', label: 'Отчёты о рыбалке', route: true },
  { href: '/forum', label: 'Форум', route: true },
  { href: '#news', label: 'Новости', route: false },
  { href: '/about', label: 'О нас', route: true },
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
  const {
    isAuthenticated,
    loading,
    profile,
    isOwner,
    isAdmin,
    logout,
  } = useAuth();

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
      <div className="site-header__bar section-inner">
        <a href="/" className="site-header__brand" onClick={(e) => onNavClick(e, '/')}>
          <span className="site-header__brand-name">{SITE_NAME}</span>
        </a>

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
            <Link to="/login" className="btn btn--primary site-header__login">
              Войти
            </Link>
          ) : null}

          <button
            type="button"
            className={`site-header__burger ${isMenuOpen ? 'is-open' : ''}`}
            onClick={() => setIsMenuOpen((v) => !v)}
            aria-label={isMenuOpen ? 'Закрыть меню' : 'Открыть меню'}
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
        aria-label="Меню"
      >
        <div className="site-header__drawer-brand">
          <Link to="/" className="site-header__drawer-brand-name" onClick={closeMenu}>
            {SITE_NAME}
          </Link>
          <p className="site-header__drawer-title">Меню</p>
        </div>

        {MENU_ITEMS.map((item) =>
          item.route ? (
            <Link key={item.href + item.label} to={item.href} onClick={closeMenu}>
              {item.label}
            </Link>
          ) : (
            <a
              key={item.href + item.label}
              href={item.href}
              onClick={(e) => onNavClick(e, item.href)}
            >
              {item.label}
            </a>
          )
        )}

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
