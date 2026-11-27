import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { languageReady } from './i18n';
import './lib/gsap';
import './index.css';
import App from './App.tsx';
import { useAuthStore } from './store/authStore';
import { pullOrders, startOrderSync } from './lib/orderSync';
import { loadCatalog } from './lib/catalogSync';

// Align the mirrored session with the server, then start syncing orders with the API.
startOrderSync();
void useAuthStore.getState().refresh().then(pullOrders);

// Server prices and stock are in place before the first paint; if the API does not answer
// within 2.5 s the bundled catalog is shown and replaced when the response arrives.
// So is the visitor's language, when it is one whose dictionary is fetched.
void Promise.all([languageReady, Promise.race([loadCatalog(), new Promise((resolve) => window.setTimeout(resolve, 2500))])]).then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </StrictMode>,
  );
});
