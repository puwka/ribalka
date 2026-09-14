import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { directoryAdminService } from '../services/directoryAdminService';
import { DIRECTORY_CATEGORIES } from '../data/directorySeed';
import DirectoryCard from '../components/directory/DirectoryCard';
import { api, apiDataEnabled } from '../lib/apiClient';
import {
  collectRegions,
  getItemRegion,
  groupByRegion,
  sortDirectoryItems,
} from '../lib/directoryRegion';
import './DirectoryPage.css';

const TAB_TO_CATEGORY = Object.fromEntries(DIRECTORY_CATEGORIES.map((c) => [c.tab, c]));

export default function DirectoryCategoryPage() {
  const { tab } = useParams();
  const categoryMeta = TAB_TO_CATEGORY[tab];
  const [searchQuery, setSearchQuery] = useState('');
  const [region, setRegion] = useState('');
  const [items, setItems] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!categoryMeta) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const [list, dist] = await Promise.all([
          directoryAdminService.listPublic(),
          apiDataEnabled
            ? api.get('/api/cms/districts').catch(() => [])
            : Promise.resolve([]),
        ]);
        if (!alive) return;
        setItems((list || []).filter((i) => i.category === categoryMeta.id));
        setDistricts((dist || []).map((x) => x.name).filter(Boolean));
      } catch {
        if (alive) {
          setItems([]);
          setDistricts([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [categoryMeta]);

  const regions = useMemo(
    () => collectRegions(items, districts),
    [items, districts]
  );

  const filtered = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    let list = items.filter((item) => {
      if (region && getItemRegion(item) !== region) return false;
      if (!query) return true;
      const tags = Array.isArray(item.tags) ? item.tags : [];
      const hay = [
        item.name,
        item.description,
        item.address,
        getItemRegion(item),
        ...tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
    return sortDirectoryItems(list, { byRegion: true });
  }, [items, searchQuery, region]);

  const groups = useMemo(() => groupByRegion(filtered), [filtered]);

  if (!categoryMeta) {
    return <Navigate to="/directory" replace />;
  }

  const resetFilters = () => {
    setSearchQuery('');
    setRegion('');
  };

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
        <p>Все предложения категории в Пермском крае — с фильтром по районам</p>
      </div>

      <div className="directory-container">
        <div className="directory-tabs" role="tablist" aria-label="Категории справочника">
          {DIRECTORY_CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              to={`/directory/${cat.tab}`}
              role="tab"
              aria-selected={cat.tab === tab}
              className={`directory-tab ${cat.tab === tab ? 'is-active' : ''}`}
            >
              {cat.label}
            </Link>
          ))}
        </div>

        <div className="directory-filters">
          <input
            type="text"
            placeholder="Поиск по названию, району, описанию…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            aria-label="Поиск"
          />
          <select
            className="directory-filters__region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            aria-label="Район"
          >
            <option value="">Все районы</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="directory-count">
          Найдено: <strong>{filtered.length}</strong>
          {region ? (
            <>
              {' '}
              в районе <strong>{region}</strong>
            </>
          ) : null}
        </div>

        {loading ? (
          <div className="no-results">
            <p>Загрузка…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="no-results">
            <span className="no-results-icon">🔍</span>
            <p>Ничего не найдено</p>
            <button type="button" className="reset-btn" onClick={resetFilters}>
              Сбросить фильтры
            </button>
          </div>
        ) : (
          <div className="directory-region-groups">
            {groups.map((group) => (
              <section key={group.region} className="directory-region-group">
                <h2 className="directory-region-group__title">
                  <span className="directory-region-group__pin" aria-hidden>
                    📍
                  </span>
                  {group.region}
                  <span className="directory-region-group__count">{group.items.length}</span>
                </h2>
                <div className="directory-grid">
                  {group.items.map((item) => (
                    <DirectoryCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="directory-place-cta">
          <h2>Хотите разместить свою карточку?</h2>
          <p>
            Добавление, оплата и продление — в кабинете владельца. На публичной странице только
            каталог.
          </p>
          <div className="directory-place-cta__actions">
            <Link className="btn btn--primary" to="/directory#directory-pricing">
              Перейти к размещению
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
