import { useState, useEffect } from 'react';
import { basesService } from '../services/basesService';

export const useFreePlaces = (opts = {}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const limit = opts.limit;

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const remote = await basesService.listPublic({
        type: 'free',
        ...(limit ? { limit } : {}),
      });
      setData(remote || []);
    } catch (err) {
      setError(err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  return { data, loading, error, refetch: load };
};
