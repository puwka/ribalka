import { useState } from 'react';
import Comments from '../Comments/Comments';
import './Modal.css';

export default function Modal({ item, onClose }) {
  const [activeTab, setActiveTab] = useState('info');
  const [activeVideo, setActiveVideo] = useState(0);

  if (!item) return null;

  const mapUrl = `https://yandex.ru/maps/?pt=${item.coords.split(',').reverse().join(',')}&z=12&l=map`;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal__content" onClick={e => e.stopPropagation()}>
        <button className="modal__close" onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        
        <div className="modal__header">
          <h2>{item.name}</h2>
          {item.price && <div className="modal__price">{item.price}</div>}
        </div>
        
        {/* ГАЛЕРЕЯ ФОТО */}
        <div className="modal__gallery">
          {item.images.map((img, i) => (
            <img key={i} src={img} alt={`${item.name} ${i + 1}`} />
          ))}
        </div>

        {/* ВКЛАДКИ */}
        <div className="modal__tabs">
          <button 
            className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
             Информация
          </button>
          {item.videos && item.videos.length > 0 && (
            <button 
              className={`tab-btn ${activeTab === 'video' ? 'active' : ''}`}
              onClick={() => setActiveTab('video')}
            >
               Видео ({item.videos.length})
            </button>
          )}
          <button 
            className={`tab-btn ${activeTab === 'comments' ? 'active' : ''}`}
            onClick={() => setActiveTab('comments')}
          >
             Комментарии
          </button>
        </div>

        {/* ВКЛАДКА: ИНФОРМАЦИЯ */}
        {activeTab === 'info' && (
          <div className="modal__info">
            <div className="info-block">
              <div className="info-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </div>
              <div className="info-content">
                <h4>Описание</h4>
                <p>{item.description}</p>
              </div>
            </div>

            <div className="info-block">
              <div className="info-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6-3.56 0-7.56-2.53-8.5-6z"/>
                </svg>
              </div>
              <div className="info-content">
                <h4>Виды рыб</h4>
                <p>{item.fish}</p>
              </div>
            </div>

            {item.services && item.services.length > 0 && (
              <div className="info-block">
                <div className="info-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 7h-4V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v4H4a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1z"/>
                  </svg>
                </div>
                <div className="info-content">
                  <h4>Услуги</h4>
                  <div className="services-list">
                    {item.services.map((service, i) => (
                      <span key={i} className="service-tag">✓ {service}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="info-block">
              <div className="info-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div className="info-content">
                <h4>Адрес</h4>
                <p>{item.address}</p>
              </div>
            </div>

            <div className="info-block">
              <div className="info-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div className="info-content">
                <h4>Как добраться</h4>
                <p>{item.howToGet}</p>
              </div>
            </div>

            <div className="info-block">
              <div className="info-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="10" rx="2"/>
                  <circle cx="7" cy="21" r="2"/>
                  <circle cx="17" cy="21" r="2"/>
                  <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                </svg>
              </div>
              <div className="info-content">
                <h4>На чём проехать</h4>
                <p>{item.transport}</p>
              </div>
            </div>

            {item.weather && (
              <div className="info-block">
                <div className="info-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 18a5 5 0 0 0-10 0"/>
                    <line x1="12" y1="9" x2="12" y2="2"/>
                    <line x1="4.22" y1="10.22" x2="5.64" y2="11.64"/>
                    <line x1="1" y1="18" x2="3" y2="18"/>
                    <line x1="21" y1="18" x2="23" y2="18"/>
                    <line x1="18.36" y1="11.64" x2="19.78" y2="10.22"/>
                    <line x1="23" y1="22" x2="1" y2="22"/>
                  </svg>
                </div>
                <div className="info-content">
                  <h4>Погодные условия</h4>
                  <p>{item.weather}</p>
                </div>
              </div>
            )}

            <a 
              href={mapUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="modal__map-btn"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>Открыть на Яндекс.Картах</span>
            </a>
          </div>
        )}

        {/* ВКЛАДКА: ВИДЕО */}
        {activeTab === 'video' && item.videos && item.videos.length > 0 && (
          <div className="modal__videos">
            <div className="video-main">
              <iframe 
                src={item.videos[activeVideo]} 
                title="Видео" 
                frameBorder="0" 
                allowFullScreen
              />
            </div>
            {item.videos.length > 1 && (
              <div className="video-thumbs">
                {item.videos.map((video, i) => (
                  <div 
                    key={i} 
                    className={`video-thumb ${i === activeVideo ? 'active' : ''}`}
                    onClick={() => setActiveVideo(i)}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3"/>
                    </svg>
                    <span>Видео {i + 1}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ВКЛАДКА: КОММЕНТАРИИ */}
        {activeTab === 'comments' && (
          <Comments newsId={`base-${item.id}`} />
        )}
      </div>
    </div>
  );
}