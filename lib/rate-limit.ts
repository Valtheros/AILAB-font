import { authDatabasePool } from "@/lib/auth-database";

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

let databaseReady: Promise<void> | null = null;

function memoryRateLimit({
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

async function ensureDatabaseTable() {
  databaseReady ??= authDatabasePool
    .query(`
      create table if not exists ailab_rate_limit (
        key text primary key,
        count integer not null,
        reset_at timestamptz not null
      )
    `)
    .then(() => undefined);
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
    return await databaseRateLimit(options);
  } catch {
    return memoryRateLimit(options);
  }
}
