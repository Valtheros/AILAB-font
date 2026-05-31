"use client";

import Link from "next/link";
import { Cpu } from "lucide-react";
import { BackendStatusBadge } from "@/components/workspace/backend-status-badge";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavbarProps {
  mobileMenuButton?: React.ReactNode;
}

export function Navbar({ mobileMenuButton }: NavbarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-16 border-b border-border bg-background/90 backdrop-blur">
      <div className="flex h-full items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {mobileMenuButton}
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-foreground text-background">
              <Cpu className="h-4 w-4" />
            </div>
            <div className="hidden min-w-0 sm:block">
              <p className="truncate text-sm font-semibold">Vision Console</p>
              <p className="truncate text-xs text-muted-foreground">
                CV training workspace
              </p>
            </div>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <BackendStatusBadge />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
