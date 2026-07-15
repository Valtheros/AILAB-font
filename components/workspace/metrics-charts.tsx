"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/language-provider";

export type MetricRow = Record<string, string | number>;

const strokes = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function numericValue(row: MetricRow | undefined, key: string) {
  const value = row?.[key];
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function formatMetricValue(
  key: string,
  value: string | number | undefined,
) {
  if (value === undefined || value === "") return "-";
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return String(value);
  const normalized = key.toLowerCase();
  if (
    normalized.includes("loss") ||
    ["accuracy", "map", "precision", "recall"].some((metric) =>
      normalized.includes(metric),
    )
  ) {
    return parsed.toFixed(4);
  }
  if (Math.abs(parsed) <= 1 && parsed !== 0) return parsed.toFixed(4);
  return parsed.toFixed(3);
}

export function MetricsCharts({ metrics }: { metrics: MetricRow[] }) {
  const { t } = useLanguage();
  const latest = metrics[metrics.length - 1];
  const keys = latest
    ? Object.keys(latest).filter(
        (key) => key !== "epoch" && numericValue(latest, key) !== undefined,
      )
    : [];
  const groups = [
    {
      title: "Quality Metrics",
      description: t("training.chart.qualityDescription"),
      keys: keys.filter((key) =>
        ["accuracy", "map", "precision", "recall"].some((metric) =>
          key.toLowerCase().includes(metric),
        ),
      ),
      domain: [0, 1] as [number, number],
    },
    {
      title: "Loss",
      description: t("training.chart.lossDescription"),
      keys: keys.filter((key) => key.toLowerCase().includes("loss")),
      domain: undefined,
    },
  ].filter((group) => group.keys.length > 0);

  return groups.map((group) => (
    <Card key={group.title}>
      <CardHeader>
        <CardTitle>{group.title}</CardTitle>
        <CardDescription>{group.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full sm:h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="epoch" />
              <YAxis domain={group.domain} />
              <Tooltip
                formatter={(value, name) =>
                  formatMetricValue(String(name), value as string | number)
                }
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  borderColor: "var(--border)",
                  color: "var(--popover-foreground)",
                }}
                itemStyle={{ color: "var(--popover-foreground)" }}
                labelStyle={{ color: "var(--popover-foreground)" }}
              />
              {group.keys.slice(0, 6).map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={key}
                  stroke={strokes[index % strokes.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:flex lg:flex-wrap">
          {group.keys.slice(0, 6).map((key, index) => (
            <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground" key={key}>
              <span
                className="h-0.5 w-4 shrink-0"
                style={{ backgroundColor: strokes[index % strokes.length] }}
              />
              <span className="break-all">{key}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  ));
}
