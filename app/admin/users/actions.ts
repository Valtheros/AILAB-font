"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { authDatabasePool } from "@/lib/auth-database";
import { requireAdminForAction } from "@/lib/admin-auth";

export type AdminActionResult = { ok: true; message: string } | { ok: false; message: string };

function ok(message: string): AdminActionResult {
  return { ok: true, message };
}

function fail(error: unknown): AdminActionResult {
  return { ok: false, message: error instanceof Error ? error.message : String(error) };
}

function revalidateAdminUsers() {
  revalidatePath("/admin/users");
}

async function ensureTargetExists(userId: string) {
  const result = await authDatabasePool.query('select id from "user" where id = $1 limit 1', [userId]);
  if ((result.rowCount ?? 0) === 0) {
    throw new Error("User not found.");
  }
}

async function getUserDeleteImpact(userId: string) {
  const result = await authDatabasePool.query<{
    workspaceMemberships: number;
    projects: number;
    datasets: number;
    trainingRuns: number;
  }>(
    `
      select
        (
          select count(*)::int
          from workspace_members wm
          where wm.user_id = u.id
        ) as "workspaceMemberships",
        (
          select count(*)::int
          from projects p
          where p.created_by in (u.id, u.email)
        ) as projects,
        (
          select count(*)::int
          from datasets d
          where d.created_by in (u.id, u.email)
        ) as datasets,
        (
          select count(*)::int
          from training_runs tr
          where tr.created_by in (u.id, u.email)
        ) as "trainingRuns"
      from "user" u
      where u.id = $1
      limit 1
    `,
    [userId],
  );

  const impact = result.rows[0] ?? {
    workspaceMemberships: 0,
    projects: 0,
    datasets: 0,
    trainingRuns: 0,
  };
  const total =
    Number(impact.workspaceMemberships) +
    Number(impact.projects) +
    Number(impact.datasets) +
    Number(impact.trainingRuns);

  return { ...impact, total };
}

export async function setUserRoleAction(userId: string, role: "admin" | "user"): Promise<AdminActionResult> {
  try {
    const session = await requireAdminForAction();
    await ensureTargetExists(userId);

    if (session.user.id === userId && role !== "admin") {
      throw new Error("You cannot remove your own admin role.");
    }

    await authDatabasePool.query(
      'update "user" set role = $2, "updatedAt" = now() where id = $1',
      [userId, role],
    );
    revalidateAdminUsers();
    return ok(`Role changed to ${role}.`);
  } catch (error) {
    return fail(error);
  }
}

export async function setEmailVerifiedAction(userId: string, emailVerified: boolean): Promise<AdminActionResult> {
  try {
    await requireAdminForAction();
    await ensureTargetExists(userId);
    await authDatabasePool.query(
      'update "user" set "emailVerified" = $2, "updatedAt" = now() where id = $1',
      [userId, emailVerified],
    );
    revalidateAdminUsers();
    return ok(emailVerified ? "Email marked verified." : "Email marked unverified.");
  } catch (error) {
    return fail(error);
  }
}

export async function setUserBanAction(userId: string, banned: boolean, reason?: string): Promise<AdminActionResult> {
  try {
    const session = await requireAdminForAction();
    await ensureTargetExists(userId);

    if (session.user.id === userId && banned) {
      throw new Error("You cannot ban your own account.");
    }

    await authDatabasePool.query(
      'update "user" set banned = $2, "banReason" = $3, "banExpires" = null, "updatedAt" = now() where id = $1',
      [userId, banned, banned ? reason?.trim() || "Banned by admin" : null],
    );

    if (banned) {
      await authDatabasePool.query('delete from session where "userId" = $1', [userId]);
    }

    revalidateAdminUsers();
    return ok(banned ? "User banned and sessions revoked." : "User unbanned.");
  } catch (error) {
    return fail(error);
  }
}

export async function revokeUserSessionsAction(userId: string): Promise<AdminActionResult> {
  try {
    const session = await requireAdminForAction();
    await ensureTargetExists(userId);

    if (session.user.id === userId) {
      throw new Error("Use sign out to revoke your own session.");
    }

    const result = await authDatabasePool.query('delete from session where "userId" = $1', [userId]);
    revalidateAdminUsers();
    return ok(`Revoked ${result.rowCount ?? 0} session(s).`);
  } catch (error) {
    return fail(error);
  }
}

export async function removeUserAction(userId: string, acknowledgeImpact = false): Promise<AdminActionResult> {
  try {
    const session = await requireAdminForAction();
    await ensureTargetExists(userId);

    if (session.user.id === userId) {
      throw new Error("You cannot remove your own account.");
    }

    const impact = await getUserDeleteImpact(userId);
    if (impact.total > 0 && !acknowledgeImpact) {
      throw new Error(
        `This user still has ${impact.total} linked workspace record(s). Review the delete warning before removing the user.`,
      );
    }

    await authDatabasePool.query('delete from "user" where id = $1', [userId]);
    revalidateAdminUsers();
    return ok("User removed.");
  } catch (error) {
    return fail(error);
  }
}

export async function setUserPasswordAction(userId: string, newPassword: string): Promise<AdminActionResult> {
  try {
    await requireAdminForAction();
    await ensureTargetExists(userId);

    if (newPassword.length < 8) {
      throw new Error("Password must be at least 8 characters.");
    }

    const api = auth.api as unknown as {
      setUserPassword?: (input: { body: { userId: string; newPassword: string }; headers: Headers }) => Promise<unknown>;
    };

    if (!api.setUserPassword) {
      throw new Error("Better Auth setUserPassword API is not available.");
    }

    await api.setUserPassword({
      body: { userId, newPassword },
      headers: await headers(),
    });
    revalidateAdminUsers();
    return ok("Password updated.");
  } catch (error) {
    return fail(error);
  }
}
