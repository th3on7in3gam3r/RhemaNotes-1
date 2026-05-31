import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { ClerkProvider } from '@clerk/react';
import { isClerkConfigured, CLERK_PUBLISHABLE_KEY } from './components/AuthNav';

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

if (!isClerkConfigured) {
  console.error(
    'VITE_CLERK_PUBLISHABLE_KEY is missing from the build. Sign-in buttons will not work until you rebuild with that variable in .env.local or Cloudflare build settings.',
  );
}

root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY || ''}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);