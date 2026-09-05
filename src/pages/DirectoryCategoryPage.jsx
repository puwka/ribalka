import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { directoryAdminService } from '../services/directoryAdminService';
import { DIRECTORY_CATEGORIES } from '../data/directorySeed';
import DirectoryCard from '../components/directory/DirectoryCard';
import DirectoryPricingForm from '../components/directory/DirectoryPricingForm';
import './DirectoryPage.css';

const TAB_TO_CATEGORY = Object.fromEntries(DIRECTORY_CATEGORIES.map((c) => [c.tab, c]));

export default function DirectoryCategoryPage() {
  const { tab } = useParams();
  const categoryMeta = TAB_TO_CATEGORY[tab];
  const [searchQuery, setSearchQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!categoryMeta) return undefined;
    let alive = true;
    (async () => {
      try {
        const list = await directoryAdminService.listPublic();
        if (!alive) return;
        setItems(list.filter((i) => i.category === categoryMeta.id));
      } catch {
        if (alive) setItems([]);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [categoryMeta]);

  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return items;
    return items.filter((item) => {
      const tags = Array.isArray(item.tags) ? item.tags : [];
      return (
        (item.name || '').toLowerCase().includes(query) ||
        (item.description || '').toLowerCase().includes(query) ||
        tags.some((tag) => String(tag).toLowerCase().includes(query))
      );
    });
  }, [items, searchQuery]);

  if (!categoryMeta) {
    return <Navigate to="/directory" replace />;
  }

  return (
    <div className="directory-page">
      <div className="directory-header">
        <p className="directory-breadcrumb">
          <Link to="/directory">Справочник</Link>
          <span> / </span>
          <span>
            {categoryMeta.emoji} {categoryMeta.label}
          </span>
        </p>
        <h1>
          {categoryMeta.emoji} {categoryMeta.label}
        </h1>
        <p>Все предложения категории в Пермском крае</p>
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

        <div className="directory-count">
          Найдено: <strong>{filtered.length}</strong>
        </div>

        {loading ? (
          <div className="no-results">
            <p>Загрузка…</p>
          </div>
        ) : (
          <div className="directory-grid">
            {filtered.length === 0 ? (
              <div className="no-results">
                <span className="no-results-icon">🔍</span>
                <p>Ничего не найдено</p>
                <button type="button" className="reset-btn" onClick={() => setSearchQuery('')}>
                  Сбросить поиск
                </button>
              </div>
            ) : (
              filtered.map((item) => <DirectoryCard key={item.id} item={item} />)
            )}
          </div>
        )}

        <DirectoryPricingForm defaultKind={categoryMeta.id === 'service' ? 'service' : 'constructor'} />
      </div>
    </div>
  );
}
