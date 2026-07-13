import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { ClerkBootstrap } from './components/ClerkBootstrap';
import { hydrateRuntimeConfig } from './services/runtimeConfig';

// Resolve Clerk key before React mounts (covers SW-served HTML without injection).
void hydrateRuntimeConfig();

let swRefreshing = false;

const updateSW = registerSW({
  onRegistered(registration) {
    registration?.update();
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registration?.update();
    });
  },
  onNeedRefresh() {
    updateSW(true);
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (swRefreshing) return;
    swRefreshing = true;
    window.location.reload();
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);

root.render(
  <React.StrictMode>
    <ClerkBootstrap>
      <App />
    </ClerkBootstrap>
  </React.StrictMode>
);