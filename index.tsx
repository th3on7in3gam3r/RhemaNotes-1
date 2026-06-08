import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { ClerkBootstrap } from './components/ClerkBootstrap';

const updateSW = registerSW({
  onRegistered(registration) {
    registration?.update();
  },
  onNeedRefresh() {
    updateSW(true);
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

root.render(
  <React.StrictMode>
    <ClerkBootstrap>
      <App />
    </ClerkBootstrap>
  </React.StrictMode>
);