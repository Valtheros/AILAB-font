"use client";

import Link from "next/link";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SessionMenu() {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <Button disabled size="sm" variant="outline">
        <UserRound className="h-4 w-4" />
        Session
      </Button>
    );
  }

  if (!session) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link href="/login">
          <LogIn className="h-4 w-4" />
          Sign in
        </Link>
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild className="hidden max-w-48 sm:inline-flex" size="sm" variant="outline">
        <Link href="/account">
          <UserRound className="h-4 w-4" />
          <span className="truncate">{session.user.name || session.user.email}</span>
        </Link>
      </Button>
      <Button
        aria-label="Sign out"
        onClick={async () => {
          await authClient.signOut();
          router.push("/login");
          router.refresh();
        }}
        size="icon"
        variant="outline"
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  );
}
