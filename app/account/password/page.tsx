import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { MainLayout } from "@/components/MainLayout";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { I18nText } from "@/components/i18n-text";
import { getCurrentSession } from "@/lib/session";

export default async function AccountPasswordPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/login?callbackURL=%2Faccount%2Fpassword");
  return (
    <MainLayout>
      <div className="mx-auto max-w-md space-y-5">
        <Link href="/account" className="inline-flex min-h-11 items-center gap-2 text-sm underline-offset-4 hover:underline">
          <ArrowLeft className="h-4 w-4" /><I18nText textKey="auth.password.back" />
        </Link>
        <Suspense fallback={null}>
          <ForgotPasswordForm accountEmail={session.user.email} />
        </Suspense>
      </div>
    </MainLayout>
  );
}
