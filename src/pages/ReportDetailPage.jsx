import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../components/auth/AuthContext';
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

function toEmbed(url) {
  if (url.includes('watch?v=')) {
    const videoId = url.split('watch?v=')[1].split('&')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }
  if (url.includes('youtu.be/')) {
    const videoId = url.split('youtu.be/')[1].split('?')[0];
    return `https://www.youtube.com/embed/${videoId}`;
  }
  return url;
}

export default function ReportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, profile, isAuthenticated, isAdmin, loading: authLoading, refresh } = useAuth();
  const { showToast } = useToast();
  const viewerKey = user?.id || null;

  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [favorited, setFavorited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [editNotice, setEditNotice] = useState('');
  const [commentNotice, setCommentNotice] = useState('');

  const isAuthor =
    user?.id && report?.authorUserId && String(report.authorUserId) === String(user.id);
  const canEdit = isAuthor || isAdmin;

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

  useEffect(() => {
    if (!lightboxSrc) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setLightboxSrc(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxSrc]);

  useEffect(() => {
    if (report && editing && !editForm) {
      setEditForm({
        place: report.place || '',
        date: report.date || '',
        fish: report.fish || '',
        bait: report.bait || '',
        weight: report.weight || '',
        description: report.description || '',
        images: [...(report.images || [])],
        videos: [...(report.videos || [])],
      });
    }
  }, [report, editing, editForm]);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const onLike = async () => {
    if (!isAuthenticated || !user) {
      navigate('/login', { state: { from: `/reports/${id}` } });
      return;
    }
    setBusy(true);
    try {
      const res = await reportSocialService.like(id, { userId: user.id });
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
    if (!isAuthenticated || !user) {
      navigate('/login', { state: { from: `/reports/${id}` } });
      return;
    }
    setBusy(true);
    try {
      const updated = await reportSocialService.rateStars(id, stars, {
        userId: user.id,
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
    if (!isAuthenticated || !user) return;
    if (!commentAuthor.trim() || !commentText.trim()) return;
    setBusy(true);
    setCommentNotice('');
    try {
      const result = await reportSocialService.addComment(id, {
        author: commentAuthor,
        authorUserId: user.id,
        text: commentText,
        parentId: replyTo,
        requireAuth: true,
      });
      const next = result.report || result;
      if (next?.id) setReport(next);
      else await load();
      setCommentText('');
      setReplyTo(null);
      setCommentNotice(result.message || 'Комментарий отправлен на модерацию');
      await refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onSaveEdit = async (e) => {
    e.preventDefault();
    if (!editForm || !canEdit) return;
    setBusy(true);
    setEditNotice('');
    try {
      const updated = await reportSocialService.update(id, {
        ...editForm,
        isAdmin,
        authorUserId: user?.id || null,
      });
      setReport(updated);
      setEditing(false);
      setEditForm(null);
      if (!isAdmin) {
        setEditNotice('Изменения сохранены и отправлены на модерацию');
      } else {
        setEditNotice('Изменения сохранены');
      }
      await load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleEditImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if ((editForm?.images?.length || 0) + files.length > 5) {
      alert('Максимум 5 фото');
      return;
    }
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        setEditForm((prev) => ({
          ...prev,
          images: [...(prev.images || []), event.target.result],
        }));
      };
      reader.readAsDataURL(file);
    });
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
      {lightboxSrc && (
        <div
          className="rdp-lightbox"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxSrc(null)}
        >
          <button type="button" className="rdp-lightbox__close" onClick={() => setLightboxSrc(null)}>
            ✕
          </button>
          <img src={lightboxSrc} alt="" onClick={(e) => e.stopPropagation()} />
        </div>
      )}

      <div className="rdp__top">
        <Link to="/reports" className="rdp__back">
          ← Отчёты
        </Link>
        {report.status !== 'approved' && (
          <span className="rdp__status">Статус: {report.status}</span>
        )}
        {canEdit && !editing && (
          <button type="button" className="rdp__edit-btn" onClick={() => setEditing(true)}>
            Редактировать
          </button>
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

      {editNotice && <div className="rdp__notice">{editNotice}</div>}

      {editing && editForm ? (
        <section className="rdp__card rdp__edit-form">
          <h2>Редактирование отчёта</h2>
          <form onSubmit={onSaveEdit}>
            <label>
              Место *
              <input
                required
                value={editForm.place}
                onChange={(e) => setEditForm({ ...editForm, place: e.target.value })}
              />
            </label>
            <label>
              Дата
              <input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              />
            </label>
            <label>
              Улов *
              <input
                required
                value={editForm.fish}
                onChange={(e) => setEditForm({ ...editForm, fish: e.target.value })}
              />
            </label>
            <label>
              Наживка
              <input
                value={editForm.bait}
                onChange={(e) => setEditForm({ ...editForm, bait: e.target.value })}
              />
            </label>
            <label>
              Вес
              <input
                value={editForm.weight}
                onChange={(e) => setEditForm({ ...editForm, weight: e.target.value })}
              />
            </label>
            <label>
              Описание *
              <textarea
                required
                rows={4}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </label>
            <label>
              Фото (до 5)
              <input type="file" accept="image/*" multiple onChange={handleEditImageUpload} />
            </label>
            {editForm.images?.length > 0 && (
              <div className="rdp__edit-images">
                {editForm.images.map((src, i) => (
                  <div key={i} className="rdp__edit-image">
                    <img src={src} alt="" />
                    <button
                      type="button"
                      onClick={() =>
                        setEditForm((p) => ({
                          ...p,
                          images: p.images.filter((_, idx) => idx !== i),
                        }))
                      }
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label>
              Видео YouTube
              <button
                type="button"
                className="rdp__add-video"
                disabled={(editForm.videos?.length || 0) >= 2}
                onClick={() => {
                  const url = window.prompt('Ссылка на YouTube:');
                  if (!url) return;
                  setEditForm((p) => ({
                    ...p,
                    videos: [...(p.videos || []), toEmbed(url)],
                  }));
                }}
              >
                Добавить видео
              </button>
            </label>
            <div className="rdp__edit-actions">
              <button type="submit" disabled={busy}>
                Сохранить
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditForm(null);
                }}
              >
                Отмена
              </button>
            </div>
            {!isAdmin && (
              <p className="rdp__edit-hint">После сохранения отчёт снова уйдёт на модерацию.</p>
            )}
          </form>
        </section>
      ) : (
        <>
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
                <button
                  key={i}
                  type="button"
                  className="rdp__gallery-btn"
                  onClick={() => setLightboxSrc(src)}
                >
                  <img src={src} alt="" />
                </button>
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
        </>
      )}

      <section className="rdp__card rdp__actions">
        <button type="button" disabled={busy || report.hasLiked} onClick={onLike}>
          {report.hasLiked ? '♥ Лайк' : '♡ Лайк'} · {report.rating || 0}
        </button>
        <button type="button" onClick={onFavorite}>
          {favorited ? '★ В избранном' : '☆ В избранное'}
        </button>
        <div className="rdp__stars">
          <span>
            Рейтинг {report.starAvg || 0}/5 ({report.starCount || 0})
          </span>
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

        {commentNotice && <div className="rdp__notice">{commentNotice}</div>}

        {isAuthenticated ? (
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
        ) : (
          <div className="rdp__auth-cta">
            <p>Чтобы оставить комментарий, войдите или зарегистрируйтесь.</p>
            <Link to="/login" state={{ from: `/reports/${id}` }}>
              Войти
            </Link>
            <Link to="/register" state={{ from: `/reports/${id}` }}>
              Регистрация
            </Link>
          </div>
        )}

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
                  {c.status === 'pending' &&
                    user?.id &&
                    String(c.authorUserId) === String(user.id) && (
                      <span className="rdp__pending-badge">на модерации</span>
                    )}
                </strong>
                <span>{formatDate(c.date)}</span>
              </div>
              <p>{c.text}</p>
              {isAuthenticated && (
                <button type="button" onClick={() => setReplyTo(c.id)}>
                  Ответить
                </button>
              )}
              {c.replies?.length > 0 && (
                <ul>
                  {c.replies.map((r) => (
                    <li key={r.id}>
                      <div className="rdp__c-head">
                        <strong>
                          {r.author}
                          {r.status === 'pending' &&
                            user?.id &&
                            String(r.authorUserId) === String(user.id) && (
                              <span className="rdp__pending-badge">на модерации</span>
                            )}
                        </strong>
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
