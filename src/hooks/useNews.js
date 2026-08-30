import { useState, useEffect } from 'react';
import { newsData } from '../data/news';
import { newsAdminService } from '../services/newsAdminService';

export const useNews = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await newsAdminService.listPublic();
      setData(items?.length ? items : newsData);
    } catch (err) {
      setError(err);
      setData(newsData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return { data, loading, error, refetch: load };
};
