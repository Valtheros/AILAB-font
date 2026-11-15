"use client";

import Link from "next/link";
import { Cpu } from "lucide-react";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeToggle } from "@/components/theme-toggle";

export function PublicHeader() {
  return <header className="border-b border-border bg-background">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-5 gap-y-3 px-5 py-4 sm:px-8">
      <Link href="/overview" className="flex min-h-11 items-center gap-2 font-semibold" aria-label="AILAB">
        <Cpu className="size-5" />AILAB
      </Link>
      <div className="flex items-center gap-2">
        <LanguageToggle /><ThemeToggle className="size-11" />
      </div>
    </div>
  </header>;
}
