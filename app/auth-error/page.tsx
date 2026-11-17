import Link from "next/link";
import { AlertTriangle, ArrowLeft, Cpu, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { I18nText } from "@/components/i18n-text";
import { safeCallbackURL } from "@/lib/auth-redirect";

type AuthErrorPageProps = {
  searchParams?: Promise<{
    callbackURL?: string | string[];
    error?: string | string[];
  }>;
};

const authErrorCopy: Record<string, string> = {
  access_denied: "auth.error.accessDenied",
  account_not_linked: "auth.error.accountNotLinked",
  email_not_verified: "auth.error.emailNotVerified",
  invalid_organization: "auth.error.organization",
  email_not_found: "auth.error.missingEmail",
  email_does_not_match: "auth.error.emailMismatch",
  account_already_linked_to_different_user: "auth.error.alreadyLinked",
  unable_to_link_account: "auth.error.linkFailed",
  account_link_session_expired: "auth.error.linkFailed",
  unable_to_get_user_info: "auth.error.organization",
  state_not_found: "auth.error.expired",
  state_mismatch: "auth.error.expired",
  invalid_code: "auth.error.expired",
  invalid_token: "auth.error.expired",
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const params = await searchParams;
  const error = firstParam(params?.error);
  const callbackURL = safeCallbackURL(firstParam(params?.callbackURL));
  const messageKey = authErrorCopy[error ?? ""] ?? "auth.error.default";
  const loginHref = `/login?callbackURL=${encodeURIComponent(callbackURL)}`;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <Link className="flex items-center gap-3" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-foreground text-background">
            <Cpu className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold">AILAB</span>
            <span className="block text-xs text-muted-foreground">
              <I18nText textKey="common.secureWorkspace" />
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-6xl items-center justify-center px-4 pb-10 md:px-8">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-md border border-destructive/25 bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <CardTitle className="text-2xl"><I18nText textKey="auth.error.title" /></CardTitle>
            <CardDescription><I18nText textKey={messageKey} /></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                <I18nText textKey="auth.error.code" />: <span className="break-all font-medium">{error}</span>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1">
                <Link href={loginHref}>
                  <RefreshCw className="h-4 w-4" />
                  <I18nText textKey="auth.error.retry" />
                </Link>
              </Button>
              <Button asChild className="flex-1" variant="outline">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                  <I18nText textKey="auth.error.home" />
                </Link>
              </Button>
            </div>
            {error === "account_not_linked" && <Button asChild variant="link" className="h-auto w-full whitespace-normal text-center"><Link href="/login?callbackURL=%2Faccount"><I18nText textKey="auth.error.linkAccount" /></Link></Button>}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
