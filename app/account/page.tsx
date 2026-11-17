import { redirect } from "next/navigation";
import { MainLayout } from "@/components/MainLayout";
import { ChangePasswordForm } from "@/components/auth/change-password-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import { I18nText } from "@/components/i18n-text";
import { getCurrentSession } from "@/lib/session";
import { StorageUsage } from "@/components/storage-usage";
import { LoginMethods } from "@/components/auth/login-methods";
import { microsoftAuthEnabled } from "@/lib/auth";
import { getUserLoginMethods } from "@/lib/auth-database";

export default async function AccountPage() {
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login?callbackURL=/account");
  }
  const loginMethods = await getUserLoginMethods(session.user.id);

  return (
    <MainLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <PageHeader
          title="User workspace"
          description={<I18nText textKey="account.header.description" />}
        />
        <Card>
          <CardHeader>
            <CardTitle>Signed in user</CardTitle>
            <CardDescription><I18nText textKey="account.profile.description" /></CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border border-border p-4">
              <p className="text-xs uppercase text-muted-foreground">Name</p>
              <p className="mt-2 break-words text-sm font-medium">{session.user.name || "Not set"}</p>
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="text-xs uppercase text-muted-foreground">Email</p>
              <p className="mt-2 break-words text-sm font-medium">{session.user.email}</p>
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="text-xs uppercase text-muted-foreground">Email status</p>
              <div className="mt-2">
                <StatusBadge tone={session.user.emailVerified ? "success" : "warning"}>
                  {session.user.emailVerified ? "Verified" : "Pending verification"}
                </StatusBadge>
              </div>
            </div>
          </CardContent>
        </Card>
        <StorageUsage />
        <LoginMethods microsoftEnabled={microsoftAuthEnabled} {...loginMethods} />
        {loginMethods.hasPassword && <ChangePasswordForm />}
      </div>
    </MainLayout>
  );
}
