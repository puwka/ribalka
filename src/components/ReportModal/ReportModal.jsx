import { useEffect, useState } from 'react';
import { favoritesService } from '../../services/favoritesService';
import { useToast } from '../ui/ToastContext';
import './ReportModal.css';

export default function ReportModal({
  report,
  onClose,
  onVote,
  hasVoted,
  onAddComment,
  onToggleFavorite,
  currentUserId,
  formatDate,
}) {
  const { showToast } = useToast();
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState('details');
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!currentUserId || !report) return;
      const isFav = await favoritesService.isFavorite(currentUserId, 'report', report.id);
      if (alive) setFavorited(isFav);
    })();
    return () => {
      alive = false;
    };
  }, [currentUserId, report]);

  if (!report) return null;

  // Голосование
  const handleVote = async () => {
    const result = await onVote(report.id);
    if (!result.success) {
      alert(result.message);
    }
  };

  const handleFavorite = async () => {
    if (!onToggleFavorite) return;
    try {
      const result = await onToggleFavorite(report);
      setFavorited(Boolean(result?.favorited));
      const title = report.place || 'Отчёт';
      if (result?.favorited) {
        showToast(`«${title}» добавлено в избранное`);
      } else {
        showToast(`«${title}» убрано из избранного`, { type: 'info' });
      }
    } catch (err) {
      showToast(err.message || 'Не удалось изменить избранное', { type: 'error' });
    }
  };

  // Добавление комментария
  const handleCommentSubmit = (e) => {
    e.preventDefault();
    if (!commentAuthor.trim() || !commentText.trim()) {
      alert('Заполните все поля');
      return;
    }

    onAddComment(report.id, {
      author: commentAuthor,
      text: commentText,
      parentId: replyTo
    });

    setCommentAuthor('');
    setCommentText('');
    setReplyTo(null);
  };

  // Ответ на комментарий
  const handleReply = (commentId, authorName) => {
    setReplyTo(commentId);
    setCommentText(`@${authorName}, `);
    setTimeout(() => {
      document.getElementById('comment-form')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // 🆕 Построение дерева комментариев с защитой от не-массивов
  const buildCommentTree = (comments) => {
    // Защита от undefined, null и не-массивов
    if (!Array.isArray(comments)) return [];
    
    const rootComments = comments.filter(c => !c.parentId);
    const getReplies = (parentId) => comments.filter(c => c.parentId === parentId);
    
    return rootComments.map(comment => ({
      ...comment,
      replies: getReplies(comment.id).map(reply => ({
        ...reply,
        replies: getReplies(reply.id)
      }))
    }));
  };

  const commentTree = buildCommentTree(report.comments);

  // Рендер комментария
  const renderComment = (comment, depth = 0) => (
    <div key={comment.id} className={`rm-comment-item rm-depth-${depth}`}>
      <div className="rm-comment-avatar">
        {comment.author.charAt(0).toUpperCase()}
      </div>
      <div className="rm-comment-body">
        <div className="rm-comment-header">
          <strong className="rm-comment-author">{comment.author}</strong>
          <span className="rm-comment-date">
            {new Date(comment.date).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
        <p className="rm-comment-text">{comment.text}</p>
        <button 
          className="rm-reply-btn"
          onClick={() => handleReply(comment.id, comment.author)}
        >
          ↩️ Ответить
        </button>
      </div>
      
      {Array.isArray(comment.replies) && comment.replies.length > 0 && (
        <div className="rm-comment-replies">
          {comment.replies.map(reply => renderComment(reply, depth + 1))}
        </div>
      )}
    </div>
  );

  return (
    <div className="rm-overlay" onClick={onClose}>
      <div className="rm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="rm-close" onClick={onClose}>✕</button>
        
        {/* Галерея фото */}
        {Array.isArray(report.images) && report.images.length > 0 && (
          <div className="rm-gallery">
            <div className="rm-gallery-main">
              <img src={report.images[activeImage]} alt={report.place} />
              
              {report.images.length > 1 && (
                <>
                  <button 
                    className="rm-gallery-nav rm-gallery-nav--prev"
                    onClick={() => setActiveImage((activeImage - 1 + report.images.length) % report.images.length)}
                  >
                    ‹
                  </button>
                  <button 
                    className="rm-gallery-nav rm-gallery-nav--next"
                    onClick={() => setActiveImage((activeImage + 1) % report.images.length)}
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            
            {report.images.length > 1 && (
              <div className="rm-gallery-thumbs">
                {report.images.map((img, i) => (
                  <button
                    key={i}
                    className={`rm-gallery-thumb ${i === activeImage ? 'active' : ''}`}
                    onClick={() => setActiveImage(i)}
                  >
                    <img src={img} alt={`Фото ${i + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Заголовок */}
        <div className="rm-header">
          <div className="rm-author">
            <div className="rm-author-avatar">
              {report.author.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="rm-author-name">{report.author}</div>
              <div className="rm-report-date">{formatDate(report.date)}</div>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className={`rm-vote-btn ${favorited ? 'voted' : ''}`}
              onClick={handleFavorite}
              title={favorited ? 'Убрать из избранного' : 'В избранное'}
            >
              {favorited ? '⭐ В избранном' : '☆ В избранное'}
            </button>
            <button
              className={`rm-vote-btn ${hasVoted(report.id) ? 'voted' : ''}`}
              onClick={handleVote}
              title={hasVoted(report.id) ? 'Вы уже голосовали' : 'Проголосовать'}
            >
              {hasVoted(report.id) ? '✅' : '👍'} {report.rating || 0}
            </button>
          </div>
        </div>

        <h2 className="rm-title">{report.place}</h2>

        {/* Мета-информация */}
        <div className="rm-meta">
          <div className="rm-meta-chip">🐟 {report.fish}</div>
          {report.bait && <div className="rm-meta-chip">🎣 {report.bait}</div>}
          {report.weight && <div className="rm-meta-chip">⚖️ {report.weight}</div>}
        </div>

        {/* Табы */}
        <div className="rm-tabs">
          <button 
            className={`rm-tab-btn ${activeTab === 'details' ? 'active' : ''}`}
            onClick={() => setActiveTab('details')}
          >
            📖 Описание
          </button>
          {Array.isArray(report.videos) && report.videos.length > 0 && (
            <button 
              className={`rm-tab-btn ${activeTab === 'videos' ? 'active' : ''}`}
              onClick={() => setActiveTab('videos')}
            >
              🎬 Видео ({report.videos.length})
            </button>
          )}
          <button 
            className={`rm-tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            💬 Комментарии ({Array.isArray(report.comments) ? report.comments.length : 0})
          </button>
        </div>

        {/* Вкладка: Описание */}
        {activeTab === 'details' && (
          <div className="rm-details">
            <p className="rm-description">{report.description}</p>
          </div>
        )}

        {/* Вкладка: Видео */}
        {activeTab === 'videos' && Array.isArray(report.videos) && report.videos.length > 0 && (
          <div className="rm-videos">
            {report.videos.map((video, i) => (
              <div key={i} className="rm-video-wrapper">
                <iframe 
                  src={video}
                  title={`Видео ${i + 1}`}
                  frameBorder="0"
                  allowFullScreen
                />
              </div>
            ))}
          </div>
        )}

        {/* Вкладка: Комментарии */}
        {activeTab === 'comments' && (
          <div className="rm-comments">
            <form id="comment-form" className="rm-comment-form" onSubmit={handleCommentSubmit}>
              <h3>
                {replyTo ? '↩️ Ответ на комментарий' : '💬 Оставить комментарий'}
                {replyTo && (
                  <button 
                    type="button"
                    className="rm-cancel-reply"
                    onClick={() => { setReplyTo(null); setCommentText(''); }}
                  >
                    ✕ Отменить
                  </button>
                )}
              </h3>
              <input
                type="text"
                placeholder="Ваше имя"
                value={commentAuthor}
                onChange={(e) => setCommentAuthor(e.target.value)}
                className="rm-comment-input"
                required
              />
              <textarea
                placeholder="Ваш комментарий..."
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                className="rm-comment-textarea"
                rows="3"
                required
              />
              <button type="submit" className="rm-comment-submit">
                Отправить
              </button>
            </form>

            <div className="rm-comments-list">
              {commentTree.length === 0 ? (
                <div className="rm-no-comments">
                  <p>Пока нет комментариев. Будьте первым! 💬</p>
                </div>
              ) : (
                commentTree.map(comment => renderComment(comment, 0))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}