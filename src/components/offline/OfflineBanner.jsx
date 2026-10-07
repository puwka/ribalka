import { useEffect, useState } from 'react';
import './OfflineBanner.css';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="offline-banner" role="status">
      <strong>Нет сети</strong>
      <span>
        Доступны ранее открытые разделы, карта (кэш) и вызов{' '}
        <a href="tel:112">112</a> / SOS
      </span>
    </div>
  );
}
