import { ApiError } from '@/lib/route';

const buckets = new Map<string, { count: number; resetAt: number }>();

// Per-process limiter; enough to slow down guessing on a single backend instance.
export function rateLimit(request: Request, scope: string, max: number, windowMs: number) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
  const key = `${scope}:${ip}`;
  const now = Date.now();

  if (buckets.size > 5000) {
    for (const [k, b] of buckets) if (b.resetAt < now) buckets.delete(k);
  }

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > max) {
    throw new ApiError(429, 'For mange forsøg. Prøv igen om lidt.');
  }
}
