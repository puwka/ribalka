import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, Route, Routes } from 'react-router-dom';
import CabinetShell from '../components/cabinet/CabinetShell';
import { RequireAuth } from '../components/auth/RequireAuth';
import { useAuth } from '../components/auth/AuthContext';
import { gamificationService } from '../services/gamificationService';
import { reportSocialService } from '../services/reportSocialService';
import UserBookingsPanel from '../components/cabinet/UserBookingsPanel';
import NotificationsPanel from '../components/notifications/NotificationsPanel';
import FavoritesPage from './FavoritesPage';
import '../components/auth/AuthShared.css';

function useUserNav() {
  const { notifications, isOwner, isAdmin } = useAuth();
  const unread = notifications.filter((n) => !n.is_read).length;

  return useMemo(() => {
    const groups = [
      {
        title: 'Основное',
        items: [
          { to: '/cabinet', end: true, label: 'Обзор' },
          { to: '/cabinet/profile', label: 'Профиль' },
          { to: '/cabinet/bookings', label: 'Бронирования' },
          { to: '/cabinet/favorites', label: 'Избранное' },
          { to: '/cabinet/reports', label: 'Отчёты' },
        ],
      },
      {
        title: 'Сообщество',
        items: [
          { to: '/cabinet/achievements', label: 'Достижения' },
          { to: '/cabinet/notifications', label: 'Уведомления', badge: unread },
        ],
      },
    ];

    if (isOwner || isAdmin) {
      groups.push({
        title: 'Управление',
        items: [
          ...(isOwner ? [{ to: '/owner', label: 'Кабинет владельца' }] : []),
          ...(isAdmin ? [{ to: '/admin', label: 'Админка' }] : []),
        ],
      });
    }

    return groups;
  }, [unread, isOwner, isAdmin]);
}

function Overview() {
  const { profile, notifications, user } = useAuth();
  const [progress, setProgress] = useState(null);
  const [reports, setReports] = useState([]);
  const unread = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    if (!user) return;
    gamificationService.getProgress(user.id).then(setProgress);
    reportSocialService
      .listByAuthor(user.id)
      .then((rows) => setReports((rows || []).slice(0, 5)))
      .catch(() => setReports([]));
  }, [user]);

  const recentReports = (reports || []).slice(0, 5);
  const recentBadges = (progress?.badges || []).slice(0, 4);

  return (
    <div className="cabinet-panel">
      <h2>Здравствуйте, {profile?.display_name || 'рыболов'}</h2>
      <p className="cabinet-panel__lead">
        Личный кабинет: избранное, отчёты, достижения и уведомления. Публичная страница —
        по ссылке профиля.
      </p>

      <div className="cabinet-metrics">
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Рейтинг</div>
          <div className="cabinet-metric__value">{progress?.ratingPoints ?? 0}</div>
          <div className="cabinet-metric__hint">очков</div>
        </div>
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Достижения</div>
          <div className="cabinet-metric__value">
            {progress ? `${progress.unlockedCount}/${progress.totalCount}` : '—'}
          </div>
        </div>
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Отчёты</div>
          <div className="cabinet-metric__value">{progress?.stats?.reports_count ?? recentReports.length}</div>
        </div>
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Уведомления</div>
          <div className="cabinet-metric__value">{unread}</div>
          <div className="cabinet-metric__hint">непрочитанных</div>
        </div>
      </div>

      <div className="cabinet-actions" style={{ marginTop: 0 }}>
        {user?.id && (
          <Link className="btn-secondary" to={`/u/${user.id}`}>
            Публичный профиль
          </Link>
        )}
        <Link className="btn-secondary" to="/cabinet/profile">
          Редактировать профиль
        </Link>
        <Link className="btn-primary" to="/reports">
          Написать отчёт
        </Link>
      </div>

      <section className="cabinet-section">
        <div className="cabinet-section__head">
          <h3>Последние отчёты</h3>
          <Link to="/reports" className="btn btn--ghost">
            Все отчёты
          </Link>
        </div>
        {recentReports.length === 0 ? (
          <p className="cabinet-panel__lead" style={{ marginBottom: 0 }}>
            Пока нет отчётов. Опубликуйте первый улов на странице отчётов.
          </p>
        ) : (
          <div className="cabinet-list">
            {recentReports.map((r) => (
              <div key={r.id} className="cabinet-row">
                <div>
                  <div className="cabinet-row__title">{r.place || 'Отчёт'}</div>
                  <div className="cabinet-row__meta">
                    {[r.fish, r.date].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <div className="cabinet-row__actions">
                  <Link className="btn-secondary" to={`/reports/${r.id}`}>
                    Открыть
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="cabinet-section">
        <div className="cabinet-section__head">
          <h3>Недавние достижения</h3>
          <Link to="/cabinet/achievements" className="btn btn--ghost">
            Все
          </Link>
        </div>
        {recentBadges.length === 0 ? (
          <p className="cabinet-panel__lead" style={{ marginBottom: 0 }}>
            Достижения появятся после активности на сайте.
          </p>
        ) : (
          <div className="cabinet-list">
            {recentBadges.map((b) => (
              <div key={b.code} className="cabinet-row">
                <div>
                  <div className="cabinet-row__title">{b.name}</div>
                  <div className="cabinet-row__meta">
                    {b.earned_at
                      ? `Получено ${new Date(b.earned_at).toLocaleDateString('ru-RU')}`
                      : 'Получено'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProfilePanel() {
  const { profile, user, updateProfile, refresh } = useAuth();
  const [form, setForm] = useState({
    display_name: '',
    bio: '',
    phone: '',
    city: '',
    is_public: true,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setForm({
      display_name: profile.display_name || '',
      bio: profile.bio || '',
      phone: profile.phone || '',
      city: profile.city || 'Пермь',
      is_public: profile.is_public !== false,
    });
  }, [profile]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    if (!form.display_name.trim()) nextErrors.display_name = 'Укажите имя';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setSaving(true);
    setError('');
    setMessage('');
    try {
      await updateProfile(form);
      await refresh();
      setMessage('Изменения сохранены');
    } catch (err) {
      setError(err.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="cabinet-panel">
      <h2>Настройки профиля</h2>
      <p className="cabinet-panel__lead">
        Эти данные видны на публичной странице, если профиль открыт.
      </p>

      <div className="cabinet-actions" style={{ marginTop: 0, marginBottom: 20 }}>
        {user?.id && (
          <Link className="btn-secondary" to={`/u/${user.id}`}>
            Смотреть публичный профиль
          </Link>
        )}
        <Link className="btn-secondary" to="/cabinet/notifications">
          Уведомления
        </Link>
      </div>

      <form className="cabinet-form" onSubmit={onSubmit} noValidate>
        <div className="cabinet-form__section" style={{ borderTop: 'none', paddingTop: 0, marginTop: 0 }}>
          <h3>Основное</h3>
          <label>
            Имя
            <input
              required
              value={form.display_name}
              onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
              aria-invalid={Boolean(fieldErrors.display_name)}
            />
            {fieldErrors.display_name && (
              <span className="cabinet-form__hint" style={{ color: 'var(--color-danger)' }}>
                {fieldErrors.display_name}
              </span>
            )}
          </label>
          <label>
            Город
            <input
              value={form.city}
              onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
            />
          </label>
          <label>
            Телефон
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <span className="cabinet-form__hint">Не публикуется без вашего согласия</span>
          </label>
          <label>
            О себе
            <textarea
              rows={4}
              value={form.bio}
              onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            />
          </label>
        </div>

        <div className="cabinet-form__section">
          <h3>Приватность</h3>
          <label>
            <span style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={form.is_public}
                onChange={(e) => setForm((f) => ({ ...f, is_public: e.target.checked }))}
              />
              Публичный профиль доступен другим пользователям
            </span>
          </label>
        </div>

        {error && <div className="auth-error">{error}</div>}
        {message && <div className="auth-success">{message}</div>}

        <button className="btn-primary" type="submit" disabled={saving}>
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </form>
    </div>
  );
}

function ReportsPanel() {
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        let rows = [];
        if (reportSocialService.listByAuthor) {
          rows = await reportSocialService.listByAuthor(user.id);
        } else {
          const all = await reportSocialService.list({});
          rows = (all || []).filter((r) => String(r.authorId) === String(user.id));
        }
        if (alive) setReports(rows || []);
      } catch {
        if (alive) setReports([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  return (
    <div className="cabinet-panel">
      <h2>Мои отчёты</h2>
      <p className="cabinet-panel__lead">Отчёты, которые вы опубликовали на сайте.</p>
      <div className="cabinet-actions" style={{ marginTop: 0 }}>
        <Link className="btn-primary" to="/reports">
          Создать отчёт
        </Link>
      </div>

      {loading ? (
        <div className="empty-state">Загрузка…</div>
      ) : reports.length === 0 ? (
        <div className="empty-state">Отчётов пока нет</div>
      ) : (
        <div className="cabinet-list" style={{ marginTop: 16 }}>
          {reports.map((r) => (
            <div key={r.id} className="cabinet-row">
              <div>
                <div className="cabinet-row__title">{r.place || 'Без названия'}</div>
                <div className="cabinet-row__meta">
                  {[r.fish, r.date, r.status].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="cabinet-row__actions">
                <Link className="btn-secondary" to={`/reports/${r.id}`}>
                  Открыть
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AchievementsPanel() {
  const { user, refresh } = useAuth();
  const [progress, setProgress] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!user) return;
    let alive = true;
    (async () => {
      setLoading(true);
      await gamificationService.recompute(user.id);
      const [p, board] = await Promise.all([
        gamificationService.getProgress(user.id),
        gamificationService.getLeaderboard(10),
      ]);
      if (!alive) return;
      setProgress(p);
      setLeaders(board);
      setLoading(false);
      await refresh();
    })();
    return () => {
      alive = false;
    };
  }, [user]);

  if (loading || !progress) {
    return <div className="cabinet-panel">Считаем прогресс…</div>;
  }

  const unlocked = progress.items.filter((a) => a.unlocked);
  const locked = progress.items.filter((a) => !a.unlocked);
  const visibleLocked = showAll ? locked : locked.slice(0, 4);

  return (
    <div className="cabinet-panel">
      <h2>Достижения</h2>
      <p className="cabinet-panel__lead">
        Рейтинг {progress.ratingPoints} очков · получено {progress.unlockedCount} из{' '}
        {progress.totalCount}
      </p>

      <div className="cabinet-metrics">
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Отчёты</div>
          <div className="cabinet-metric__value">{progress.stats.reports_count || 0}</div>
        </div>
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Комментарии</div>
          <div className="cabinet-metric__value">{progress.stats.comments_count || 0}</div>
        </div>
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Места</div>
          <div className="cabinet-metric__value">{progress.stats.places_visited_count || 0}</div>
        </div>
        <div className="cabinet-metric">
          <div className="cabinet-metric__label">Лайки</div>
          <div className="cabinet-metric__value">{progress.stats.likes_received || 0}</div>
        </div>
      </div>

      <section className="cabinet-section" style={{ marginTop: 8, paddingTop: 0, borderTop: 'none' }}>
        <div className="cabinet-section__head">
          <h3>Полученные</h3>
        </div>
        {unlocked.length === 0 ? (
          <p className="cabinet-panel__lead">Пока нет полученных достижений</p>
        ) : (
          <div className="ach-list">
            {unlocked.map((a) => (
              <div key={a.code} className="ach-item ach-item--unlocked">
                <div>
                  <div className="ach-item__name">{a.name}</div>
                  <div className="ach-item__desc">{a.description}</div>
                </div>
                <div className="ach-item__status">
                  {a.points} оч.
                  {a.earned_at
                    ? ` · ${new Date(a.earned_at).toLocaleDateString('ru-RU')}`
                    : ''}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="cabinet-section">
        <div className="cabinet-section__head">
          <h3>Впереди</h3>
        </div>
        <div className="ach-list">
          {visibleLocked.map((a) => (
            <div key={a.code} className="ach-item ach-item--locked">
              <div>
                <div className="ach-item__name">{a.name}</div>
                <div className="ach-item__desc">
                  {a.description}
                  <br />
                  Условие: {a.current}/{a.goal}
                </div>
                <div className="ach-progress" aria-hidden>
                  <div className="ach-progress__bar" style={{ width: `${a.progress}%` }} />
                </div>
              </div>
              <div className="ach-item__status">{a.points} оч.</div>
            </div>
          ))}
        </div>
        {locked.length > 4 && (
          <div className="cabinet-actions">
            <button type="button" className="btn-secondary" onClick={() => setShowAll((v) => !v)}>
              {showAll ? 'Свернуть' : `Показать все (${locked.length})`}
            </button>
          </div>
        )}
      </section>

      <section className="cabinet-section">
        <div className="cabinet-section__head">
          <h3>Рейтинг пользователей</h3>
        </div>
        <div className="cabinet-list">
          {leaders.length === 0 && (
            <div className="empty-state">Пока нет данных</div>
          )}
          {leaders.map((row, index) => (
            <div key={row.user_id} className="cabinet-row">
              <div>
                <div className="cabinet-row__title">
                  #{index + 1} {row.name}
                  {row.user_id === user.id ? ' · вы' : ''}
                </div>
                <div className="cabinet-row__meta">
                  {row.points} очков · отчёты {row.reports} · места {row.places}
                </div>
              </div>
              {row.user_id !== user.id && (
                <div className="cabinet-row__actions">
                  <Link className="btn-secondary" to={`/u/${row.user_id}`}>
                    Профиль
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function FavoritesEmbedded() {
  return <FavoritesPage embedded />;
}

function CabinetLayout() {
  const navGroups = useUserNav();
  return (
    <CabinetShell
      title="Личный кабинет"
      subtitle="Активность, избранное и настройки"
      navGroups={navGroups}
    />
  );
}

export default function UserCabinetPage() {
  return (
    <RequireAuth>
      <Routes>
        <Route element={<CabinetLayout />}>
          <Route index element={<Overview />} />
          <Route path="profile" element={<ProfilePanel />} />
          <Route path="bookings" element={<UserBookingsPanel />} />
          <Route path="favorites" element={<FavoritesEmbedded />} />
          <Route path="reports" element={<ReportsPanel />} />
          <Route path="achievements" element={<AchievementsPanel />} />
          <Route path="notifications" element={<NotificationsPanel />} />
          <Route path="*" element={<Navigate to="/cabinet" replace />} />
        </Route>
      </Routes>
    </RequireAuth>
  );
}
