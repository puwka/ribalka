import { useEffect, useState } from 'react';
import { cmsService } from '../services/cmsService';

export function useCmsPage(pageKey) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const page = await cmsService.getPage(pageKey);
        if (!cancelled) setData(page);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageKey]);

  return { data, loading };
}

export function useCmsSettings() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const settings = await cmsService.getSettings();
        if (!cancelled) setData(settings);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}

export function useCmsFooter() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const footer = await cmsService.getFooter();
        if (!cancelled) setData(footer);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}

export function useCmsSeo(path) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seo = await cmsService.getSeoForPath(path);
      if (!cancelled) setData(seo);
    })();
    return () => {
      cancelled = true;
    };
  }, [path]);

  return data;
}
