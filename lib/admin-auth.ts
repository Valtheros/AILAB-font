import { redirect } from "next/navigation";
import { authDatabasePool } from "@/lib/auth-database";
import { getCurrentSession } from "@/lib/session";

export type AdminRole = "admin" | "user";

export type AdminSession = NonNullable<Awaited<ReturnType<typeof getCurrentSession>>> & {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentSession>>>["user"] & {
    role?: string | null;
    banned?: boolean | null;
  };
};

export async function getUserAdminState(userId: string) {
  const result = await authDatabasePool.query<{ role: string | null; banned: boolean | null }>(
    'select role, banned from "user" where id = $1 limit 1',
    [userId],
  );

  return result.rows[0] ?? null;
}

export async function isUserAdmin(userId: string) {
  const state = await getUserAdminState(userId);
  return state?.role === "admin" && state.banned !== true;
}

export async function getRequiredSession(callbackURL = "/dashboard") {
  const session = await getCurrentSession();
  if (!session) {
    redirect(`/login?callbackURL=${encodeURIComponent(callbackURL)}`);
  }
  return session as AdminSession;
}

export async function getRequiredAdminSession(callbackURL = "/admin/users") {
  const session = await getRequiredSession(callbackURL);
  if (!(await isUserAdmin(session.user.id))) {
    return null;
  }
  return session;
}

export async function requireAdminForAction() {
  const session = await getCurrentSession();
  if (!session) {
    throw new Error("Sign in before using admin actions.");
  }

  if (!(await isUserAdmin(session.user.id))) {
    throw new Error("Admin access is required.");
  }

  return session as AdminSession;
}
