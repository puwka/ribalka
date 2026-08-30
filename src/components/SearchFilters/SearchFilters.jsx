import { useState } from 'react';
import './SearchFilters.css';

export default function SearchFilters({ onFilterChange, totalItems }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({
    type: 'all', // all, paid, free
    fish: '',
    priceRange: 'all'
  });

  const handleSearch = (e) => {
    const value = e.target.value;
    setSearchQuery(value);
    onFilterChange({ ...filters, search: value });
  };

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange({ ...newFilters, search: searchQuery });
  };

  return (
    <div className="search-filters">
      <div className="search-filters__header">
        <h2>🔍 Поиск и фильтры</h2>
        <span className="results-count">Найдено: {totalItems}</span>
      </div>

      {/* Поиск */}
      <div className="filter-group">
        <label className="filter-label">Поиск по названию</label>
        <input
          type="text"
          placeholder="Например: Чусовая, хариус..."
          value={searchQuery}
          onChange={handleSearch}
          className="search-input-main"
        />
      </div>

      {/* Тип места */}
      <div className="filter-group">
        <label className="filter-label">Тип места</label>
        <div className="filter-options">
          <button
            className={`option-btn ${filters.type === 'all' ? 'active' : ''}`}
            onClick={() => handleFilterChange('type', 'all')}
          >
            Все
          </button>
          <button
            className={`option-btn ${filters.type === 'paid' ? 'active' : ''}`}
            onClick={() => handleFilterChange('type', 'paid')}
          >
            💎 Платные
          </button>
          <button
            className={`option-btn ${filters.type === 'free' ? 'active' : ''}`}
            onClick={() => handleFilterChange('type', 'free')}
          >
            🌲 Бесплатные
          </button>
        </div>
      </div>

      {/* Вид рыбы */}
      <div className="filter-group">
        <label className="filter-label">Вид рыбы</label>
        <select
          value={filters.fish}
          onChange={(e) => handleFilterChange('fish', e.target.value)}
          className="filter-select"
        >
          <option value="">Все виды</option>
          <option value="щука">Щука</option>
          <option value="окунь">Окунь</option>
          <option value="судак">Судак</option>
          <option value="хариус">Хариус</option>
          <option value="лещ">Лещ</option>
          <option value="карп">Карп</option>
          <option value="сом">Сом</option>
        </select>
      </div>

      {/* Диапазон цен */}
      <div className="filter-group">
        <label className="filter-label">Цена</label>
        <select
          value={filters.priceRange}
          onChange={(e) => handleFilterChange('priceRange', e.target.value)}
          className="filter-select"
        >
          <option value="all">Любая</option>
          <option value="low">до 1500 ₽</option>
          <option value="medium">1500 - 3000 ₽</option>
          <option value="high">от 3000 ₽</option>
        </select>
      </div>

      {/* Сбросить */}
      <button
        className="reset-filters-btn"
        onClick={() => {
          setFilters({ type: 'all', fish: '', priceRange: 'all' });
          setSearchQuery('');
          onFilterChange({ type: 'all', fish: '', priceRange: 'all', search: '' });
        }}
      >
        🔄 Сбросить фильтры
      </button>
    </div>
  );
}