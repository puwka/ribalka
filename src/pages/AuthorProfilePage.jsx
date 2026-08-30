import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { localAuthStore } from '../lib/localAuthStore';
import { reportSocialService } from '../services/reportSocialService';
import { forumService } from '../services/forumService';
import { gamificationService } from '../services/gamificationService';
import './AuthorProfilePage.css';

function roleLabel(role) {
  if (role === 'admin') return 'Администратор';
  if (role === 'owner') return 'Владелец базы';
  return 'Рыболов';
}

function formatJoined(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
  });
}

export default function AuthorProfilePage() {
  const { userId } = useParams();
  const [profile, setProfile] = useState(null);
  const [reports, setReports] = useState([]);
  const [topics, setTopics] = useState([]);
  const [progress, setProgress] = useState(null);
  const [showAllBadges, setShowAllBadges] = useState(false);

  useEffect(() => {
    setProfile(localAuthStore.getPublicProfile(userId));
    reportSocialService.listByAuthor(userId).then(setReports).catch(() => setReports([]));
    forumService.listByAuthor(userId).then(setTopics).catch(() => setTopics([]));
    gamificationService.getProgress(userId).then(setProgress).catch(() => setProgress(null));
  }, [userId]);

  if (!profile) {
    return (
      <div className="author-page">
        <div className="author-page__inner">
          <p className="author-empty">Профиль не найден или скрыт</p>
          <Link to="/forum" className="btn btn--secondary">
            На форум
          </Link>
        </div>
      </div>
    );
  }

  const isPrivate = profile.is_public === false;
  const badges = progress?.badges || [];
  const visibleBadges = showAllBadges ? badges : badges.slice(0, 6);
  const joined = formatJoined(profile.created_at);

  return (
    <div className="author-page">
      <div className="author-page__inner">
        <header className="author-head">
          <div className="author-head__avatar" aria-hidden>
            {(profile.display_name || '?').charAt(0).toUpperCase()}
          </div>
          <div className="author-head__main">
            <p className="author-head__role">{roleLabel(profile.primary_role)}</p>
            <h1>{profile.display_name}</h1>
            <p className="author-head__meta">
              {[
                isPrivate ? 'Профиль ограничен' : profile.city,
                joined ? `на сайте с ${joined}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {!isPrivate && profile.bio ? <p className="author-head__bio">{profile.bio}</p> : null}
          </div>
        </header>

        {!isPrivate && progress && (
          <section className="author-stats" aria-label="Статистика">
            <div>
              <span className="author-stats__value">{progress.ratingPoints}</span>
              <span className="author-stats__label">Рейтинг</span>
            </div>
            <div>
              <span className="author-stats__value">
                {progress.unlockedCount}/{progress.totalCount}
              </span>
              <span className="author-stats__label">Достижения</span>
            </div>
            <div>
              <span className="author-stats__value">{progress.stats?.reports_count || reports.length}</span>
              <span className="author-stats__label">Отчёты</span>
            </div>
            <div>
              <span className="author-stats__value">
                {progress.stats?.places_visited_count || 0}
              </span>
              <span className="author-stats__label">Места</span>
            </div>
          </section>
        )}

        {!isPrivate && badges.length > 0 && (
          <section className="author-block">
            <div className="author-block__head">
              <h2>Достижения</h2>
              {badges.length > 6 && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => setShowAllBadges((v) => !v)}
                >
                  {showAllBadges ? 'Свернуть' : 'Показать все'}
                </button>
              )}
            </div>
            <ul className="author-badges">
              {visibleBadges.map((b) => (
                <li key={b.code}>
                  <strong>{b.name}</strong>
                  {b.earned_at && (
                    <span>{new Date(b.earned_at).toLocaleDateString('ru-RU')}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="author-block">
          <div className="author-block__head">
            <h2>Отчёты</h2>
            <span className="author-block__count">{reports.length}</span>
          </div>
          {reports.length === 0 ? (
            <p className="author-empty">Пока нет отчётов</p>
          ) : (
            <ul className="author-feed">
              {reports.map((r) => (
                <li key={r.id}>
                  <Link to={`/reports/${r.id}`}>
                    <span className="author-feed__title">{r.place || 'Отчёт'}</span>
                    <span className="author-feed__meta">
                      {[r.fish, r.date].filter(Boolean).join(' · ')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="author-block">
          <div className="author-block__head">
            <h2>Темы форума</h2>
            <span className="author-block__count">{topics.length}</span>
          </div>
          {topics.length === 0 ? (
            <p className="author-empty">Пока нет тем</p>
          ) : (
            <ul className="author-feed">
              {topics.map((t) => (
                <li key={t.id}>
                  <Link to={`/forum/${t.id}`}>
                    <span className="author-feed__title">{t.title}</span>
                    <span className="author-feed__meta">Форум</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
