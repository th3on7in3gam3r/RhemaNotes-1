import type { AuthResult } from './auth';

const cors = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

/** Which user_id may be listed on GET /api/sermons */
export function resolveSermonListUserId(
  auth: AuthResult,
  requestedUserId: string | null,
): { userId: string } | { error: Response } {
  const requested = requestedUserId || 'guest';

  if (auth.authenticated) {
    return { userId: auth.userId };
  }

  if (requested !== 'guest') {
    return {
      error: new Response(JSON.stringify({ error: 'Sign in required to load this library' }), {
        status: 401,
        headers: cors,
      }),
    };
  }

  return { userId: 'guest' };
}

/** PATCH/DELETE require a verified Clerk session (no X-User-Id spoofing). */
export function requireAuthenticatedSermonWriter(auth: AuthResult): { userId: string } | { error: Response } {
  if (!auth.authenticated || auth.userId === 'guest') {
    return {
      error: new Response(JSON.stringify({ error: 'Sign in required' }), {
        status: 401,
        headers: cors,
      }),
    };
  }
  return { userId: auth.userId };
}
