import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.jsx';

/**
 * PWA updates: autoUpdate + periodic check.
 * Important: onNeedRefresh has NO args — updateSW is the return value of registerSW().
 */
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Force activate waiting worker (autoUpdate should also do this)
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

    // Mobile PWAs often don't re-check SW until hours later
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
