import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFreePlaces } from '../hooks/useFreePlaces';
import BaseCard, { BaseCardGridSkeleton } from '../components/BaseCard/BaseCard';
import WaterCatalogFilters from '../components/catalog/WaterCatalogFilters';
import './AllBasesPage.css';

export default function AllFreePlacesPage() {
  const { data: freePlaces, loading, error } = useFreePlaces();
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState('name');

  const regions = useMemo(() => {
    const set = new Set(freePlaces.map((b) => b.region).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [freePlaces]);

  const filtered = useMemo(() => {
    let list = [...freePlaces];
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.short?.toLowerCase().includes(q) ||
          b.fish?.toLowerCase().includes(q) ||
          b.address?.toLowerCase().includes(q)
      );
    }
    if (region) list = list.filter((b) => b.region === region);
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return list;
  }, [freePlaces, query, region, sort]);

  return (
    <div className="catalog-page">
      <div className="section-inner">
        <Link to="/" className="catalog-page__back">
          ← На главную
        </Link>
        <header className="section-head">
          <h1 className="section-head__title">Бесплатные места</h1>
          <p className="section-head__desc">Дикая природа и бесплатная рыбалка в Прикамье</p>
        </header>

        <WaterCatalogFilters
          query={query}
          onQueryChange={setQuery}
          region={region}
          onRegionChange={setRegion}
          regions={regions}
          sort={sort}
          onSortChange={setSort}
          count={filtered.length}
          total={freePlaces.length}
        />

        {loading && <BaseCardGridSkeleton count={3} />}
        {error && (
          <div className="state-block">
            <p className="state-block__title">Ошибка загрузки</p>
          </div>
        )}
        {!loading && !filtered.length && (
          <div className="state-block">
            <p className="state-block__title">Ничего не найдено</p>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="catalog-page__grid">
            {filtered.map((place) => (
              <BaseCard key={place.id} item={place} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
