"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Activity, CircleGauge, Download, Loader2, Sparkles, Square, Target, Terminal, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { MetricsCharts, formatMetricValue, type MetricRow } from "@/components/workspace/metrics-charts";
import { ModelTestDialog } from "@/components/tasks/model-test-dialog";
import { InsightList, type Insight } from "@/components/tasks/insight-list";
import { StatusBadge, type StatusTone } from "@/components/workspace/status-badge";
import { apiBaseUrl, artifactDownloadUrl } from "@/lib/api";
import type { TrainingTask } from "@/lib/trainingConfig";
import { useLanguage } from "@/components/language-provider";

const API_URL = apiBaseUrl();
const TERMINAL = new Set(["completed", "exited", "failed", "stopped", "cancelled", "not_found"]);

function tone(status: string): StatusTone {
  if (["completed", "exited", "running", "started"].includes(status)) return "success";
  if (["queued", "stopping", "stopped", "cancelled"].includes(status)) return "warning";
  if (status === "failed") return "danger";
  return "neutral";
}

function number(row: MetricRow | undefined, key: string) {
  const value = row?.[key]; const parsed = Number(value);
  return value !== "" && value != null && Number.isFinite(parsed) ? parsed : undefined;
}

function bytes(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

export function TaskRun({ task, onRefresh }: { task: TrainingTask; onRefresh: () => Promise<void> }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState(task.status);
  const [logs, setLogs] = useState("");
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [showLogs, setShowLogs] = useState(!TERMINAL.has(task.status));
  const [stopping, setStopping] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [testOpen, setTestOpen] = useState(false);
  const [testEval, setTestEval] = useState<{ test_accuracy?: number; test_loss?: number; test_images?: number; checkpoint?: string } | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setStatus(task.status); }, [task.status]);
  useEffect(() => {
    fetch(`${API_URL}/api/tasks/${encodeURIComponent(task.id)}/logs`)
      .then((response) => response.ok ? response.json() : { logs: "" })
      .then((data) => setLogs(data.logs ?? ""))
      .catch(() => setLogs(""));
  }, [task.id]);
  useEffect(() => {
    if (!task.runSlug) return;
    fetch(`${API_URL}/api/metrics/${encodeURIComponent(task.runSlug)}`)
      .then((response) => response.ok ? response.json() : { metrics: [] })
      .then((data) => { setMetrics(data.metrics ?? []); setInsights(data.insights ?? []); })
      .catch(() => { setMetrics([]); setInsights([]); });
  }, [task.runSlug]);

  // Optional held-out test result, written by the trainer only when the
  // dataset shipped a test/ split. Fetched via the existing artifact endpoint,
  // so a run without it simply 404s and no box is shown.
  useEffect(() => {
    if (!task.runSlug) return;
    setTestEval(null);
    fetch(`${API_URL}/api/runs/${encodeURIComponent(task.runSlug)}/files/test_evaluation.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setTestEval(data))
      .catch(() => setTestEval(null));
  }, [task.runSlug]);

  useEffect(() => {
    if (!task.jobId || TERMINAL.has(task.status)) return;
    const source = new EventSource(`${API_URL}/api/jobs/${encodeURIComponent(task.jobId)}/events`);
    const parse = <T,>(event: Event) => JSON.parse((event as MessageEvent<string>).data) as T;
    source.addEventListener("open", () => setStreamError(""));
    source.addEventListener("snapshot", (event) => { const data = parse<{ status: string; logs: string; metrics: MetricRow[] }>(event); setStatus(data.status); setLogs(data.logs || ""); setMetrics(data.metrics || []); });
    source.addEventListener("log", (event) => { const data = parse<{ text: string; replace?: boolean }>(event); setLogs((current) => data.replace ? data.text : current + data.text); });
    source.addEventListener("metrics", (event) => setMetrics(parse<{ metrics: MetricRow[] }>(event).metrics || []));
    source.addEventListener("status", (event) => setStatus(parse<{ status: string }>(event).status));
    source.addEventListener("end", (event) => { setStatus(parse<{ status: string }>(event).status); source.close(); void onRefresh(); });
    source.onerror = () => setStreamError("Live updates reconnecting...");
    return () => source.close();
  }, [task.jobId, task.status, onRefresh]);

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logs]);
  const latest = metrics[metrics.length - 1];
  const epoch = number(latest, "epoch") ?? 0;
  const progress = task.epochs ? Math.min(epoch / task.epochs * 100, 100) : 0;
  const keys = useMemo(() => latest ? Object.keys(latest).filter((key) => key !== "epoch" && number(latest, key) !== undefined) : [], [latest]);
  const active = !TERMINAL.has(status);
  const files = (task.files ?? []).filter((file) => ["pt", "pth", "csv", "log", "json"].some((extension) => file.name.endsWith(`.${extension}`)));
  // Model testing is image-classification only for now: detection and
  // segmentation results need box/mask rendering the dialog does not do.
  const canTestModel =
    status === "completed" && task.taskType === "image_classification" && Boolean(task.runSlug);

  const stop = async () => {
    setStopping(true);
    const response = await fetch(`${API_URL}/api/tasks/${task.id}/stop`, { method: "POST" });
    const data = await response.json().catch(() => ({}));
    if (response.ok) setStatus(data.status || "stopping"); else setStreamError(data.detail || "Stop failed");
    setStopping(false);
  };

  return <div className="space-y-4">
    <div className="console-surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-md border"><Activity className={`h-5 w-5 ${active ? "animate-pulse" : ""}`} /></div>
      <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{task.modelName}</p><StatusBadge tone={tone(status)}>{status}</StatusBadge>{streamError && <StatusBadge tone="warning">{streamError}</StatusBadge>}</div><p className="mt-1 break-words text-sm text-muted-foreground">{task.displayName}{task.datasetName ? ` - ${task.datasetName}` : ""}</p></div>
      <div className="flex flex-wrap items-center gap-4"><div><p className="text-2xl font-semibold">{Math.round(epoch)}/{task.epochs}</p><p className="text-sm text-muted-foreground">epochs</p></div>{canTestModel && <Button onClick={() => setTestOpen(true)}><Sparkles className="h-4 w-4" />Test Model</Button>}{active && <Button variant="destructive" onClick={stop} disabled={stopping}><Square className="h-4 w-4" />{stopping ? "Stopping..." : "Stop Run"}</Button>}</div>
    </div>
    <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
      <Card><CardHeader><div className="flex justify-between"><div><CardTitle>Progress</CardTitle><CardDescription>{progress.toFixed(1)}% complete</CardDescription></div><Badge variant="outline">Epoch {Math.round(epoch)}</Badge></div></CardHeader><CardContent><Progress value={progress} className="h-3" /></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CircleGauge className="h-5 w-5" />Latest Metrics</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">{(keys.length ? keys.slice(0, 8) : ["train/loss", "val/loss", "val/accuracy", "lr"]).map((key) => <div key={key} className="rounded-md border p-3"><p className="break-words text-xs text-muted-foreground">{key}</p><p className="mt-2 text-xl font-semibold">{formatMetricValue(key, latest?.[key])}</p></div>)}</CardContent></Card>
    </div>
    {testEval && typeof testEval.test_accuracy === "number" && (
      <Card className="border-emerald-500/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />{t("test.eval.title")}</CardTitle>
          <CardDescription>{t("test.eval.description")}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-md border bg-emerald-500/10 p-4">
            <p className="text-xs text-muted-foreground">{t("test.eval.accuracy")}</p>
            <p className="mt-1 text-3xl font-semibold">{(testEval.test_accuracy * 100).toFixed(2)}%</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">{t("test.eval.loss")}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{typeof testEval.test_loss === "number" ? testEval.test_loss.toFixed(4) : "-"}</p>
          </div>
          <div className="rounded-md border p-4">
            <p className="text-xs text-muted-foreground">{t("test.eval.images")}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{testEval.test_images ?? "-"}</p>
          </div>
        </CardContent>
      </Card>
    )}
    {insights.length > 0 && <InsightList insights={insights} titleKey="insight.section.title" />}
    {metrics.length > 0 && <MetricsCharts metrics={metrics} />}
    {TERMINAL.has(status) && files.length > 0 && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5" />Artifacts</CardTitle><CardDescription>{t("tasks.artifacts.description")}</CardDescription></CardHeader><CardContent className="grid gap-2 md:grid-cols-2">{files.map((file) => <a key={file.path} href={artifactDownloadUrl(API_URL, task.runSlug!, file.path)} className="flex items-center justify-between rounded-md border p-3 hover:bg-accent"><span className="min-w-0 break-all text-sm font-medium">{file.name}</span><span className="ml-3 flex shrink-0 items-center gap-2 text-xs text-muted-foreground">{bytes(file.size)}<Download className="h-4 w-4" /></span></a>)}</CardContent></Card>}
    <Button variant="outline" onClick={() => setShowLogs((value) => !value)}><Terminal className="h-4 w-4" />{showLogs ? "Hide Logs" : "Show Logs"}</Button>
    {showLogs && <Card><CardHeader><CardTitle className="flex items-center gap-2"><Terminal className="h-5 w-5" />Logs</CardTitle></CardHeader><CardContent><div ref={logRef} className="h-[460px] overflow-y-auto rounded-md border bg-zinc-950 p-5 font-mono text-sm leading-relaxed text-zinc-100"><pre className="whitespace-pre-wrap">{logs || (active ? t("tasks.logs.preparing") : "No logs available.")}</pre></div></CardContent></Card>}
    {canTestModel && task.runSlug && (
      <ModelTestDialog
        open={testOpen}
        onOpenChange={setTestOpen}
        runSlug={task.runSlug}
        modelName={task.modelName}
      />
    )}
  </div>;
}
