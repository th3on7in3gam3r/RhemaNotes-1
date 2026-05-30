import { verifyToken } from '@clerk/backend';

export interface AuthResult {
  userId: string;
  authenticated: boolean;
  tier: 'free' | 'pro' | 'church';
}

export async function resolveAuth(
  request: Request,
  env: { CLERK_SECRET_KEY?: string; DB?: D1Database },
): Promise<AuthResult> {
  const bearer = request.headers.get('Authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null;
  let userId = 'guest';
  let authenticated = false;

  if (token && env.CLERK_SECRET_KEY) {
    try {
      // Do not pass authorizedParties — tokens must verify for any Clerk session on this instance.
      // (Restricting by Origin alone caused signed-in paid users to be treated as guests.)
      const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
      if (payload.sub) {
        userId = payload.sub;
        authenticated = true;
      }
    } catch {
      // JWT invalid or expired — user may still be "signed in" in UI but server rejects token
    }
  }

  if (!authenticated) {
    const headerUser = request.headers.get('X-User-Id');
    const queryUser = new URL(request.url).searchParams.get('userId');
    userId = headerUser || queryUser || 'guest';
  }

  let tier: AuthResult['tier'] = 'free';
  if (authenticated && env.DB) {
    try {
      const row = await env.DB.prepare('SELECT tier FROM users WHERE id = ?')
        .bind(userId)
        .first<{ tier: string }>();
      if (row?.tier === 'pro' || row?.tier === 'church') {
        tier = row.tier;
      }
    } catch {
      /* D1 unavailable */
    }
  }

  return { userId, authenticated, tier };
}

/** POST writes: authenticated users get verified id; guests may only write as guest */
export function enforceWriteUserId(auth: AuthResult, _bodyUserId?: string): string {
  if (auth.authenticated) return auth.userId;
  return 'guest';
}

export function isPaidTier(tier: AuthResult['tier']): boolean {
  return tier === 'pro' || tier === 'church';
}
