import './WaterCatalogFilters.css';

export default function WaterCatalogFilters({
  query,
  onQueryChange,
  region,
  onRegionChange,
  regions,
  sort,
  onSortChange,
  count,
  total,
}) {
  const reset = () => {
    onQueryChange('');
    onRegionChange('');
    onSortChange('name');
  };

  return (
    <div className="water-filters">
      <div className="water-filters__row">
        <input
          type="search"
          className="water-filters__search"
          placeholder="Поиск по названию, рыбе, адресу…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Поиск водоёмов"
        />
        <select
          className="water-filters__select"
          value={region}
          onChange={(e) => onRegionChange(e.target.value)}
          aria-label="Регион"
        >
          <option value="">Все регионы</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          className="water-filters__select"
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          aria-label="Сортировка"
        >
          <option value="name">По названию</option>
        </select>
        {(query || region) && (
          <button type="button" className="btn btn--secondary water-filters__reset" onClick={reset}>
            Сбросить
          </button>
        )}
      </div>
      <p className="water-filters__count">
        Найдено <strong>{count}</strong> из {total}
      </p>
    </div>
  );
}
