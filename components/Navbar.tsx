"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import { Moon, Sun, Cpu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

interface NavbarProps {
  mobileMenuButton?: React.ReactNode;
}

export function Navbar({ mobileMenuButton }: NavbarProps) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-16 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-black/80">
      <div className="flex h-full items-center justify-between px-4 md:px-6">
        {/* Left side - Mobile menu + Logo */}
        <div className="flex items-center gap-3">
          {mobileMenuButton}
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-900 dark:bg-white">
              <Cpu className="h-5 w-5 text-white dark:text-gray-900" />
            </div>
            <div className="hidden flex-col sm:flex">
              <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                Model Train
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                AI Training Platform
              </span>
            </div>
          </Link>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Theme Toggle */}
          {mounted && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? (
                <Sun className="h-5 w-5" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </Button>
          )}

          {/* Status indicator */}
          <div className="flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1.5 dark:border-gray-800">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="hidden text-xs font-medium text-gray-600 dark:text-gray-400 sm:inline">
              Ready
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
