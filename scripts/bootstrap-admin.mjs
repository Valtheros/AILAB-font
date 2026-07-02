import pg from "pg";

const { Pool } = pg;

const databaseUrl = process.env.DATABASE_URL;
const adminEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();

if (!databaseUrl) {
  console.error("DATABASE_URL is required.");
  process.exit(1);
}

if (!adminEmail) {
  console.error("ADMIN_BOOTSTRAP_EMAIL is required.");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });

try {
  const result = await pool.query(
    `
      update "user"
      set role = 'admin', "updatedAt" = now()
      where lower(email) = $1
      returning id, email, role
    `,
    [adminEmail],
  );

  if ((result.rowCount ?? 0) === 0) {
    console.error(`No user found for ADMIN_BOOTSTRAP_EMAIL=${adminEmail}. Sign up first, then rerun this command.`);
    process.exitCode = 1;
  } else {
    const user = result.rows[0];
    console.log(`Admin bootstrap complete: ${user.email} (${user.id}) role=${user.role}`);
  }
} finally {
  await pool.end();
}
