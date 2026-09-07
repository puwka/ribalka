import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.jsx';

registerSW({
  immediate: true,
  onNeedRefresh(updateSW) {
    updateSW(true);
  },
  onOfflineReady() {
    /* PWA ready */
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
