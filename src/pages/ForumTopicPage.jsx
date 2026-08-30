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

  if (!data) return <div className="forum-page"><div className="forum-wrap">Загрузка…</div></div>;

  const { topic } = data;

  return (
    <div className="forum-page">
      <div className="forum-wrap forum-topic">
        <Link to="/forum" className="forum-back">
          ← Форум
        </Link>

        <article className="forum-card">
          {topic.pinned && <span className="forum-pin">Закреплено</span>}
          {topic.locked && <span className="forum-pin">Закрыто</span>}
          <h1>{topic.title}</h1>
          <p className="forum-muted">
            <Link to={`/u/${topic.authorId}`}>{topic.authorName}</Link>
            {topic.placeLabel || topic.baseName
              ? ` · ${topic.placeLabel || topic.baseName}`
              : ''}
            {' · '}
            {new Date(topic.createdAt).toLocaleString('ru-RU')}
          </p>
          <p className="forum-body">{topic.body}</p>
          <div className="forum-actions">
            <button type="button" onClick={likeTopic}>
              {topic.hasLiked ? '♥' : '♡'} {topic.likes || 0}
            </button>
          </div>
        </article>

        <section className="forum-card">
          <h2>Сообщения и ответы</h2>
          <ul className="forum-msgs">
            {tree.map((m) => (
              <li key={m.id}>
                <div className="forum-msg">
                  <div className="forum-msg__head">
                    <Link to={`/u/${m.authorId}`}>{m.authorName}</Link>
                    <span>{new Date(m.createdAt).toLocaleString('ru-RU')}</span>
                  </div>
                  <p>{m.body}</p>
                  <div className="forum-actions">
                    <button type="button" onClick={() => likeMsg(m.id)}>
                      {m.hasLiked ? '♥' : '♡'} {m.likes || 0}
                    </button>
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
              placeholder={isAuthenticated ? 'Ваш текст…' : 'Войдите, чтобы писать'}
              disabled={!isAuthenticated}
            />
            <button type="submit" className="forum-btn" disabled={busy || !isAuthenticated}>
              Отправить
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
