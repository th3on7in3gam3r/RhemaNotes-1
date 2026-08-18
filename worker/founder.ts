/** Project founders — configured in Cloudflare Worker secrets, not in source code. */
export interface FounderEnv {
  FOUNDER_CLERK_IDS?: string;
  FOUNDER_EMAILS?: string;
}

function parseCsv(value?: string): string[] {
  return (value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isFounderAccount(
  env: FounderEnv,
  userId: string,
  email?: string | null,
): boolean {
  const ids = parseCsv(env.FOUNDER_CLERK_IDS);
  if (ids.includes(userId)) return true;

  const normalizedEmail = email?.trim().toLowerCase();
  if (normalizedEmail) {
    const emails = parseCsv(env.FOUNDER_EMAILS).map((e) => e.toLowerCase());
    if (emails.includes(normalizedEmail)) return true;
  }

  return false;
}

export function emailFromClerkPayload(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.email === 'string' && payload.email.includes('@')) return payload.email;
  if (typeof payload.primary_email_address === 'string') return payload.primary_email_address;
  return undefined;
}
