type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  key: string;
  max: number;
  windowMs: number;
};

type RateLimitResult =
  | {
      limited: false;
      retryAfter: 0;
    }
  | {
      limited: true;
      retryAfter: number;
    };

const globalForRateLimit = globalThis as typeof globalThis & {
  ailabRateLimitBuckets?: Map<string, RateLimitBucket>;
};

const buckets =
  globalForRateLimit.ailabRateLimitBuckets ?? new Map<string, RateLimitBucket>();

globalForRateLimit.ailabRateLimitBuckets = buckets;

export function checkRateLimit({
  key,
  max,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { limited: false, retryAfter: 0 };
  }

  if (bucket.count >= max) {
    return {
      limited: true,
      retryAfter: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { limited: false, retryAfter: 0 };
}
