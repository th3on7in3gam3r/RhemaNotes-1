import React, { useEffect, useState } from 'react';
import { ClerkProvider } from '@clerk/react';
import { getClerkPublishableKey, hydrateRuntimeConfig } from '../services/runtimeConfig';

interface ClerkBootstrapProps {
  children: React.ReactNode;
}

/** Loads Clerk publishable key from Worker before rendering auth UI. */
export const ClerkBootstrap: React.FC<ClerkBootstrapProps> = ({ children }) => {
  const [ready, setReady] = useState(Boolean(getClerkPublishableKey()));

  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    hydrateRuntimeConfig().finally(() => {
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-indigo-50/30">
        <p className="text-sm font-bold text-indigo-400 animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <ClerkProvider publishableKey={getClerkPublishableKey() || ''}>
      {children}
    </ClerkProvider>
  );
};
