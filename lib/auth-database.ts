import { Pool } from "pg";

export const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://ailab:ailab_dev_password@localhost:5432/ailab";

const globalForAuthDatabase = globalThis as typeof globalThis & {
  authDatabasePool?: Pool;
};

export const authDatabasePool =
  globalForAuthDatabase.authDatabasePool ??
  new Pool({
    connectionString: databaseUrl,
  });

if (process.env.NODE_ENV !== "production") {
  globalForAuthDatabase.authDatabasePool = authDatabasePool;
}

export async function authUserExistsByEmail(email: string) {
  const result = await authDatabasePool.query(
    'select 1 from "user" where lower(email) = lower($1) limit 1',
    [email]
  );

  return (result.rowCount ?? 0) > 0;
}
