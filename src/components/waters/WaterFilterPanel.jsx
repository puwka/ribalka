import { useState } from 'react';
import './WaterFilterPanel.css';

export default function WaterFilterPanel({
  isPaid,
  query,
  onQueryChange,
  filters,
  onFiltersChange,
  sortBy,
  onSortChange,
  regions,
  kinds,
  onReset,
  hasActiveFilters,
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const panel = (
    <div className="water-filters-panel">
      <input
        type="search"
        className="water-filters-panel__search"
        placeholder="Поиск по названию, региону, населённому пункту…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label="Поиск водоёмов"
      />
      <select
        className="water-filters-panel__select"
        value={filters.region}
        onChange={(e) => onFiltersChange({ ...filters, region: e.target.value })}
        aria-label="Регион"
      >
        <option value="">Все регионы</option>
        {regions.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {kinds.length > 1 && (
        <select
          className="water-filters-panel__select"
          value={filters.kind}
          onChange={(e) => onFiltersChange({ ...filters, kind: e.target.value })}
          aria-label="Тип водоёма"
        >
          <option value="">Все типы</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      )}
      {isPaid && (
        <>
          <input
            type="number"
            className="water-filters-panel__price"
            placeholder="Цена от"
            value={filters.priceMin}
            onChange={(e) => onFiltersChange({ ...filters, priceMin: e.target.value })}
            min={0}
            aria-label="Цена от"
          />
          <input
            type="number"
            className="water-filters-panel__price"
            placeholder="Цена до"
            value={filters.priceMax}
            onChange={(e) => onFiltersChange({ ...filters, priceMax: e.target.value })}
            min={0}
            aria-label="Цена до"
          />
        </>
      )}
      <select
        className="water-filters-panel__select"
        value={sortBy}
        onChange={(e) => onSortChange(e.target.value)}
        aria-label="Сортировка"
      >
        <option value="name">По названию</option>
        {isPaid && <option value="price">По цене</option>}
        <option value="region">По региону</option>
      </select>
      {hasActiveFilters && (
        <button type="button" className="btn btn--secondary" onClick={onReset}>
          Сбросить
        </button>
      )}
    </div>
  );

  return (
    <div className="water-filters-wrap">
      <button
        type="button"
        className="water-filters-mobile-toggle btn btn--secondary"
        onClick={() => setDrawerOpen(true)}
      >
        Фильтры и сортировка
      </button>
      <div className="water-filters-desktop">{panel}</div>
      {drawerOpen && (
        <>
          <button
            type="button"
            className="water-filters-drawer__scrim"
            aria-label="Закрыть"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="water-filters-drawer">
            <div className="water-filters-drawer__head">
              <strong>Фильтры</strong>
              <button type="button" onClick={() => setDrawerOpen(false)}>
                Закрыть
              </button>
            </div>
            {panel}
            <button
              type="button"
              className="btn btn--primary water-filters-drawer__apply"
              onClick={() => setDrawerOpen(false)}
            >
              Показать результаты
            </button>
          </div>
        </>
      )}
    </div>
  );
}
