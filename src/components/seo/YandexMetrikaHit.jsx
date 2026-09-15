import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

const METRIKA_ID = 112648308;

/** Send SPA page hits to Yandex.Metrika on client-side route changes. */
export default function YandexMetrikaHit() {
  const location = useLocation();
  const first = useRef(true);

  useEffect(() => {
    // First paint is already tracked by init({ url: location.href })
    if (first.current) {
      first.current = false;
      return;
    }
    const url = `${location.pathname}${location.search}${location.hash}`;
    try {
      if (typeof window.ym === 'function') {
        window.ym(METRIKA_ID, 'hit', url, {
          title: document.title,
          referer: document.referrer,
        });
      }
    } catch {
      /* ignore */
    }
  }, [location.pathname, location.search, location.hash]);

  return null;
}
