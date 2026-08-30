import { useState, useEffect } from 'react';
import { basesService } from '../services/basesService';

export const usePaidBases = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const remote = await basesService.listPublic({ type: 'paid' });
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
  }, []);

  return { data, loading, error, refetch: load };
};
