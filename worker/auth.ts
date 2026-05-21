import { verifyToken } from '@clerk/backend';

export interface AuthResult {
  userId: string;
  authenticated: boolean;
}

export async function resolveAuth(
  request: Request,
  env: { CLERK_SECRET_KEY?: string },
): Promise<AuthResult> {
  const bearer = request.headers.get('Authorization');
  const token = bearer?.startsWith('Bearer ') ? bearer.slice(7) : null;

  if (token && env.CLERK_SECRET_KEY) {
    try {
      const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY });
      const userId = payload.sub;
      if (userId) return { userId, authenticated: true };
    } catch {
      // Invalid or expired token — fall through to guest rules
    }
  }

  const headerUser = request.headers.get('X-User-Id');
  const queryUser = new URL(request.url).searchParams.get('userId');
  const clientId = headerUser || queryUser || 'guest';

  return { userId: clientId, authenticated: false };
}

/** POST writes: authenticated users get verified id; guests may only write as guest */
export function enforceWriteUserId(auth: AuthResult, bodyUserId?: string): string {
  if (auth.authenticated) return auth.userId;
  return 'guest';
}
