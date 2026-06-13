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

type AuthErrorPageProps = {
  searchParams?: Promise<{
    callbackURL?: string | string[];
    error?: string | string[];
  }>;
};

const authErrorCopy: Record<string, { title: string; messageKey: string }> = {
  access_denied: {
    title: "Access was denied",
    messageKey: "auth.error.accessDenied",
  },
  account_not_linked: {
    title: "Account is not linked",
    messageKey: "auth.error.accountNotLinked",
  },
  email_not_verified: {
    title: "Email verification required",
    messageKey: "auth.error.emailNotVerified",
  },
};

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function safeCallbackURL(value: string | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard";
  }
  return value;
}

function errorCopy(error: string | undefined) {
  if (!error) {
    return {
      title: "Authentication error",
      messageKey: "auth.error.default",
    };
  }

  return (
    authErrorCopy[error] ?? {
      title: "Authentication error",
      messageKey: "auth.error.default",
    }
  );
}

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const params = await searchParams;
  const error = firstParam(params?.error);
  const callbackURL = safeCallbackURL(firstParam(params?.callbackURL));
  const copy = errorCopy(error);
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
            <CardTitle className="text-2xl">{copy.title}</CardTitle>
            <CardDescription><I18nText textKey={copy.messageKey} /></CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Error code: <span className="font-medium">{error}</span>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button asChild className="flex-1">
                <Link href={loginHref}>
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </Link>
              </Button>
              <Button asChild className="flex-1" variant="outline">
                <Link href="/">
                  <ArrowLeft className="h-4 w-4" />
                  Back home
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
