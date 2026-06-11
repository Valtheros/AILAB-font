"use client";

import { MainLayout } from "@/components/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/workspace/page-header";
import {
  StatusBadge,
  type StatusTone,
} from "@/components/workspace/status-badge";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  CircleGauge,
  Cpu,
  Play,
  Settings,
  Square,
  Terminal,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { type CVCatalog, fallbackCatalog, getModel, getTask } from "@/lib/cvCatalog";
import { apiBaseUrl, projectSlug } from "@/lib/api";
import { useTrainingConfig } from "@/lib/useTrainingConfig";

const API_URL = apiBaseUrl();
const ACTIVE_JOB_KEY = "ailab-active-job";

type MetricRow = Record<string, string | number>;

const metricStrokes = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function numericValue(row: MetricRow | undefined, key: string) {
  if (!row) return undefined;
  const value = row[key];
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function displayMetric(value: string | number | undefined) {
  if (value === undefined || value === "") return "-";
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    if (Math.abs(parsed) <= 1 && parsed !== 0) return parsed.toFixed(4);
    return parsed.toFixed(3);
  }
  return String(value);
}

function statusTone(value: string): StatusTone {
  if (["running", "exited"].includes(value)) return "success";
  if (["queued", "stopped"].includes(value)) return "warning";
  if (value === "failed") return "danger";
  return "neutral";
}

export default function TrainingPage() {
  const { config, updateConfig } = useTrainingConfig();
  const [isTraining, setIsTraining] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [logs, setLogs] = useState("");
  const [status, setStatus] = useState("idle");
  const [showLogs, setShowLogs] = useState(false);
  const [showConfigSummary, setShowConfigSummary] = useState(false);
  const [metricsHistory, setMetricsHistory] = useState<MetricRow[]>([]);
  const [catalog, setCatalog] = useState<CVCatalog>(fallbackCatalog);
  const [streamError, setStreamError] = useState("");
  const logContainerRef = useRef<HTMLDivElement>(null);

  const selectedTask = getTask(catalog, config.taskType);
  const selectedModel = getModel(
    catalog,
    config.taskType,
    config.modelType,
  );
  const effectiveTaskType = selectedTask.id;
  const effectiveModelType = selectedModel.id;
  const deviceSpec = useMemo(
    () => catalog.common_params.find((param) => param.key === "device"),
    [catalog.common_params],
  );
  const deviceOptions = useMemo(() => deviceSpec?.options ?? [], [deviceSpec]);

  useEffect(() => {
    if (deviceOptions.length === 0) return;
    const fallbackDevice = String(deviceSpec?.default ?? deviceOptions[0].value);
    const currentDeviceAvailable = deviceOptions.some(
      (option) => option.value === config.device,
    );
    const shouldPreferGpuDefault =
      fallbackDevice !== "cpu" && config.device === "cpu";

    if (!currentDeviceAvailable || shouldPreferGpuDefault) {
      updateConfig("device", fallbackDevice);
    }
  }, [config.device, deviceOptions, deviceSpec?.default, updateConfig]);

  const effectiveModelName = useMemo(() => {
    if (effectiveModelType === "yolo") {
      const size = String(config.params.model_size ?? "n")
        .replace("yolo11", "")
        .replace(".pt", "");
      return `yolo11${size}`;
    }

    const architecture = config.params.architecture;
    if (
      typeof architecture === "string" &&
      (effectiveModelType === "resnet" || effectiveModelType === "efficientnet")
    ) {
      return architecture;
    }

    return config.modelName || selectedModel.model_name;
  }, [config.modelName, config.params, effectiveModelType, selectedModel.model_name]);

  const latestMetrics = metricsHistory[metricsHistory.length - 1];
  const epoch = numericValue(latestMetrics, "epoch") ?? 0;
  const totalEpochs = config.epochs;
  const progressPercent =
    totalEpochs > 0 ? Math.min((epoch / totalEpochs) * 100, 100) : 0;
  const hasSelectedDataset = Boolean(config.datasetName);

  const metricKeys = useMemo(() => {
    if (!latestMetrics) return [];
    return Object.keys(latestMetrics).filter(
      (key) => key !== "epoch" && numericValue(latestMetrics, key) !== undefined,
    );
  }, [latestMetrics]);

  const chartKeys = metricKeys.filter(
    (key) =>
      key.includes("loss") ||
      key.includes("accuracy") ||
      key.includes("mAP") ||
      key.includes("precision") ||
      key.includes("recall"),
  );

  const selectedDeviceLabel =
    deviceOptions.find((option) => option.value === config.device)?.label ??
    (config.device === "cpu" ? "CPU" : `GPU ${config.device}`);

  const summaryItems = [
    { label: "Task", value: selectedTask.label },
    { label: "Model", value: `${selectedModel.label} (${effectiveModelName})` },
    { label: "Dataset", value: config.datasetName || "No dataset selected" },
    { label: "Epochs", value: config.epochs },
    { label: "Batch", value: config.batchSize },
    { label: "Device", value: selectedDeviceLabel },
    { label: "Workers", value: config.workers },
    { label: "AMP", value: config.amp ? "On" : "Off" },
  ];

  const detailItems = Object.entries(config.params).map(([key, value]) => ({
    label: key,
    value,
  }));

  const startTraining = async () => {
    if (!config.datasetName) {
      setLogs("Select a compatible dataset in Configuration before starting a run.\n");
      return;
    }

    const generatedProjectName = `${projectSlug(config.projectName || effectiveModelType)}_${Date.now()}`;
    setIsTraining(true);
    setStatus("queued");
    setLogs("Submitting training job...\n");
    setMetricsHistory([]);
    setProjectName(generatedProjectName);

    const params = {
      ...config.params,
      epochs: config.epochs,
      batch_size: config.batchSize,
      device: config.device,
      workers: config.workers,
      amp: config.amp,
      seed: config.seed,
    };

    try {
      const response = await fetch(`${API_URL}/api/train`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_type: effectiveTaskType,
          model_type: effectiveModelType,
          model_name: effectiveModelName,
          dataset_name: config.datasetName || undefined,
          epochs: config.epochs,
          batch_size: config.batchSize,
          project_name: generatedProjectName,
          params,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || "Failed to start training");
      }

      const data = await response.json();
      const nextJobId = data.job_id ?? data.container_id;
      if (!nextJobId) throw new Error("Backend did not return a job ID");
      setJobId(nextJobId);
      sessionStorage.setItem(
        ACTIVE_JOB_KEY,
        JSON.stringify({ jobId: nextJobId, projectName: generatedProjectName }),
      );
      setLogs((previous) => `${previous}Job queued: ${nextJobId}\n`);
    } catch (error) {
      setIsTraining(false);
      setStatus("failed");
      setLogs(
        (previous) =>
          `${previous}Error: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  };

  const stopTraining = async () => {
    if (!jobId) return;

    try {
      const response = await fetch(`${API_URL}/api/stop/${jobId}`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to stop training");
      setIsTraining(false);
      setStatus("stopped");
      setLogs((previous) => `${previous}\nStop requested.\n`);
    } catch (error) {
      setLogs(
        (previous) =>
          `${previous}\nStop error: ${error instanceof Error ? error.message : String(error)}\n`,
      );
    }
  };

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(ACTIVE_JOB_KEY);
      if (!saved) return;
      const active = JSON.parse(saved) as {
        jobId?: string;
        projectName?: string;
      };
      if (!active.jobId) return;
      setJobId(active.jobId);
      setProjectName(active.projectName ?? null);
      setStatus("queued");
      setIsTraining(true);
    } catch {
      sessionStorage.removeItem(ACTIVE_JOB_KEY);
    }
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/model-catalog`)
      .then((response) => {
        if (!response.ok) throw new Error("Catalog unavailable");
        return response.json();
      })
      .then((data: CVCatalog) => setCatalog(data))
      .catch(() => setCatalog(fallbackCatalog));
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const source = new EventSource(`${API_URL}/api/jobs/${encodeURIComponent(jobId)}/events`);
    const parse = <T,>(event: Event) => JSON.parse((event as MessageEvent<string>).data) as T;

    source.addEventListener("open", () => setStreamError(""));
    source.addEventListener("snapshot", (event) => {
      const data = parse<{ status: string; logs: string; metrics: MetricRow[] }>(event);
      setStatus(data.status);
      setLogs(data.logs || "");
      setMetricsHistory(data.metrics || []);
    });
    source.addEventListener("log", (event) => {
      const data = parse<{ text: string; replace?: boolean }>(event);
      setLogs((previous) => (data.replace ? data.text : previous + data.text));
    });
    source.addEventListener("status", (event) => {
      const data = parse<{ status: string }>(event);
      setStatus(data.status);
      if (["exited", "failed", "stopped"].includes(data.status)) setIsTraining(false);
    });
    source.addEventListener("metrics", (event) => {
      const data = parse<{ metrics: MetricRow[] }>(event);
      setMetricsHistory(data.metrics || []);
    });
    source.addEventListener("end", (event) => {
      const data = parse<{ status: string }>(event);
      setStatus(data.status);
      setIsTraining(false);
      sessionStorage.removeItem(ACTIVE_JOB_KEY);
      source.close();
    });
    source.onerror = () => setStreamError("Live updates reconnecting...");
    return () => source.close();
  }, [jobId]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workspace"
          title="Training Monitor"
          description="Review the queued payload, start a CV training run, and watch metrics and worker logs without leaving the workspace."
          actions={
            <>
              {!isTraining && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/config">
                    <Settings className="h-4 w-4" />
                    Edit Config
                  </Link>
                </Button>
              )}
              {isTraining && (
                <Button variant="destructive" onClick={stopTraining}>
                  <Square className="h-4 w-4" />
                  Stop Run
                </Button>
              )}
            </>
          }
        />

        {!isTraining && status !== "running" && (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Cpu className="h-5 w-5" />
                    Run Payload
                  </CardTitle>
                  <CardDescription className="mt-2">
                    The draft below is sent through the current `/api/train` contract.
                  </CardDescription>
                </div>
                <StatusBadge tone="neutral">Draft ready</StatusBadge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {summaryItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-foreground">
                      {String(item.value)}
                    </p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowConfigSummary(!showConfigSummary)}
                className="flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
              >
                {showConfigSummary ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
                {showConfigSummary
                  ? "Hide parameters"
                  : `Show parameters (${detailItems.length})`}
              </button>
              {showConfigSummary && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {detailItems.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="mt-1 break-words text-sm text-foreground">
                        {String(item.value)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {!hasSelectedDataset && (
                <div className="flex">
                  <StatusBadge tone="warning">
                    Select a compatible dataset in Configuration first
                  </StatusBadge>
                </div>
              )}
              <Button onClick={startTraining} disabled={!hasSelectedDataset}>
                <Play className="h-4 w-4" />
                Start Training
              </Button>
            </CardContent>
          </Card>
        )}

        {(isTraining || jobId) && (
          <div className="console-surface flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background">
              <Activity
                className={`h-5 w-5 ${isTraining ? "animate-pulse" : "text-muted-foreground"}`}
              />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="break-words font-medium text-foreground">
                  {selectedModel.label}
                </p>
                <StatusBadge tone={statusTone(status)}>{status}</StatusBadge>
                {streamError && <StatusBadge tone="warning">{streamError}</StatusBadge>}
              </div>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                Project: {projectName ?? "-"} | Job: {jobId ?? "-"}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-2xl font-semibold text-foreground">
                {Math.round(epoch)}/{totalEpochs}
              </p>
              <p className="text-sm text-muted-foreground">epochs</p>
            </div>
          </div>
        )}

        {(isTraining || metricsHistory.length > 0) && (
          <>
            <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <CardTitle>Progress</CardTitle>
                      <CardDescription>
                        {progressPercent.toFixed(1)}% complete
                      </CardDescription>
                    </div>
                    <Badge variant="outline">Epoch {Math.round(epoch)}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Progress value={progressPercent} className="h-3" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CircleGauge className="h-5 w-5" />
                    Latest Metrics
                  </CardTitle>
                  <CardDescription>
                    Numeric values from the newest trainer metric row.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {(metricKeys.length
                    ? metricKeys.slice(0, 8)
                    : ["train/loss", "val/loss", "val/accuracy", "lr"]
                  ).map((key) => (
                    <div
                      key={key}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <p className="break-words text-xs text-muted-foreground">
                        {key}
                      </p>
                      <p className="mt-2 break-words text-xl font-semibold text-foreground">
                        {displayMetric(latestMetrics?.[key])}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {metricsHistory.length > 0 && chartKeys.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Metrics</CardTitle>
                  <CardDescription>
                    Generic chart for numeric trainer metrics.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={metricsHistory}
                        margin={{ top: 5, right: 24, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-border"
                        />
                        <XAxis dataKey="epoch" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        {chartKeys.slice(0, 6).map((key, index) => (
                          <Line
                            key={key}
                            type="monotone"
                            dataKey={key}
                            name={key}
                            stroke={metricStrokes[index % metricStrokes.length]}
                            strokeWidth={2}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <Button variant="outline" onClick={() => setShowLogs(!showLogs)}>
          <Terminal className="h-4 w-4" />
          {showLogs ? "Hide Logs" : "Show Logs"}
        </Button>

        {showLogs && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={logContainerRef}
                className="h-[460px] w-full overflow-y-auto rounded-lg border border-border bg-zinc-950 p-5 font-mono text-sm leading-relaxed text-zinc-100"
              >
                {logs ? (
                  <pre className="whitespace-pre-wrap">{logs}</pre>
                ) : (
                  "No logs yet."
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
