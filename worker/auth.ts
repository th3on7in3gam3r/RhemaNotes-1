import { verifyToken } from '@clerk/backend';
import { emailFromClerkPayload, isFounderAccount, type FounderEnv } from './founder';
import { upsertUserTier } from './stripeTier';

export interface AuthResult {
  userId: string;
  authenticated: boolean;
  tier: 'free' | 'pro' | 'church';
  email?: string;
}

export type AuthEnv = FounderEnv & {
  CLERK_SECRET_KEY?: string;
  DB?: D1Database;
};

export async function resolveAuth(request: Request, env: AuthEnv): Promise<AuthResult> {
  const bearer = request.headers.get('Authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null;
  let userId = 'guest';
  let authenticated = false;
  let email: string | undefined;

  if (token && env.CLERK_SECRET_KEY) {
    try {
      const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
      if (payload.sub) {
        userId = payload.sub;
        authenticated = true;
        email = emailFromClerkPayload(payload as Record<string, unknown>);
      }
    } catch {
      // JWT invalid or expired — user may still be "signed in" in UI but server rejects token
    }
  }

  if (!authenticated) {
    userId = 'guest';
  }

  let tier: AuthResult['tier'] = 'free';
  if (authenticated && env.DB) {
    try {
      const row = await env.DB.prepare('SELECT tier, email FROM users WHERE id = ?')
        .bind(userId)
        .first<{ tier: string; email: string }>();
      if (row?.email && !email) email = row.email;
      if (row?.tier === 'pro' || row?.tier === 'church') {
        tier = row.tier;
      }
    } catch {
      /* D1 unavailable or schema mismatch */
    }

    if (tier === 'free' && isFounderAccount(env, userId, email)) {
      tier = 'church';
      try {
        await upsertUserTier(env.DB, userId, 'church', email || '');
      } catch {
        /* non-fatal — tier still returned for this request */
      }
    }
  }

  return { userId, authenticated, tier, email };
}

/** POST writes: authenticated users get verified id; guests may only write as guest */
export function enforceWriteUserId(auth: AuthResult, _bodyUserId?: string): string {
  if (auth.authenticated) return auth.userId;
  return 'guest';
}

export function isPaidTier(tier: AuthResult['tier']): boolean {
  return tier === 'pro' || tier === 'church';
}
