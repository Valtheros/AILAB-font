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

export async function getUserLoginMethods(userId: string) {
  const { rows } = await authDatabasePool.query<{ id: string; providerId: string; hasPassword: boolean }>(
    'select id, "providerId", password is not null as "hasPassword" from account where "userId" = $1', [userId],
  );
  return {
    microsoftAccountId: rows.find(row => row.providerId === "microsoft")?.id ?? null,
    hasPassword: rows.some(row => row.providerId === "credential" && row.hasPassword),
  };
}
