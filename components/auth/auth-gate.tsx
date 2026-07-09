"use client";

import { Loader2, LogOut, MailCheck, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useLanguage } from "@/components/language-provider";
import { authClient } from "@/lib/auth-client";

function callbackFor(pathname: string, search: string) {
  return `${pathname}${search ? `?${search}` : ""}`;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const { t } = useLanguage();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const callbackURL = callbackFor(pathname, searchParams.toString());
  const unverifiedEmail =
    session && !session.user.emailVerified ? session.user.email : "";

  useEffect(() => {
    if (isPending || session) {
      return;
    }
    router.replace(`/login?callbackURL=${encodeURIComponent(callbackURL)}`);
  }, [callbackURL, isPending, router, session]);

  async function resendVerificationEmail() {
    if (!unverifiedEmail) {
      return;
    }

    setResendError("");
    setResendMessage("");
    setIsResendingVerification(true);

    try {
      const result = await authClient.sendVerificationEmail({
        email: unverifiedEmail,
        callbackURL,
      });

      if (result.error) {
        setResendError(result.error.message || "Could not send verification email.");
        return;
      }

      setResendMessage("Verification link sent. Check your inbox.");
    } catch (authError) {
      setResendError(
        authError instanceof Error
          ? authError.message
          : "Could not send verification email."
      );
    } finally {
      setIsResendingVerification(false);
    }
  }

  if (isPending || !session) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("auth.gate.checking")}
        </div>
      </div>
    );
  }

  if (!session.user.emailVerified) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-foreground text-background">
              <MailCheck className="h-4 w-4" />
            </div>
            <CardTitle>Verify your email</CardTitle>
            <CardDescription>
              {t("auth.gate.verifyDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="break-all text-sm text-muted-foreground">
              {session.user.email}
            </p>
            {resendMessage && (
              <p className="rounded-md border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
                {resendMessage}
              </p>
            )}
            {resendError && (
              <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {resendError}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                disabled={isResendingVerification}
                onClick={resendVerificationEmail}
                type="button"
              >
                {isResendingVerification ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Resend link
              </Button>
              <Button
                onClick={async () => {
                  await authClient.signOut();
                  router.push("/login");
                  router.refresh();
                }}
                type="button"
                variant="outline"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
