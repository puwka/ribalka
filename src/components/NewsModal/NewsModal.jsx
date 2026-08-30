import { useState } from 'react';
import Comments from '../Comments/Comments';
import './NewsModal.css';

export default function NewsModal({ news, onClose }) {
  const [activeTab, setActiveTab] = useState('article');

  if (!news) return null;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const shareUrl = encodeURIComponent(window.location.href);
  const shareTitle = encodeURIComponent(news.title);

  const shareLinks = {
    vk: `https://vk.com/share.php?url=${shareUrl}&title=${shareTitle}`,
    telegram: `https://t.me/share/url?url=${shareUrl}&text=${shareTitle}`,
    whatsapp: `https://api.whatsapp.com/send?text=${shareTitle}%20${shareUrl}`
  };

  return (
    <div className="news-modal" onClick={onClose}>
      <div className="news-modal__content" onClick={e => e.stopPropagation()}>
        <button className="news-modal__close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        
        <div className="news-modal__header">
          <div className="news-modal__category">{news.category}</div>
          <h2 className="news-modal__title">{news.title}</h2>
          <div className="news-modal__meta">
            <span>📅 {formatDate(news.date)}</span>
            <span>✍️ {news.author}</span>
            <span>👁 {news.views} просмотров</span>
          </div>
        </div>

        <div className="news-modal__image">
          <img src={news.image} alt={news.title} />
        </div>

        <div className="news-modal__tabs">
          <button 
            className={`tab-btn ${activeTab === 'article' ? 'active' : ''}`}
            onClick={() => setActiveTab('article')}
          >
             Статья
          </button>
          <button 
            className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveTab('comments')}
          >
             Комментарии
          </button>
        </div>

        {activeTab === 'article' && (
          <>
            <div className="news-modal__body">
              <div 
                className="news-modal__text"
                dangerouslySetInnerHTML={{ 
                  __html: news.content.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                }}
              />
            </div>

            <div className="news-modal__share">
              <h3>Поделиться:</h3>
              <div className="share-buttons">
                <a href={shareLinks.vk} target="_blank" rel="noopener noreferrer" className="share-btn vk">
                  VK
                </a>
                <a href={shareLinks.telegram} target="_blank" rel="noopener noreferrer" className="share-btn telegram">
                  Telegram
                </a>
                <a href={shareLinks.whatsapp} target="_blank" rel="noopener noreferrer" className="share-btn whatsapp">
                  WhatsApp
                </a>
              </div>
            </div>
          </>
        )}

        {activeTab === 'comments' && (
          <Comments newsId={news.id} />
        )}
      </div>
    </div>
  );
}