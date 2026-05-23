"use client";

import { MoonStar, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeName = "light" | "dark";

function persistTheme(theme: ThemeName) {
  document.cookie = `theme=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  localStorage.setItem("theme", theme);
}

function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const nextTheme: ThemeName = resolvedTheme === "dark" ? "light" : "dark";

  return (
    <Button
      aria-label="Toggle theme"
      className={cn("shrink-0", className)}
      onClick={() => {
        persistTheme(nextTheme);
        setTheme(nextTheme);
      }}
      size="icon"
      variant="outline"
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-4 w-4" />
      ) : (
        <MoonStar className="h-4 w-4" />
      )}
    </Button>
  );
}

export { ThemeToggle };
