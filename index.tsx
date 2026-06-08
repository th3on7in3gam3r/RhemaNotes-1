import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { ClerkBootstrap } from './components/ClerkBootstrap';
import { isClerkConfigured } from './services/runtimeConfig';

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true);
    }
  },
  onOfflineReady() {
    console.log('App is ready to work offline');
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);

if (!isClerkConfigured()) {
  console.error(
    'Clerk publishable key missing. Set VITE_CLERK_PUBLISHABLE_KEY for local builds or CLERK_PUBLISHABLE_KEY on the Cloudflare Worker.',
  );
}

root.render(
  <React.StrictMode>
    <ClerkBootstrap>
      <App />
    </ClerkBootstrap>
  </React.StrictMode>
);