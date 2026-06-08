declare global {
  interface Window {
    __RHEMA_RUNTIME__?: {
      clerkPublishableKey?: string;
    };
  }
}

let cachedClerkKey: string | undefined;

/** Clerk publishable key: Vite build env → Worker-injected script → /api/public-config */
export function getClerkPublishableKey(): string | undefined {
  if (cachedClerkKey?.startsWith('pk_')) return cachedClerkKey;

  const fromBuild = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string | undefined;
  if (fromBuild?.startsWith('pk_')) {
    cachedClerkKey = fromBuild;
    return fromBuild;
  }

  const fromRuntime = window.__RHEMA_RUNTIME__?.clerkPublishableKey;
  if (typeof fromRuntime === 'string' && fromRuntime.startsWith('pk_')) {
    cachedClerkKey = fromRuntime;
    return fromRuntime;
  }

  return undefined;
}

export function isClerkConfigured(): boolean {
  return Boolean(getClerkPublishableKey());
}

/** Fetch Clerk key from Worker when HTML injection was skipped (cached static index). */
export async function hydrateRuntimeConfig(): Promise<void> {
  if (isClerkConfigured()) return;

  try {
    const res = await fetch('/api/public-config');
    if (!res.ok) return;
    const data = (await res.json()) as { clerkPublishableKey?: string | null };
    if (data.clerkPublishableKey?.startsWith('pk_')) {
      window.__RHEMA_RUNTIME__ = {
        ...window.__RHEMA_RUNTIME__,
        clerkPublishableKey: data.clerkPublishableKey,
      };
      cachedClerkKey = data.clerkPublishableKey;
    }
  } catch {
    /* offline or worker unavailable */
  }
}
