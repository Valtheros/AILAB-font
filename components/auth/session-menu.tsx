"use client";

import Link from "next/link";
import { LogIn, LogOut, Undo2, UserRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient, signOutToHome } from "@/lib/auth-client";
import { useLanguage } from "@/components/language-provider";
import { authHref } from "@/lib/auth-redirect";

export function SessionMenu() {
  const router = useRouter();
  const { t } = useLanguage();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <Button disabled size="icon" variant="outline" aria-label={t("auth.gate.checking")}>
        <UserRound className="h-4 w-4" />
      </Button>
    );
  }

  if (!session) {
    return (
      <Button asChild size="sm" variant="outline" className="min-h-10">
        <Link href={authHref("login", `${pathname}${search ? `?${search}` : ""}`)}>
          <LogIn className="h-4 w-4" />
          {t("public.login")}
        </Link>
      </Button>
    );
  }

  const impersonatedBy = (session.session as { impersonatedBy?: string | null } | undefined)?.impersonatedBy;

  return (
    <div className="flex items-center gap-2">
      <Button asChild className="hidden max-w-48 sm:inline-flex" size="sm" variant="outline">
        <Link href="/account">
          <UserRound className="h-4 w-4" />
          <span className="truncate">{session.user.name || session.user.email}</span>
        </Link>
      </Button>
      {impersonatedBy && (
        <Button
          aria-label="Stop impersonating"
          onClick={async () => {
            const adminApi = (authClient as unknown as {
              admin?: { stopImpersonating?: () => Promise<{ error?: { message?: string } | null }> };
            }).admin;
            await adminApi?.stopImpersonating?.();
            router.push("/admin/users");
            router.refresh();
          }}
          size="icon"
          variant="outline"
        >
          <Undo2 className="h-4 w-4" />
        </Button>
      )}
      <Button
        aria-label={t("public.signout")}
        onClick={signOutToHome}
        size="icon"
        variant="outline"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
