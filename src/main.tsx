import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { storageKind } from './storage';
import { prepareOffline } from './offline';
import './styles.css';

const render = () => createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

prepareOffline(import.meta.env.PROD && storageKind() === 'local')
  .then((ready) => { if (ready) render(); })
  .catch(() => render());
