/**
 * Simple in-memory rate limiter for Worker isolate (resets on cold start).
 * Good enough to blunt quota abuse; upgrade to KV/Durable Object for strict limits.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }

  bucket.count += 1;

  if (bucket.count > maxRequests) {
    const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true };
}

export function clientRateLimitKey(request: Request, userId?: string): string {
  if (userId && userId !== 'guest') return `user:${userId}`;
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  return `ip:${ip}`;
}
