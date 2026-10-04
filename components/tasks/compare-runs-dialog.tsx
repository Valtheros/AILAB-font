"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiBaseUrl } from "@/lib/api";
import { InsightList, type Insight } from "@/components/tasks/insight-list";
import { useLanguage } from "@/components/language-provider";

const API_URL = apiBaseUrl();

// Explicit hues rather than the theme's --chart-* ramp: that ramp is a
// greyscale gradient, which is fine for one run but makes two to four
// overlaid runs impossible to tell apart. These four read clearly on both
// the light and dark surfaces.
const COLOURS = ["#2563eb", "#ea580c", "#16a34a", "#9333ea"];

interface CompareRun {
  runId: string;
  runSlug: string | null;
  displayName: string;
  taskType: string;
  modelType: string | null;
  architecture: string;
  metric: { key: string; label: string; direction: string } | null;
  series: {
    epoch: (number | null)[];
    trainMetric: (number | null)[] | null;
    valMetric: (number | null)[] | null;
  };
  bestMetric: { value: number; epoch: number | null } | null;
  finalMetric: { value: number } | null;
  epochsRecorded: number;
  trainingParams: Record<string, string | number | boolean | null>;
}

interface CompareResponse {
  datasetSlug: string;
  runs: CompareRun[];
  sharedMetric: { key: string; label: string; direction: string } | null;
  warnings: string[];
  insights: Insight[];
}

/** Turn per-run series into the row-per-epoch shape Recharts expects. */
function toChartRows(runs: CompareRun[]) {
  const epochs = new Set<number>();
  runs.forEach((run) =>
    run.series.epoch.forEach((epoch) => {
      if (epoch !== null) epochs.add(epoch);
    }),
  );
  return [...epochs]
    .sort((a, b) => a - b)
    .map((epoch) => {
      const row: Record<string, number | null> = { epoch };
      runs.forEach((run, index) => {
        const position = run.series.epoch.indexOf(epoch);
        row[`train_${index}`] = position >= 0 ? run.series.trainMetric?.[position] ?? null : null;
        row[`val_${index}`] = position >= 0 ? run.series.valMetric?.[position] ?? null : null;
      });
      return row;
    });
}

function formatValue(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-";
  return value.toFixed(4);
}

function paramText(params: CompareRun["trainingParams"], key: string) {
  const value = params?.[key];
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

export function CompareRunsDialog({
  open,
  onOpenChange,
  datasetSlug,
  runIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasetSlug: string;
  runIds: string[];
}) {
  const { t } = useLanguage();
  const requestKey = JSON.stringify([datasetSlug, runIds, t("compare.error.failed")]);
  const [response, setResponse] = useState<{ key: string; data: CompareResponse | null; error: string } | null>(null);
  const current = response?.key === requestKey ? response : null;
  const data = current?.data ?? null;
  const error = current?.error ?? '';
  const loading = open && runIds.length >= 2 && !current;

  useEffect(() => {
    if (!open || runIds.length < 2) return;
    const controller = new AbortController();
    fetch(
      `${API_URL}/api/datasets/${encodeURIComponent(datasetSlug)}/runs/compare?run_ids=${encodeURIComponent(runIds.join(","))}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload.detail || t("compare.error.failed"));
        return payload as CompareResponse;
      })
      .then((data) => {
        if (!controller.signal.aborted) setResponse({ key: requestKey, data, error: '' });
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setResponse({ key: requestKey, data: null, error: caught instanceof Error ? caught.message : t("compare.error.failed") });
      });
    return () => controller.abort();
  }, [open, datasetSlug, runIds, t, requestKey]);

  const rows = data ? toChartRows(data.runs) : [];
  const metricLabel = data?.sharedMetric?.label ?? t("compare.metric.mixed");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-2rem)] max-w-6xl flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0 text-left">
          <DialogTitle>Compare Runs</DialogTitle>
          <DialogDescription>
            {t("compare.dialog.description")} <span className="font-medium">{datasetSlug}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {loading && (
            <div className="flex items-center gap-3 rounded-md border bg-accent/40 p-4">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
              <p className="text-sm">{t("compare.loading")}</p>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {data?.warnings?.map((warning) => (
            <div
              key={warning}
              className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
            >
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{warning}</span>
            </div>
          ))}

          {data && rows.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">
                {metricLabel} {t("compare.chart.perEpoch")}
              </p>
              <div className="h-[320px] w-full sm:h-[380px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={rows} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="epoch" />
                    <YAxis
                      domain={data.sharedMetric && data.sharedMetric.direction === "higher" ? [0, 1] : undefined}
                    />
                    <Tooltip
                      formatter={(value) => formatValue(value as number)}
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        borderColor: "var(--border)",
                        color: "var(--popover-foreground)",
                      }}
                      itemStyle={{ color: "var(--popover-foreground)" }}
                      labelStyle={{ color: "var(--popover-foreground)" }}
                    />
                    <Legend />
                    {data.runs.map((run, index) => {
                      const colour = COLOURS[index % COLOURS.length];
                      const lines = [];
                      if (run.series.trainMetric) {
                        lines.push(
                          <Line
                            key={`train_${index}`}
                            type="monotone"
                            dataKey={`train_${index}`}
                            name={`${run.displayName} · train`}
                            stroke={colour}
                            strokeWidth={2}
                            dot={false}
                            connectNulls
                            // The entry animation drives strokeDasharray, which
                            // both hides the line if it is interrupted while the
                            // dialog measures itself and overrides the dashed
                            // style used for validation curves below.
                            isAnimationActive={false}
                          />,
                        );
                      }
                      if (run.series.valMetric) {
                        lines.push(
                          <Line
                            key={`val_${index}`}
                            type="monotone"
                            dataKey={`val_${index}`}
                            name={`${run.displayName} · val`}
                            stroke={colour}
                            strokeWidth={2}
                            strokeDasharray="5 4"
                            dot={false}
                            connectNulls
                            isAnimationActive={false}
                          />,
                        );
                      }
                      return lines;
                    })}
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">{t("compare.chart.legendHint")}</p>
            </div>
          )}

          {data && (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-accent/50 text-left">
                  <tr>
                    <th className="p-3 font-medium">{t("compare.table.run")}</th>
                    <th className="p-3 font-medium">{t("compare.table.architecture")}</th>
                    <th className="p-3 font-medium">{t("compare.table.metric")}</th>
                    <th className="p-3 text-right font-medium">{t("compare.table.best")}</th>
                    <th className="p-3 text-right font-medium">{t("compare.table.final")}</th>
                    <th className="p-3 text-right font-medium">{t("compare.table.epochs")}</th>
                    <th className="p-3 text-right font-medium">{t("compare.table.batch")}</th>
                    <th className="p-3 text-right font-medium">{t("compare.table.lr")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.runs.map((run, index) => (
                    <tr key={run.runId} className="border-t">
                      <td className="p-3">
                        <span className="flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="h-3 w-3 shrink-0 rounded-sm"
                            style={{ backgroundColor: COLOURS[index % COLOURS.length] }}
                          />
                          <span className="break-all font-medium">{run.displayName}</span>
                        </span>
                      </td>
                      <td className="p-3 break-all">{run.architecture || run.modelType || "-"}</td>
                      <td className="p-3">{run.metric?.label ?? "-"}</td>
                      <td className="p-3 text-right tabular-nums">
                        {formatValue(run.bestMetric?.value)}
                        {run.bestMetric?.epoch != null && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            @{run.bestMetric.epoch}
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right tabular-nums">{formatValue(run.finalMetric?.value)}</td>
                      <td className="p-3 text-right tabular-nums">{run.epochsRecorded}</td>
                      <td className="p-3 text-right tabular-nums">{paramText(run.trainingParams, "batchSize")}</td>
                      <td className="p-3 text-right tabular-nums">{paramText(run.trainingParams, "learningRate")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data && data.insights?.length > 0 && (
            <InsightList insights={data.insights} titleKey="insight.section.compareTitle" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
