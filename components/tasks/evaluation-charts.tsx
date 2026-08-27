"use client";

import { ChartLine } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/components/language-provider";
import type { MetricRow } from "@/components/workspace/metrics-charts";

interface ConfusionMatrix { labels: string[]; values: number[][]; normalized: number[][] }
interface EvaluationCurve { id: string; label: string; thresholds: number[]; precision: number[]; recall: number[]; f1: number[] }
interface ClassMetric { label: string; iou: number; dice: number; support: number }
export interface EvaluationArtifact { confusionMatrix?: ConfusionMatrix; curves?: EvaluationCurve[]; perClass?: ClassMetric[] }

const colours = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

function TrainingSummary({ metrics }: { metrics: MetricRow[] }) {
  const latest = metrics[metrics.length - 1] ?? {};
  const keys = Object.keys(latest).filter((key) => key !== "epoch" && key !== "time" && !key.startsWith("lr") && Number.isFinite(Number(latest[key]))).slice(0, 10);
  return <Card>
    <CardHeader><CardTitle>Training Summary</CardTitle></CardHeader>
    <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      {keys.map((key, index) => <div key={key} className="min-w-0">
        <p className="truncate text-center text-xs" title={key}>{key}</p>
        <div className="h-28 sm:h-32"><ResponsiveContainer width="100%" height="100%"><LineChart data={metrics} margin={{ top: 8, right: 6, left: -30, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis dataKey="epoch" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={46} domain={key.toLowerCase().includes("accuracy") || key.toLowerCase().includes("iou") || key.toLowerCase().includes("dice") || key.toLowerCase().includes("precision") || key.toLowerCase().includes("recall") || key.toLowerCase().includes("map") ? [0, 1] : undefined} />
          <Tooltip formatter={(value) => Number(value).toFixed(4)} contentStyle={{ backgroundColor: "var(--popover)", borderColor: "var(--border)" }} />
          <Line type="monotone" dataKey={key} stroke={colours[index % colours.length]} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart></ResponsiveContainer></div>
      </div>)}
    </CardContent>
  </Card>;
}

function MatrixPlot({ matrix, normalized }: { matrix: ConfusionMatrix; normalized: boolean }) {
  const source = normalized ? matrix.normalized : matrix.values;
  const maximum = normalized ? 1 : Math.max(1, ...matrix.values.flat());
  return <Card>
    <CardHeader><CardTitle>Confusion Matrix{normalized ? " (normalized)" : ""}</CardTitle></CardHeader>
    <CardContent className="overflow-x-auto">
      <table className="mx-auto min-w-max border-separate border-spacing-1 text-center text-xs">
        <thead><tr><th className="max-w-32 p-2 text-left text-muted-foreground">Actual / Predicted</th>{matrix.labels.map((label) => <th key={label} className="max-w-24 break-words p-2 font-medium">{label}</th>)}</tr></thead>
        <tbody>{matrix.labels.map((label, row) => <tr key={label}><th className="max-w-32 break-words p-2 text-left font-medium">{label}</th>{source[row].map((value, column) => {
          const intensity = Number(value) / maximum;
          return <td key={`${row}-${column}`} className="h-14 min-w-14 rounded border tabular-nums" style={{ backgroundColor: `color-mix(in oklch, var(--chart-1) ${Math.max(5, intensity * 85)}%, transparent)` }} title={`${matrix.values[row][column]} samples`}>{normalized ? `${(Number(value) * 100).toFixed(Number(value) ? 1 : 0)}%` : Number(value).toLocaleString()}</td>;
        })}</tr>)}</tbody>
      </table>
    </CardContent>
  </Card>;
}

function CurvePlot({ title, rows, xLabel, colour }: { title: string; rows: { x: number; value: number }[]; xLabel: string; colour: string }) {
  return <Card><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent><div className="h-[280px] w-full sm:h-[320px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={rows} margin={{ top: 5, right: 20, left: -12, bottom: 5 }}>
    <CartesianGrid strokeDasharray="3 3" className="stroke-border" /><XAxis dataKey="x" type="number" domain={[0, 1]} tickFormatter={(value) => Number(value).toFixed(1)} /><YAxis domain={[0, 1]} />
    <Tooltip formatter={(value) => Number(value).toFixed(4)} labelFormatter={(value) => `${xLabel} ${Number(value).toFixed(2)}`} contentStyle={{ backgroundColor: "var(--popover)", borderColor: "var(--border)" }} itemStyle={{ color: colour }} labelStyle={{ color: "var(--popover-foreground)" }} />
    <Line type="monotone" dataKey="value" name={title} stroke={colour} strokeWidth={2} dot={false} isAnimationActive={false} />
  </LineChart></ResponsiveContainer></div></CardContent></Card>;
}

function curvePlots(curve: EvaluationCurve) {
  const rows = curve.thresholds.map((threshold, index) => ({ threshold, precision: curve.precision[index], recall: curve.recall[index], f1: curve.f1[index] }));
  return [
    { title: `${curve.label} Precision-Recall`, xLabel: "Recall", colour: colours[0], rows: rows.map((row) => ({ x: row.recall, value: row.precision })).sort((a, b) => a.x - b.x) },
    { title: `${curve.label} F1-Confidence`, xLabel: "Confidence", colour: colours[1], rows: rows.map((row) => ({ x: row.threshold, value: row.f1 })) },
    { title: `${curve.label} Precision-Confidence`, xLabel: "Confidence", colour: colours[2], rows: rows.map((row) => ({ x: row.threshold, value: row.precision })) },
    { title: `${curve.label} Recall-Confidence`, xLabel: "Confidence", colour: colours[3], rows: rows.map((row) => ({ x: row.threshold, value: row.recall })) },
  ];
}

function PerClassPlot({ rows }: { rows: ClassMetric[] }) {
  return <Card><CardHeader><CardTitle>Per-class IoU / Dice</CardTitle></CardHeader><CardContent className="space-y-4">{rows.map((item) => <div key={item.label} className="space-y-2"><div className="flex justify-between gap-3"><span className="font-medium">{item.label}</span><span className="text-xs text-muted-foreground">{item.support.toLocaleString()} pixels</span></div>{(["iou", "dice"] as const).map((metric, index) => <div key={metric} className="grid grid-cols-[3rem_1fr_4rem] items-center gap-2 text-xs"><span className="uppercase text-muted-foreground">{metric}</span><div className="h-2 overflow-hidden rounded bg-muted"><div className="h-full" style={{ width: `${item[metric] * 100}%`, backgroundColor: colours[index] }} /></div><span className="text-right tabular-nums">{item[metric].toFixed(4)}</span></div>)}</div>)}</CardContent></Card>;
}

export function EvaluationCharts({ artifact, metrics }: { artifact: EvaluationArtifact; metrics: MetricRow[] }) {
  const { t } = useLanguage();
  const confusion = artifact.confusionMatrix;
  const curves = (artifact.curves ?? []).flatMap(curvePlots);
  const perClass = artifact.perClass ?? [];
  return <section className="space-y-4">
    <div><h2 className="flex items-center gap-2 text-xl font-semibold"><ChartLine className="h-5 w-5" />{t("plots.title")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("plots.description")}</p></div>
    <div className="grid gap-4 lg:grid-cols-2">
      {metrics.length > 0 && <TrainingSummary metrics={metrics} />}
      {confusion && <MatrixPlot matrix={confusion} normalized />}
      {curves.map((plot) => <CurvePlot key={plot.title} {...plot} />)}
      {perClass.length > 0 && <PerClassPlot rows={perClass} />}
    </div>
  </section>;
}
