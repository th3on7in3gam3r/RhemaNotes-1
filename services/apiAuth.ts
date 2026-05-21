/** Clerk session token for authenticated API / Gemini proxy requests */
let tokenGetter: (() => Promise<string | null>) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null>): void {
  tokenGetter = getter;
}

export async function getAuthHeaders(extra?: Record<string, string>): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extra,
  };
  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (tokenGetter) {
    const token = await tokenGetter();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(input, { ...init, headers });
}
