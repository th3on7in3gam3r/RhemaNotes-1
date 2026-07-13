import React, { useEffect, useState } from 'react';
import { ClerkProvider } from '@clerk/react';
import { getClerkPublishableKey, hydrateRuntimeConfig } from '../services/runtimeConfig';

interface ClerkBootstrapProps {
  children: React.ReactNode;
}

/** Loads Clerk publishable key from Worker-injected HTML or /api/public-config. */
export const ClerkBootstrap: React.FC<ClerkBootstrapProps> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [publishableKey, setPublishableKey] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let key = getClerkPublishableKey();
      if (!key) {
        await hydrateRuntimeConfig();
        key = getClerkPublishableKey();
      }
      if (!cancelled) {
        setPublishableKey(key || '');
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-50/30">
        <p className="text-sm font-bold text-indigo-400 animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      {children}
    </ClerkProvider>
  );
};
