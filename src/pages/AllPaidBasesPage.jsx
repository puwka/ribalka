import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePaidBases } from '../hooks/usePaidBases';
import BaseCard, { BaseCardGridSkeleton } from '../components/BaseCard/BaseCard';
import WaterCatalogFilters from '../components/catalog/WaterCatalogFilters';
import './AllBasesPage.css';

export default function AllPaidBasesPage() {
  const { data: paidBases, loading, error } = usePaidBases();
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [sort, setSort] = useState('name');

  const regions = useMemo(() => {
    const set = new Set(paidBases.map((b) => b.region).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [paidBases]);

  const filtered = useMemo(() => {
    let list = [...paidBases];
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
  }, [paidBases, query, region, sort]);

  return (
    <div className="catalog-page">
      <div className="section-inner">
        <Link to="/" className="catalog-page__back">
          ← На главную
        </Link>
        <header className="section-head">
          <h1 className="section-head__title">Платные водоёмы</h1>
          <p className="section-head__desc">Базы и платные пруды Пермского края</p>
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
          total={paidBases.length}
        />

        {loading && <BaseCardGridSkeleton count={8} />}
        {error && (
          <div className="state-block">
            <p className="state-block__title">Ошибка загрузки</p>
          </div>
        )}
        {!loading && !filtered.length && (
          <div className="state-block">
            <p className="state-block__title">Ничего не найдено</p>
            <p className="state-block__text">Попробуйте изменить фильтры или сбросить поиск.</p>
          </div>
        )}
        {!loading && filtered.length > 0 && (
          <div className="catalog-page__grid">
            {filtered.map((base) => (
              <BaseCard key={base.id} item={base} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
