import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
import { getAnonId } from '../hooks/useReports';
import { forumService } from '../services/forumService';
import './ForumPage.css';

function nestMessages(messages) {
  const roots = messages.filter((m) => !m.parentId);
  const kids = (pid) => messages.filter((m) => String(m.parentId) === String(pid));
  return roots.map((m) => ({
    ...m,
    replies: kids(m.id),
    comments: kids(m.id).filter((x) => x.kind === 'comment'),
  }));
}

export default function ForumTopicPage() {
  const { id } = useParams();
  const { user, profile, isAuthenticated, isAdmin, loading: authLoading } = useAuth();
  const viewerKey = user?.id || `anon:${getAnonId()}`;
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [kind, setKind] = useState('message');
  const [busy, setBusy] = useState(false);
  const [editingTopic, setEditingTopic] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editNotice, setEditNotice] = useState('');

  const load = useCallback(async () => {
    if (authLoading) return;
    setError('');
    try {
      setData(await forumService.getTopic(id, { viewerKey, isAdmin }));
    } catch (err) {
      setError(err.message);
      setData(null);
    }
  }, [id, viewerKey, isAdmin, authLoading]);

  useEffect(() => {
    load();
  }, [load]);

  const tree = useMemo(() => nestMessages(data?.messages || []), [data]);

  const isAuthor =
    user?.id && data?.topic?.authorId && String(data.topic.authorId) === String(user.id);
  const canEditTopic = isAuthor || isAdmin;

  const startEdit = () => {
    if (!data?.topic) return;
    setEditTitle(data.topic.title);
    setEditBody(data.topic.body);
    setEditingTopic(true);
    setEditNotice('');
  };

  const saveTopic = async (e) => {
    e.preventDefault();
    if (!canEditTopic) return;
    setBusy(true);
    setEditNotice('');
    try {
      await forumService.updateTopic(
        id,
        { title: editTitle, body: editBody },
        { authorId: user?.id, isAdmin }
      );
      setEditingTopic(false);
      if (!isAdmin) {
        setEditNotice('Тема сохранена и отправлена на модерацию');
      } else {
        setEditNotice('Тема сохранена');
      }
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!isAuthenticated || !user) {
      alert('Войдите, чтобы ответить');
      return;
    }
    setBusy(true);
    try {
      await forumService.addMessage({
        topicId: id,
        authorId: user.id,
        authorName: profile?.display_name || user.email,
        body,
        parentId: replyTo,
        kind: replyTo ? (kind === 'comment' ? 'comment' : 'reply') : 'message',
      });
      setBody('');
      setReplyTo(null);
      setKind('message');
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const likeTopic = async () => {
    await forumService.likeTopic(id, { userId: user?.id, anonId: getAnonId() });
    await load();
  };

  const likeMsg = async (messageId) => {
    await forumService.likeMessage(messageId, { userId: user?.id, anonId: getAnonId() });
    await load();
  };

  if (error) {
    return (
      <div className="forum-page">
        <div className="forum-wrap">
          <p>{error}</p>
          <Link to="/forum">← К форуму</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="forum-page">
        <div className="forum-wrap">Загрузка…</div>
      </div>
    );
  }

  const { topic } = data;

  return (
    <div className="forum-page">
      <div className="forum-wrap forum-topic">
        <Link to="/forum" className="forum-back">
          ← Форум
        </Link>

        {editNotice && <div className="forum-notice">{editNotice}</div>}

        <article className="forum-card">
          {topic.pinned && <span className="forum-pin">Закреплено</span>}
          {topic.locked && <span className="forum-pin">Закрыто</span>}
          {topic.status === 'pending' && <span className="forum-pin">На модерации</span>}

          {editingTopic ? (
            <form className="forum-form" onSubmit={saveTopic}>
              <label>
                Заголовок
                <input
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                />
              </label>
              <label>
                Текст
                <textarea
                  required
                  rows={6}
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
              </label>
              <div className="forum-actions">
                <button type="submit" className="forum-btn" disabled={busy}>
                  Сохранить
                </button>
                <button type="button" className="forum-btn forum-btn--ghost" onClick={() => setEditingTopic(false)}>
                  Отмена
                </button>
              </div>
              {!isAdmin && (
                <p className="forum-muted">После сохранения тема снова уйдёт на модерацию.</p>
              )}
            </form>
          ) : (
            <>
              <div className="forum-topic__head">
                <h1>{topic.title}</h1>
                {canEditTopic && (
                  <button type="button" className="forum-linkish" onClick={startEdit}>
                    Редактировать
                  </button>
                )}
              </div>
              <p className="forum-muted">
                <Link to={`/u/${topic.authorId}`}>{topic.authorName}</Link>
                {topic.placeLabel || topic.baseName ? ` · ${topic.placeLabel || topic.baseName}` : ''}
                {' · '}
                {new Date(topic.createdAt).toLocaleString('ru-RU')}
              </p>
              <p className="forum-body">{topic.body}</p>
              <div className="forum-actions">
                <button type="button" onClick={likeTopic}>
                  {topic.hasLiked ? '♥' : '♡'} {topic.likes || 0}
                </button>
              </div>
            </>
          )}
        </article>

        <section className="forum-card">
          <h2>Сообщения и ответы</h2>
          <ul className="forum-msgs">
            {tree.map((m) => (
              <li key={m.id}>
                <div className="forum-msg">
                  <div className="forum-msg__head">
                    <Link to={`/u/${m.authorId}`}>{m.authorName}</Link>
                    <span>
                      {new Date(m.createdAt).toLocaleString('ru-RU')}
                      {m.status === 'pending' &&
                        user?.id &&
                        String(m.authorId) === String(user.id) && (
                          <span className="forum-pending"> · на модерации</span>
                        )}
                    </span>
                  </div>
                  <p>{m.body}</p>
                  <div className="forum-actions">
                    <button type="button" onClick={() => likeMsg(m.id)}>
                      {m.hasLiked ? '♥' : '♡'} {m.likes || 0}
                    </button>
                    {isAuthenticated && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(m.id);
                            setKind('reply');
                          }}
                        >
                          Ответить
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTo(m.id);
                            setKind('comment');
                          }}
                        >
                          Комментарий
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {m.replies?.length > 0 && (
                  <ul className="forum-replies">
                    {m.replies.map((r) => (
                      <li key={r.id} className={r.kind === 'comment' ? 'is-comment' : ''}>
                        <div className="forum-msg__head">
                          <Link to={`/u/${r.authorId}`}>{r.authorName}</Link>
                          <span>
                            {r.kind === 'comment' ? 'коммент · ' : 'ответ · '}
                            {new Date(r.createdAt).toLocaleString('ru-RU')}
                            {r.status === 'pending' &&
                              user?.id &&
                              String(r.authorId) === String(user.id) && (
                                <span className="forum-pending"> · на модерации</span>
                              )}
                          </span>
                        </div>
                        <p>{r.body}</p>
                        <button type="button" onClick={() => likeMsg(r.id)}>
                          {r.hasLiked ? '♥' : '♡'} {r.likes || 0}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {isAuthenticated ? (
            <form className="forum-form" onSubmit={send}>
              <h3>{replyTo ? (kind === 'comment' ? 'Комментарий' : 'Ответ') : 'Новое сообщение'}</h3>
              {replyTo && (
                <button
                  type="button"
                  className="forum-linkish"
                  onClick={() => {
                    setReplyTo(null);
                    setKind('message');
                  }}
                >
                  Отменить вложенность
                </button>
              )}
              <textarea
                required
                rows={4}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Ваш текст…"
              />
              <button type="submit" className="forum-btn" disabled={busy}>
                Отправить
              </button>
            </form>
          ) : (
            <div className="forum-auth-cta">
              <p>Чтобы ответить, войдите или зарегистрируйтесь.</p>
              <Link to="/login" state={{ from: `/forum/${id}` }}>
                Войти
              </Link>
              <Link to="/register" state={{ from: `/forum/${id}` }}>
                Регистрация
              </Link>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
