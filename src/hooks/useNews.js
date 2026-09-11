import { useState, useEffect, useCallback } from 'react';
import { newsAdminService } from '../services/newsAdminService';
import { apiDataEnabled } from '../lib/apiClient';
import { newsData } from '../data/news';

export const useNews = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await newsAdminService.listPublic();
      // В API-режиме не подмешиваем сид — иначе «удалённые» новости возвращаются
      if (apiDataEnabled) {
        setData(Array.isArray(items) ? items : []);
      } else {
        setData(items?.length ? items : newsData);
      }
    } catch (err) {
      setError(err);
      setData(apiDataEnabled ? [] : newsData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refetch: load };
};
