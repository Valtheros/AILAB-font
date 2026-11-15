"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { authHref } from "@/lib/auth-redirect";
import { cn } from "@/lib/utils";

export function WorkspaceAction({ href, children, variant = "default", className }: {
  href: string;
  children: React.ReactNode;
  variant?: "default" | "outline";
  className?: string;
}) {
  const { data: session, isPending } = authClient.useSession();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const target = pathname === href && search ? `${href}?${search}` : href;
  const classes = cn("h-auto min-h-11 whitespace-normal text-left", className);
  if (isPending) return <Button disabled variant={variant} className={classes}>{children}<ArrowRight className="size-4 shrink-0" /></Button>;
  return <Button asChild variant={variant} className={classes}>
    <Link href={session ? target : authHref("login", target)}>{children}<ArrowRight className="size-4 shrink-0" /></Link>
  </Button>;
}
