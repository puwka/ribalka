import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import './index.css';
import App from './App.jsx';

registerSW({
  immediate: true,
  onNeedRefresh(updateSW) {
    // Apply new build without asking user to reinstall the PWA
    updateSW(true);
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
