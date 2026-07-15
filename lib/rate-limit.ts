import { authDatabasePool } from "@/lib/auth-database";

type RateLimitBucket = {
  count: number;
  resetAt: number;
  touchedAt: number;
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

let databaseReady: Promise<void> | null = null;
let nextDatabaseAttemptAt = 0;
let lastCleanupAt = 0;
let fallbackLogged = false;
const MAX_MEMORY_BUCKETS = 10_000;
const CLEANUP_INTERVAL_MS = 60_000;
const DATABASE_RETRY_MS = 5_000;

function cleanupMemoryBuckets(now: number) {
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS && buckets.size < MAX_MEMORY_BUCKETS) return;
  lastCleanupAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size < MAX_MEMORY_BUCKETS) return;
  const oldest = [...buckets.entries()].sort((left, right) => left[1].touchedAt - right[1].touchedAt);
  for (const [key] of oldest.slice(0, buckets.size - MAX_MEMORY_BUCKETS + 1)) buckets.delete(key);
}

function memoryRateLimit({
  key,
  max,
  windowMs,
}: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  cleanupMemoryBuckets(now);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
      touchedAt: now,
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
  bucket.touchedAt = now;
  return { limited: false, retryAfter: 0 };
}

async function ensureDatabaseTable() {
  if (Date.now() < nextDatabaseAttemptAt) throw new Error("Rate-limit database retry is cooling down");
  databaseReady ??= authDatabasePool
    .query(`
      create table if not exists ailab_rate_limit (
        key text primary key,
        count integer not null,
        reset_at timestamptz not null
      )
    `)
    .then(() => {
      fallbackLogged = false;
      return undefined;
    })
    .catch((error) => {
      databaseReady = null;
      nextDatabaseAttemptAt = Date.now() + DATABASE_RETRY_MS;
      throw error;
    });
  return databaseReady;
}

async function databaseRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  await ensureDatabaseTable();
  const result = await authDatabasePool.query<{
    count: number;
    retry_after: number;
  }>(
    `
      insert into ailab_rate_limit (key, count, reset_at)
      values ($1, 1, now() + ($2::double precision * interval '1 millisecond'))
      on conflict (key) do update set
        count = case
          when ailab_rate_limit.reset_at <= now() then 1
          else ailab_rate_limit.count + 1
        end,
        reset_at = case
          when ailab_rate_limit.reset_at <= now()
            then now() + ($2::double precision * interval '1 millisecond')
          else ailab_rate_limit.reset_at
        end
      returning
        count,
        greatest(1, ceil(extract(epoch from reset_at - now())))::integer as retry_after
    `,
    [options.key, options.windowMs],
  );

  const row = result.rows[0];
  if (!row || row.count <= options.max) {
    return { limited: false, retryAfter: 0 };
  }
  return { limited: true, retryAfter: row.retry_after };
}

export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  if (process.env.AUTH_RATE_LIMIT_STORE === "memory") {
    return memoryRateLimit(options);
  }

  try {
    const result = await databaseRateLimit(options);
    if (fallbackLogged) console.info("Rate limiter reconnected to PostgreSQL.");
    fallbackLogged = false;
    return result;
  } catch (error) {
    if (!fallbackLogged) {
      console.warn("Rate limiter is using bounded memory fallback; PostgreSQL will be retried.", error);
      fallbackLogged = true;
    }
    return memoryRateLimit(options);
  }
}
