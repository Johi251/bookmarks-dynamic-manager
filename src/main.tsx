import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { storageKind } from './storage';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

// Service Worker nur im Produktiv-Web-Build (Offline-PWA) — nicht im Add-on/Desktop.
if (import.meta.env.PROD && storageKind() === 'local' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}
