import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { newsData } from '../../data/news';
import { basesService } from '../../services/basesService';
import { directoryAdminService } from '../../services/directoryAdminService';
import './SearchBar.css';

export default function SearchBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState({ paid: [], free: [] });
  const [directoryData, setDirectoryData] = useState([]);
  const [results, setResults] = useState({ paid: [], free: [], news: [], directory: [] });
  const inputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    basesService.listPublic().then((rows) => {
      if (!alive) return;
      const list = rows || [];
      setCatalog({
        paid: list.filter((b) => b.type === 'paid'),
        free: list.filter((b) => b.type === 'free'),
      });
    }).catch(() => {
      if (alive) setCatalog({ paid: [], free: [] });
    });
    directoryAdminService.listPublic().then((rows) => {
      if (alive) setDirectoryData(rows || []);
    }).catch(() => {
      if (alive) setDirectoryData([]);
    });
    return () => { alive = false; };
  }, []);

  // Открытие по Ctrl+K или Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Поиск по всем данным
  useEffect(() => {
    if (!query.trim()) {
      setResults({ paid: [], free: [], news: [], directory: [] });
      return;
    }

    const q = query.toLowerCase();
    const matchBase = (b) =>
      (b.name || '').toLowerCase().includes(q) ||
      (b.short || '').toLowerCase().includes(q) ||
      (b.description || '').toLowerCase().includes(q) ||
      (b.fish || '').toLowerCase().includes(q) ||
      (b.address || '').toLowerCase().includes(q);

    const paid = catalog.paid.filter(matchBase).slice(0, 3);
    const free = catalog.free.filter(matchBase).slice(0, 3);

    const news = newsData.filter(n => 
      n.title.toLowerCase().includes(q) ||
      n.excerpt.toLowerCase().includes(q) ||
      n.content.toLowerCase().includes(q) ||
      n.category.toLowerCase().includes(q)
    ).slice(0, 3);

    const directory = directoryData.filter((d) =>
      (d.name || '').toLowerCase().includes(q) ||
      (d.description || '').toLowerCase().includes(q) ||
      (d.tags || []).some((t) => String(t).toLowerCase().includes(q))
    ).slice(0, 3);

    setResults({ paid, free, news, directory });
  }, [query, catalog, directoryData]);

  const totalResults = results.paid.length + results.free.length + results.news.length + results.directory.length;

  const handleResultClick = (type, item) => {
    setIsOpen(false);
    setQuery('');

    if (type === 'paid' || type === 'free') {
      navigate(`/waters/${item.id}`);
    } else if (type === 'news') {
      navigate(`/news/${item.id}`);
    } else if (type === 'directory') {
      navigate('/directory');
    }
  };

  const highlightText = (text, query) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <mark key={i}>{part}</mark> : part
    );
  };

  return (
    <>
      {/* Кнопка открытия поиска */}
      <button 
        className="search-trigger" 
        onClick={() => { setIsOpen(true); setTimeout(() => inputRef.current?.focus(), 100); }}
        aria-label="Поиск"
        title="Поиск (Ctrl+K)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="M21 21l-4.35-4.35"/>
        </svg>
        <span className="search-trigger-text">Поиск</span>
        <kbd className="search-trigger-kbd">Ctrl+K</kbd>
      </button>

      {/* Модальное окно поиска */}
      {isOpen && (
        <div className="search-modal" onClick={() => { setIsOpen(false); setQuery(''); }}>
          <div className="search-modal__content" onClick={(e) => e.stopPropagation()}>
            {/* Поле ввода */}
            <div className="search-modal__input-wrapper">
              <svg className="search-modal__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/>
                <path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                placeholder="Поиск по сайту..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="search-modal__input"
                autoFocus
              />
              <button 
                className="search-modal__close"
                onClick={() => { setIsOpen(false); setQuery(''); }}
                aria-label="Закрыть"
              >
                ✕
              </button>
            </div>

            {/* Результаты */}
            <div className="search-modal__results">
              {query.trim() === '' ? (
                <div className="search-modal__empty">
                  <p>Начните вводить запрос</p>
                  <div className="search-modal__hints">
                    <div className="hint-item">
                      <kbd>↑↓</kbd> навигация
                    </div>
                    <div className="hint-item">
                      <kbd>Enter</kbd> открыть
                    </div>
                    <div className="hint-item">
                      <kbd>Esc</kbd> закрыть
                    </div>
                  </div>
                </div>
              ) : totalResults === 0 ? (
                <div className="search-modal__empty">
                  <span className="empty-icon">🔍</span>
                  <p>Ничего не найдено по запросу «{query}»</p>
                  <button 
                    className="search-modal__reset"
                    onClick={() => setQuery('')}
                  >
                    Сбросить поиск
                  </button>
                </div>
              ) : (
                <>
                  {results.paid.length > 0 && (
                    <div className="search-section">
                      <div className="search-section__title">💎 Платные водоёмы</div>
                      {results.paid.map(item => (
                        <div 
                          key={item.id} 
                          className="search-result"
                          onClick={() => handleResultClick('paid', item)}
                        >
                          <div className="search-result__icon">💎</div>
                          <div className="search-result__content">
                            <div className="search-result__title">
                              {highlightText(item.name, query)}
                            </div>
                            <div className="search-result__desc">
                              Платный водоём · {highlightText(item.short, query)}
                            </div>
                          </div>
                          <div className="search-result__meta">{item.price}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {results.free.length > 0 && (
                    <div className="search-section">
                      <div className="search-section__title">🌲 Бесплатные водоёмы</div>
                      {results.free.map(item => (
                        <div 
                          key={item.id} 
                          className="search-result"
                          onClick={() => handleResultClick('free', item)}
                        >
                          <div className="search-result__icon">🌲</div>
                          <div className="search-result__content">
                            <div className="search-result__title">
                              {highlightText(item.name, query)}
                            </div>
                            <div className="search-result__desc">
                              Бесплатный водоём · {highlightText(item.short, query)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {results.news.length > 0 && (
                    <div className="search-section">
                      <div className="search-section__title">📰 Новости</div>
                      {results.news.map(item => (
                        <div 
                          key={item.id} 
                          className="search-result"
                          onClick={() => handleResultClick('news', item)}
                        >
                          <div className="search-result__icon">📰</div>
                          <div className="search-result__content">
                            <div className="search-result__title">
                              {highlightText(item.title, query)}
                            </div>
                            <div className="search-result__desc">
                              {highlightText(item.excerpt, query)}
                            </div>
                          </div>
                          <div className="search-result__meta">{item.category}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {results.directory.length > 0 && (
                    <div className="search-section">
                      <div className="search-section__title">📚 Справочник</div>
                      {results.directory.map(item => (
                        <div 
                          key={item.id} 
                          className="search-result"
                          onClick={() => handleResultClick('directory', item)}
                        >
                          <div className="search-result__icon">
                            {item.category === 'shop' ? '🛒' : item.category === 'service' ? '🔧' : '👨‍🏫'}
                          </div>
                          <div className="search-result__content">
                            <div className="search-result__title">
                              {highlightText(item.name, query)}
                            </div>
                            <div className="search-result__desc">
                              {highlightText(item.description, query)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Подвал */}
            <div className="search-modal__footer">
              <span>{totalResults > 0 ? `Найдено: ${totalResults}` : ''}</span>
              <div className="search-modal__footer-hints">
                <kbd>Esc</kbd> закрыть
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}