import { useCallback, useEffect, useMemo, useState } from 'react';
import { basesService } from '../services/basesService';
import {
  WATER_TYPE,
  enrichWaterItem,
  filterWaters,
  matchesWaterSearch,
  sortWaters,
} from '../lib/waterUtils';

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const DEFAULT_FILTERS = {
  region: '',
  kind: '',
  priceMin: '',
  priceMax: '',
};

export function useWaterCatalog(waterType) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [sortBy, setSortBy] = useState('name');

  const debouncedQuery = useDebounced(query);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await basesService.listPublic({ type: waterType });
      setItems((rows || []).map(enrichWaterItem));
    } catch (err) {
      setError(err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [waterType]);

  useEffect(() => {
    load();
  }, [load]);

  const regions = useMemo(() => {
    const set = new Set(items.map((i) => i.region).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [items]);

  const kinds = useMemo(() => {
    const set = new Set(items.map((i) => i.waterKind).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [items]);

  const filtered = useMemo(() => {
    let list = items.filter((item) => matchesWaterSearch(item, debouncedQuery));
    list = filterWaters(list, {
      region: filters.region || undefined,
      kind: filters.kind || undefined,
      priceMin: filters.priceMin !== '' ? Number(filters.priceMin) : undefined,
      priceMax: filters.priceMax !== '' ? Number(filters.priceMax) : undefined,
    });
    return sortWaters(list, sortBy, waterType);
  }, [items, debouncedQuery, filters, sortBy, waterType]);

  const resetFilters = () => {
    setQuery('');
    setFilters(DEFAULT_FILTERS);
    setSortBy('name');
  };

  const hasActiveFilters =
    Boolean(query.trim()) ||
    Boolean(filters.region) ||
    Boolean(filters.kind) ||
    filters.priceMin !== '' ||
    filters.priceMax !== '';

  return {
    items,
    filtered,
    loading,
    error,
    query,
    setQuery,
    filters,
    setFilters,
    sortBy,
    setSortBy,
    regions,
    kinds,
    resetFilters,
    hasActiveFilters,
    reload: load,
    isPaid: waterType === WATER_TYPE.PAID,
  };
}
