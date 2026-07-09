import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusTone = "neutral" | "success" | "warning" | "danger";

const toneClasses: Record<StatusTone, string> = {
  neutral: "border-border bg-background text-muted-foreground",
  success:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  warning:
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  danger: "border-red-500/25 bg-red-500/10 text-red-700 dark:text-red-300",
};

function StatusBadge({
  tone = "neutral",
  className,
  ...props
}: React.ComponentProps<typeof Badge> & { tone?: StatusTone }) {
  return (
    <Badge
      data-tone={tone}
      className={cn("gap-1.5", toneClasses[tone], className)}
      {...props}
    />
  );
}

export { StatusBadge };
export type { StatusTone };
