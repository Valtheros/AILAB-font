import { ShieldAlert, UsersRound } from "lucide-react";
import { redirect } from "next/navigation";
import { MainLayout } from "@/components/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/workspace/page-header";
import { authDatabasePool } from "@/lib/auth-database";
import { getRequiredAdminSession, getRequiredSession } from "@/lib/admin-auth";
import { AdminUsersClient, type AdminUserRow } from "./admin-users-client";

type AdminUsersPageProps = {
  searchParams?: Promise<{ q?: string | string[]; offset?: string | string[] }> | { q?: string | string[]; offset?: string | string[] };
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function normalizeOffset(value: string | string[] | undefined) {
  const parsed = Number(firstParam(value) ?? "0");
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

async function getAdminUsers({ limit, offset, search }: { limit: number; offset: number; search: string }) {
  const where = search
    ? 'where lower(u.email) like lower($1) or lower(u.name) like lower($1)'
    : '';
  const params = search ? [`%${search}%`, limit, offset] : [limit, offset];
  const limitIndex = search ? 2 : 1;
  const offsetIndex = search ? 3 : 2;

  const [usersResult, countResult] = await Promise.all([
    authDatabasePool.query<AdminUserRow>(
      `
        select
          u.id,
          u.name,
          u.email,
          u."emailVerified",
          coalesce(u.role, 'user') as role,
          coalesce(u.banned, false) as banned,
          u."banReason",
          u."banExpires",
          u."createdAt",
          u."updatedAt",
          count(s.id)::int as "sessionCount",
          (
            select count(*)::int
            from workspace_members wm
            where wm.user_id = u.id
          ) as "workspaceMembershipCount",
          (
            select count(*)::int
            from projects p
            where p.created_by in (u.id, u.email)
          ) as "projectCount",
          (
            select count(*)::int
            from datasets d
            where d.owner_user_id = u.id and d.status <> 'deleted'
          ) as "datasetCount",
          (
            select count(*)::int
            from training_runs tr
            where tr.owner_user_id = u.id
          ) as "trainingRunCount"
        from "user" u
        left join session s on s."userId" = u.id
        ${where}
        group by u.id
        order by u."createdAt" desc
        limit $${limitIndex} offset $${offsetIndex}
      `,
      params,
    ),
    authDatabasePool.query<{ total: string }>(
      `select count(*)::text as total from "user" u ${where}`,
      search ? [`%${search}%`] : [],
    ),
  ]);

  return {
    total: Number(countResult.rows[0]?.total ?? 0),
    users: usersResult.rows.map((user) => ({
      ...user,
      banExpires: user.banExpires ? new Date(user.banExpires).toISOString() : null,
      banned: Boolean(user.banned),
      createdAt: new Date(user.createdAt).toISOString(),
      datasetCount: Number(user.datasetCount ?? 0),
      emailVerified: Boolean(user.emailVerified),
      projectCount: Number(user.projectCount ?? 0),
      sessionCount: Number(user.sessionCount ?? 0),
      trainingRunCount: Number(user.trainingRunCount ?? 0),
      updatedAt: new Date(user.updatedAt).toISOString(),
      workspaceMembershipCount: Number(user.workspaceMembershipCount ?? 0),
    })),
  };
}

function AccessDenied() {
  return (
    <MainLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <PageHeader
          title="Access denied"
          description="Only system admins can manage authentication users and sessions."
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Admin role required
            </CardTitle>
            <CardDescription>
              Ask an existing admin to assign your account the admin role. Workspace roles do not grant system admin access.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <a href="/dashboard">Return to dashboard</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const session = await getRequiredSession("/admin/users");
  if (!session.user.emailVerified) {
    redirect("/account");
  }

  const adminSession = await getRequiredAdminSession("/admin/users");
  if (!adminSession) {
    return <AccessDenied />;
  }

  const resolvedSearchParams = await searchParams;
  const search = (firstParam(resolvedSearchParams?.q) ?? "").trim();
  const limit = 20;
  const offset = normalizeOffset(resolvedSearchParams?.offset);
  const { total, users } = await getAdminUsers({ limit, offset, search });

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="User management"
          description="Manage platform users, admin roles, verification state, bans, sessions, and account access."
        />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5" />
              Authentication Users
            </CardTitle>
            <CardDescription>
              System admin access is controlled by the Better Auth user role. Workspace roles are separate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AdminUsersClient
              currentUserId={adminSession.user.id}
              initialSearch={search}
              limit={limit}
              offset={offset}
              total={total}
              users={users}
            />
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
