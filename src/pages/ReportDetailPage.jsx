import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
import { getAnonId } from '../hooks/useReports';
import { reportSocialService } from '../services/reportSocialService';
import { favoritesService } from '../services/favoritesService';
import { useToast } from '../components/ui/ToastContext';
import './ReportDetailPage.css';

function buildTree(comments) {
  if (!Array.isArray(comments)) return [];
  const roots = comments.filter((c) => !c.parentId);
  const kids = (pid) => comments.filter((c) => String(c.parentId) === String(pid));
  return roots.map((c) => ({ ...c, replies: kids(c.id) }));
}

export default function ReportDetailPage() {
  const { id } = useParams();
  const { user, profile, isAuthenticated, isAdmin, loading: authLoading, refresh } = useAuth();
  const { showToast } = useToast();
  const anonId = getAnonId();
  const viewerKey = user?.id || `anon:${anonId}`;

  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setError('');
    try {
      let row;
      try {
        row = await reportSocialService.get(id, {
          viewerKey,
          isAdmin,
          authorUserId: user?.id,
        });
      } catch (firstErr) {
        if (isAdmin) {
          row = await reportSocialService.getForModeration(id);
        } else {
          throw firstErr;
        }
      }
      setReport(row);
      if (user?.id) {
        setFavorited(await favoritesService.isFavorite(user.id, 'report', row.id));
      }
    } catch (err) {
      setError(err.message || 'Не найдено');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [id, viewerKey, isAdmin, user?.id, authLoading]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (profile?.display_name) setCommentAuthor(profile.display_name);
  }, [profile]);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const onLike = async () => {
    setBusy(true);
    try {
      const res = await reportSocialService.like(id, { userId: user?.id, anonId });
      if (!res.success) alert(res.message);
      else {
        setReport(res.report);
        await refresh();
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onStar = async (stars) => {
    setBusy(true);
    try {
      const updated = await reportSocialService.rateStars(id, stars, {
        userId: user?.id,
        anonId,
      });
      setReport(updated);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onComment = async (e) => {
    e.preventDefault();
    if (!commentAuthor.trim() || !commentText.trim()) return;
    setBusy(true);
    try {
      const { report: next } = await reportSocialService.addComment(id, {
        author: commentAuthor,
        authorUserId: user?.id || null,
        text: commentText,
        parentId: replyTo,
      });
      setReport(next);
      setCommentText('');
      setReplyTo(null);
      await refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onFavorite = async () => {
    if (!isAuthenticated || !user) {
      showToast('Войдите, чтобы добавить в избранное', { type: 'info' });
      return;
    }
    try {
      const res = await favoritesService.toggleReport(user.id, report);
      setFavorited(Boolean(res?.favorited));
      await refresh();
      const title = report.place || 'Отчёт';
      if (res?.favorited) {
        showToast(`«${title}» добавлено в избранное`);
      } else {
        showToast(`«${title}» убрано из избранного`, { type: 'info' });
      }
    } catch (err) {
      showToast(err.message || 'Не удалось изменить избранное', { type: 'error' });
    }
  };

  const onModerate = async (action) => {
    if (!isAdmin || !user?.id) return;
    const note = action === 'reject' ? window.prompt('Причина отклонения') || '' : '';
    setBusy(true);
    setError('');
    try {
      await reportSocialService.moderate(user.id, id, { action, note });
      await load();
    } catch (err) {
      setError(err.message || 'Не удалось изменить статус');
    } finally {
      setBusy(false);
    }
  };

  if (authLoading || loading) return <div className="rdp">Загрузка…</div>;
  if (error || !report) {
    return (
      <div className="rdp">
        <p>{error || 'Отчёт не найден'}</p>
        <Link to="/reports">← К списку</Link>
      </div>
    );
  }

  const tree = buildTree(report.comments);

  return (
    <div className="rdp">
      <div className="rdp__top">
        <Link to="/reports" className="rdp__back">
          ← Отчёты
        </Link>
        {report.status !== 'approved' && (
          <span className="rdp__status">Статус: {report.status}</span>
        )}
        {isAdmin && report.status !== 'approved' && (
          <div className="rdp__moderation">
            <button type="button" disabled={busy} onClick={() => onModerate('approve')}>
              Одобрить
            </button>
            <button type="button" disabled={busy} onClick={() => onModerate('reject')}>
              Отклонить
            </button>
          </div>
        )}
      </div>

      <header className="rdp__hero">
        <h1>{report.place}</h1>
        <p className="rdp__meta">
          {formatDate(report.date)} · улов: {report.fish}
          {report.weight ? ` · ${report.weight}` : ''}
        </p>
        <div className="rdp__author">
          {report.authorUserId ? (
            <Link to={`/u/${report.authorUserId}`}>{report.author}</Link>
          ) : (
            <span>{report.author}</span>
          )}
          {report.baseId && (
            <Link to={`/waters/${report.baseId}`} className="rdp__base">
              Водоём: {report.baseName || report.place}
            </Link>
          )}
        </div>
      </header>

      {report.images?.length > 0 && (
        <div className="rdp__gallery">
          {report.images.map((src, i) => (
            <img key={i} src={src} alt="" />
          ))}
        </div>
      )}

      {report.videos?.length > 0 && (
        <div className="rdp__videos">
          {report.videos.map((src, i) => (
            <iframe key={i} src={src} title={`video-${i}`} allowFullScreen />
          ))}
        </div>
      )}

      <section className="rdp__card">
        <h2>Описание</h2>
        <p>{report.description}</p>
        {report.bait && <p className="rdp__extra">Наживка / приманка: {report.bait}</p>}
        {report.extra && (
          <>
            <h3>Дополнительно</h3>
            <p>{report.extra}</p>
          </>
        )}
      </section>

      <section className="rdp__card rdp__actions">
        <button type="button" disabled={busy || report.hasLiked} onClick={onLike}>
          {report.hasLiked ? '♥ Лайк' : '♡ Лайк'} · {report.rating || 0}
        </button>
        <button type="button" onClick={onFavorite}>
          {favorited ? '★ В избранном' : '☆ В избранное'}
        </button>
        <div className="rdp__stars">
          <span>Рейтинг {report.starAvg || 0}/5 ({report.starCount || 0})</span>
          <div>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={n <= (report.myStar || 0) ? 'is-on' : ''}
                disabled={busy}
                onClick={() => onStar(n)}
              >
                ★
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rdp__card" id="comments">
        <h2>Комментарии ({report.comments?.length || 0})</h2>
        <form className="rdp__comment-form" onSubmit={onComment}>
          {replyTo && (
            <div className="rdp__reply-hint">
              Ответ на комментарий{' '}
              <button type="button" onClick={() => setReplyTo(null)}>
                отменить
              </button>
            </div>
          )}
          <input
            placeholder="Имя"
            value={commentAuthor}
            onChange={(e) => setCommentAuthor(e.target.value)}
            required
          />
          <textarea
            placeholder="Комментарий"
            rows={3}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            required
          />
          <button type="submit" disabled={busy}>
            Отправить
          </button>
        </form>

        <ul className="rdp__comments">
          {tree.map((c) => (
            <li key={c.id}>
              <div className="rdp__c-head">
                <strong>
                  {c.authorUserId ? (
                    <Link to={`/u/${c.authorUserId}`}>{c.author}</Link>
                  ) : (
                    c.author
                  )}
                </strong>
                <span>{formatDate(c.date)}</span>
              </div>
              <p>{c.text}</p>
              <button type="button" onClick={() => setReplyTo(c.id)}>
                Ответить
              </button>
              {c.replies?.length > 0 && (
                <ul>
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <div className="rdp__c-head">
                        <strong>{r.author}</strong>
                        <span>{formatDate(r.date)}</span>
                      </div>
                      <p>{r.text}</p>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
