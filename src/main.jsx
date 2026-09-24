import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);

/** Register PWA after first paint so SW/precache do not compete with load on slow mobile. */
function registerPwaWhenIdle() {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      const updateSW = registerSW({
        immediate: false,
        onNeedRefresh() {
          void updateSW(true);
        },
        onOfflineReady() {
          /* ready */
        },
        onRegisteredSW(_swUrl, registration) {
          if (!registration) return;
          const check = () => {
            registration.update().catch(() => {});
          };
          const hour = 60 * 60 * 1000;
          setInterval(check, hour);
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') check();
          });
          window.addEventListener('focus', check);
        },
      });

      if (typeof window !== 'undefined') {
        let refreshing = false;
        navigator.serviceWorker?.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      }
    })
    .catch(() => {});
}

if (typeof window !== 'undefined') {
  const run = () => registerPwaWhenIdle();
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 4000 });
  } else {
    window.addEventListener('load', () => setTimeout(run, 2000));
  }
}
