"use client";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { cn } from "@/lib/utils";
import type { Language } from "@/lib/i18n";

const options: { value: Language; label: string; ariaLabel: string }[] = [
  { value: "en", label: "EN", ariaLabel: "Switch language to English" },
  { value: "th", label: "TH", ariaLabel: "Switch language to Thai" },
];

export function LanguageToggle({ className }: { className?: string }) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center rounded-md border border-input bg-background p-0.5",
        className,
      )}
      aria-label="Language selector"
    >
      {options.map((option) => (
        <Button
          key={option.value}
          aria-label={option.ariaLabel}
          aria-pressed={language === option.value}
          className={cn(
            "h-7 min-w-9 px-2 text-xs font-semibold",
            language === option.value
              ? "bg-foreground text-background hover:bg-foreground/90"
              : "bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
          onClick={() => setLanguage(option.value)}
          size="sm"
          type="button"
          variant="ghost"
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
