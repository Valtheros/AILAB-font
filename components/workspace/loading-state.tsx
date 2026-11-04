import { LoaderCircle, type LucideIcon } from "lucide-react";

type LoadingProgress = {
  current: number;
  total: number;
  unit: string;
  skipped?: number;
  skippedLabel?: string;
};

export function LoadingState({
  icon: Icon,
  title,
  description,
  progress,
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  progress?: LoadingProgress;
  compact?: boolean;
}) {
  const hasTotal = Boolean(progress && Number.isFinite(progress.total) && progress.total > 0);
  const current = hasTotal && progress && Number.isFinite(progress.current)
    ? Math.min(Math.max(progress.current, 0), progress.total)
    : 0;
  const percent = hasTotal && progress ? Math.round(current / progress.total * 100) : undefined;

  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center px-4 text-center ${compact ? "min-h-36 py-6" : "min-h-64 py-10"}`}>
      <div className="relative mb-5" aria-hidden="true">
        <div className="flex h-14 w-14 items-center justify-center rounded-lg border bg-muted/40">
          <Icon className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border bg-background">
          <LoaderCircle className="h-4 w-4 text-emerald-600 motion-safe:animate-spin dark:text-emerald-400" />
        </div>
      </div>
      <div className="w-full max-w-sm space-y-1.5">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description && <p className="text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {progress && <div className="mt-5 w-full max-w-sm">
        <div role="progressbar" aria-label={title} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}
          className="h-1.5 overflow-hidden rounded-full bg-muted">
          {percent === undefined
            ? <div className="h-full w-1/3 rounded-full bg-emerald-600 motion-safe:animate-[loading-sweep_1.6s_ease-in-out_infinite] dark:bg-emerald-400" />
            : <div className="h-full rounded-full bg-emerald-600 transition-[width] duration-300 motion-reduce:transition-none dark:bg-emerald-400" style={{ width: `${percent}%` }} />}
        </div>
        {hasTotal && <div className="mt-2 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{current.toLocaleString()} / {progress.total.toLocaleString()} {progress.unit}</span>
          <span>{percent}%</span>
        </div>}
        {Boolean(progress.skipped && progress.skipped > 0) && <p className="mt-2 text-left text-xs text-amber-700 dark:text-amber-400">{progress.skippedLabel}: {progress.skipped?.toLocaleString()}</p>}
      </div>}
    </div>
  );
}
