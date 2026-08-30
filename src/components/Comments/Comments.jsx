import { useState, useEffect } from 'react';
import './Comments.css';

export default function Comments({ newsId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState({ name: '', text: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const savedComments = localStorage.getItem(`comments-${newsId}`);
    if (savedComments) {
      setComments(JSON.parse(savedComments));
    }
  }, [newsId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!newComment.name.trim() || !newComment.text.trim()) {
      alert('Пожалуйста, заполните все поля');
      return;
    }

    setIsSubmitting(true);

    const comment = {
      id: Date.now(),
      name: newComment.name.trim(),
      text: newComment.text.trim(),
      date: new Date().toISOString(),
      avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(newComment.name)}&background=4a90d9&color=fff`
    };

    const updatedComments = [comment, ...comments];
    setComments(updatedComments);
    localStorage.setItem(`comments-${newsId}`, JSON.stringify(updatedComments));
    
    setNewComment({ name: '', text: '' });
    setIsSubmitting(false);
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="comments">
      <div className="comments__form">
        <h3>Оставить комментарий</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="text"
              placeholder="Ваше имя *"
              value={newComment.name}
              onChange={(e) => setNewComment({ ...newComment, name: e.target.value })}
              className="form-input"
              disabled={isSubmitting}
            />
          </div>
          <div className="form-group">
            <textarea
              placeholder="Ваш комментарий *"
              value={newComment.text}
              onChange={(e) => setNewComment({ ...newComment, text: e.target.value })}
              className="form-textarea"
              rows="4"
              disabled={isSubmitting}
            />
          </div>
          <button 
            type="submit" 
            className="submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Отправка...' : 'Отправить комментарий'}
          </button>
        </form>
      </div>

      <div className="comments__list">
        <h3>Комментарии ({comments.length})</h3>
        {comments.length === 0 ? (
          <div className="no-comments">
            <p>Пока нет комментариев. Будьте первым! 👋</p>
          </div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="comment">
              <div className="comment__avatar">
                <img src={comment.avatar} alt={comment.name} />
              </div>
              <div className="comment__content">
                <div className="comment__header">
                  <h4 className="comment__name">{comment.name}</h4>
                  <span className="comment__date">{formatDate(comment.date)}</span>
                </div>
                <p className="comment__text">{comment.text}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}