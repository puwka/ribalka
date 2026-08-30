import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
import { getAnonId } from '../hooks/useReports';
import { forumService } from '../services/forumService';
import { basesService } from '../services/basesService';
import './ForumPage.css';

export default function ForumPage() {
  const { user, profile, isAuthenticated } = useAuth();
  const viewerKey = user?.id || `anon:${getAnonId()}`;
  const [topics, setTopics] = useState([]);
  const [bases, setBases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    body: '',
    baseId: '',
    placeLabel: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTopics(await forumService.listTopics({ status: 'approved', viewerKey }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [viewerKey]);

  useEffect(() => {
    load();
    basesService.listPublic().then(setBases).catch(() => setBases([]));
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isAuthenticated || !user) {
      setError('Войдите, чтобы создать тему');
      return;
    }
    try {
      const base = bases.find((b) => String(b.id) === String(form.baseId));
      await forumService.createTopic({
        title: form.title,
        body: form.body,
        authorId: user.id,
        authorName: profile?.display_name || user.email,
        baseId: base?.id || null,
        baseName: base?.name || null,
        placeLabel: form.placeLabel || base?.name || '',
      });
      setForm({ title: '', body: '', baseId: '', placeLabel: '' });
      setShowForm(false);
      alert('Тема отправлена на модерацию');
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  const like = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await forumService.likeTopic(id, { userId: user?.id, anonId: getAnonId() });
      await load();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="forum-page">
      <header className="forum-hero">
        <h1>Форум рыболовов</h1>
        <p>Темы, ответы и обсуждения мест Прикамья</p>
        <button type="button" className="forum-btn" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Закрыть' : 'Новая тема'}
        </button>
      </header>

      <div className="forum-wrap">
        {error && <div className="forum-error">{error}</div>}

        {showForm && (
          <form className="forum-form" onSubmit={submit}>
            <h2>Создать тему</h2>
            <p className="forum-muted">Тема появится после проверки администратором.</p>
            <label>
              Заголовок *
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <label>
              Текст *
              <textarea
                required
                rows={5}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </label>
            <label>
              База / место
              <select
                value={form.baseId}
                onChange={(e) => setForm({ ...form, baseId: e.target.value })}
              >
                <option value="">Без привязки</option>
                {bases.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.type === 'free' ? 'место' : 'база'})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Подпись места
              <input
                value={form.placeLabel}
                onChange={(e) => setForm({ ...form, placeLabel: e.target.value })}
                placeholder="Например: Чусовая у Коуровки"
              />
            </label>
            <button type="submit" className="forum-btn">
              Отправить
            </button>
          </form>
        )}

        {loading ? (
          <p>Загрузка…</p>
        ) : topics.length === 0 ? (
          <div className="forum-empty">Пока нет тем — создайте первую</div>
        ) : (
          <ul className="forum-list">
            {topics.map((t) => (
              <li key={t.id}>
                <Link to={`/forum/${t.id}`} className="forum-item">
                  <div className="forum-item__main">
                    {t.pinned && <span className="forum-pin">Закреплено</span>}
                    <h3>{t.title}</h3>
                    <p>
                      {t.authorName}
                      {t.placeLabel || t.baseName
                        ? ` · ${t.placeLabel || t.baseName}`
                        : ''}
                    </p>
                  </div>
                  <div className="forum-item__side">
                    <button type="button" onClick={(e) => like(e, t.id)}>
                      {t.hasLiked ? '♥' : '♡'} {t.likes || 0}
                    </button>
                    <span>💬 {t.repliesCount || 0}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
