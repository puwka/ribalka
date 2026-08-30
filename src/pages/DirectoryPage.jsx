import { useEffect, useMemo, useState } from 'react';
import { directoryAdminService } from '../services/directoryAdminService';
import { DIRECTORY_CATEGORIES } from '../data/directorySeed';
import './DirectoryPage.css';

const CATEGORY_BY_TAB = Object.fromEntries(
  DIRECTORY_CATEGORIES.map((c) => [c.tab, c.id])
);

export default function DirectoryPage() {
  const [activeTab, setActiveTab] = useState('shops');
  const [searchQuery, setSearchQuery] = useState('');
  const [title, setTitle] = useState('Справочник рыболова');
  const [description, setDescription] = useState(
    'Магазины, сервисы, гиды и егеря Пермского края'
  );
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const page = await directoryAdminService.getPage();
        const list = await directoryAdminService.listPublic();
        if (!alive) return;
        setTitle(page.title || 'Справочник рыболова');
        setDescription(page.description || '');
        setItems(list);
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const tabs = DIRECTORY_CATEGORIES.map((c) => ({
    id: c.tab,
    label: `${c.emoji} ${c.label}`,
  }));

  const currentData = useMemo(() => {
    const category = CATEGORY_BY_TAB[activeTab];
    return items.filter((item) => item.category === category);
  }, [items, activeTab]);

  const filteredData = currentData.filter((item) => {
    const query = searchQuery.toLowerCase();
    if (!query) return true;
    const tags = Array.isArray(item.tags) ? item.tags : [];
    return (
      (item.name || '').toLowerCase().includes(query) ||
      (item.description || '').toLowerCase().includes(query) ||
      tags.some((tag) => String(tag).toLowerCase().includes(query))
    );
  });

  return (
    <div className="directory-page">
      <div className="directory-header">
        <h1>{title.startsWith('📚') ? title : `📚 ${title}`}</h1>
        <p>{description}</p>
      </div>

      <div className="directory-container">
        <div className="directory-search">
          <input
            type="text"
            placeholder="🔍 Поиск по названию, описанию или тегам..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="directory-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.id);
                setSearchQuery('');
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="directory-count">
          Найдено: <strong>{filteredData.length}</strong> {getTabName(activeTab)}
        </div>

        {loading ? (
          <div className="no-results">
            <p>Загрузка…</p>
          </div>
        ) : (
          <div className="directory-grid">
            {filteredData.length === 0 ? (
              <div className="no-results">
                <span className="no-results-icon">🔍</span>
                <p>Ничего не найдено</p>
                <button type="button" className="reset-btn" onClick={() => setSearchQuery('')}>
                  Сбросить поиск
                </button>
              </div>
            ) : (
              filteredData.map((item) => (
                <div key={item.id} className="directory-card">
                  <div className="card-image">
                    {item.image ? <img src={item.image} alt={item.name} /> : null}
                    <div className="card-category">{getCategoryLabel(item.category)}</div>
                  </div>

                  <div className="card-body">
                    <h3 className="card-title">{item.name}</h3>
                    <p className="card-description">{item.description}</p>

                    <div className="card-tags">
                      {(item.tags || []).map((tag, i) => (
                        <span key={`${tag}-${i}`} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="card-info">
                      {item.address && (
                        <div className="info-row">
                          <span className="info-icon">📍</span>
                          <span>{item.address}</span>
                        </div>
                      )}
                      {item.phone && (
                        <div className="info-row">
                          <span className="info-icon">📞</span>
                          <a href={`tel:${item.phone}`} className="info-link">
                            {item.phone}
                          </a>
                        </div>
                      )}
                      {item.hours && (
                        <div className="info-row">
                          <span className="info-icon">🕐</span>
                          <span>{item.hours}</span>
                        </div>
                      )}
                      {item.website && (
                        <div className="info-row">
                          <span className="info-icon">🌐</span>
                          <a
                            href={item.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="info-link"
                          >
                            Перейти на сайт
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="card-actions">
                      {item.phone && (
                        <a href={`tel:${item.phone}`} className="btn btn-primary">
                          📞 Позвонить
                        </a>
                      )}
                      {item.website && (
                        <a
                          href={item.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn btn-secondary"
                        >
                          🌐 Сайт
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getTabName(tabId) {
  const names = {
    shops: 'магазинов',
    services: 'сервисов',
    guides: 'гидов',
  };
  return names[tabId] || '';
}

function getCategoryLabel(category) {
  const labels = {
    shop: '🛒 Магазин',
    service: '🔧 Сервис',
    guide: '👨‍🏫 Гид',
  };
  return labels[category] || '';
}
