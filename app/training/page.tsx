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
import { EmptyState } from "@/components/workspace/empty-state";
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
  Loader2,
  Play,
  Settings,
  Square,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  MetricsCharts,
  formatMetricValue,
  type MetricRow,
} from "@/components/workspace/metrics-charts";
import { type CVCatalog, catalogPlaceholder, getModel, getTask } from "@/lib/cvCatalog";
import { apiBaseUrl, projectSlug } from "@/lib/api";
import { useTrainingConfig } from "@/lib/useTrainingConfig";
import { memorySafetyForModel } from "@/lib/resourceSafety";
import { useLanguage } from "@/components/language-provider";

const API_URL = apiBaseUrl();
const ACTIVE_JOB_KEY = "ailab-active-job";
const TERMINAL_STATUSES = new Set(["exited", "failed", "stopped", "not_found"]);

function numericValue(row: MetricRow | undefined, key: string) {
  if (!row) return undefined;
  const value = row[key];
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function statusTone(value: string): StatusTone {
  if (["running", "exited"].includes(value)) return "success";
  if (["queued", "stopped"].includes(value)) return "warning";
  if (value === "failed") return "danger";
  return "neutral";
}

export default function TrainingPage() {
  const { t } = useLanguage();
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [didReadUrlMode, setDidReadUrlMode] = useState(false);
  const { config, deviceSelection, updateConfig } = useTrainingConfig();
  const [isTraining, setIsTraining] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [logs, setLogs] = useState("");
  const [status, setStatus] = useState("idle");
  const [showLogs, setShowLogs] = useState(false);
  const [showConfigSummary, setShowConfigSummary] = useState(false);
  const [metricsHistory, setMetricsHistory] = useState<MetricRow[]>([]);
  const [catalog, setCatalog] = useState<CVCatalog>(catalogPlaceholder);
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const [configHydrated, setConfigHydrated] = useState(
    useTrainingConfig.persist.hasHydrated(),
  );
  const [streamError, setStreamError] = useState("");
  const [runError, setRunError] = useState("");
  const [isStopping, setIsStopping] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mode = new URLSearchParams(window.location.search).get("mode");
    setIsReviewMode(mode === "review");
    setDidReadUrlMode(true);
  }, []);

  useEffect(() => {
    const unsubscribe = useTrainingConfig.persist.onFinishHydration(() =>
      setConfigHydrated(true),
    );
    setConfigHydrated(useTrainingConfig.persist.hasHydrated());
    return unsubscribe;
  }, []);

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
  const fallbackDevice = String(
    deviceSpec?.default ?? deviceOptions[0]?.value ?? "cpu",
  );
  const currentDeviceAvailable = deviceOptions.some(
    (option) => option.value === config.device,
  );
  const shouldPreferGpuDefault =
    deviceSelection === "auto" && fallbackDevice !== "cpu" && config.device === "cpu";
  const deviceReady =
    deviceOptions.length === 0 || (currentDeviceAvailable && !shouldPreferGpuDefault);

  useEffect(() => {
    if (catalogStatus !== "ready") return;
    if (deviceOptions.length === 0) return;

    if (!currentDeviceAvailable || shouldPreferGpuDefault) {
      updateConfig("device", fallbackDevice, { deviceSelection: "auto" });
    }
  }, [catalogStatus, config.device, deviceOptions, deviceSelection, deviceSpec?.default, updateConfig]);

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

  const selectedDeviceLabel =
    deviceOptions.find((option) => option.value === config.device)?.label ??
    (config.device === "cpu" ? "CPU" : `GPU ${config.device}`);

  const memoryReady = catalogStatus === "ready" && configHydrated && deviceReady;
  const memorySafety = useMemo(
    () =>
      memoryReady
        ? memorySafetyForModel(selectedModel, {
            batchSize: config.batchSize,
            workers: config.workers,
            device: config.device,
            amp: config.amp,
            params: config.params,
          })
        : null,
    [
      config.amp,
      config.batchSize,
      config.device,
      config.params,
      config.workers,
      memoryReady,
      selectedModel,
    ],
  );

  const summaryItems = [
    { label: "Task", value: selectedTask.label },
    { label: "Model", value: `${selectedModel.label} (${effectiveModelName})` },
    { label: "Dataset", value: config.datasetName || "No dataset selected" },
    { label: "Epochs", value: config.epochs },
    { label: "Batch", value: config.batchSize },
    { label: "Device", value: selectedDeviceLabel },
    { label: "Workers", value: config.workers },
    { label: "AMP", value: config.amp ? "On" : "Off" },
    { label: "Memory", value: memorySafety?.label ?? "Checking memory..." },
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
    setIsStopping(false);
    setRunError("");
    setStreamError("");
    setStatus("preparing");
    setLogs("Preparing dataset and submitting training job...\n");
    setMetricsHistory([]);
    setProjectName(generatedProjectName);

    const allowedParamKeys = new Set(
      [...catalog.common_params, ...selectedModel.params].map((param) => param.key),
    );
    const params = {
      ...Object.fromEntries(
        Object.entries(config.params).filter(([key]) => allowedParamKeys.has(key)),
      ),
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
      setStatus("queued");
      sessionStorage.setItem(
        ACTIVE_JOB_KEY,
        JSON.stringify({ jobId: nextJobId, projectName: generatedProjectName }),
      );
      setLogs((previous) => `${previous}Job queued: ${nextJobId}\n`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setIsTraining(false);
      setStatus("failed");
      setRunError(message);
      setLogs(
        (previous) =>
          `${previous}Error: ${message}\n`,
      );
    }
  };

  const stopTraining = async () => {
    if (!jobId || isStopping) return;

    setIsStopping(true);
    setRunError("");
    setStreamError("");
    setStatus("stopping");
    setLogs((previous) => `${previous}
Stop requested for job ${jobId}.
`);

    try {
      const response = await fetch(`${API_URL}/api/stop/${jobId}`, {
        method: "POST",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.detail || "Failed to stop training");
      }
      setStatus(data.status || "stopping");
      setIsTraining(true);
      setLogs((previous) => `${previous}Stop accepted by backend.
`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunError(message);
      setStatus(jobId ? "queued" : "idle");
      setLogs((previous) => `${previous}Stop error: ${message}
`);
    } finally {
      setIsStopping(false);
    }
  };

  useEffect(() => {
    if (!didReadUrlMode || isReviewMode) return;

    let cancelled = false;

    const restoreActiveJob = async () => {
      try {
        const saved = sessionStorage.getItem(ACTIVE_JOB_KEY);
        if (!saved) return;
        const active = JSON.parse(saved) as {
          jobId?: string;
          projectName?: string;
        };
        if (!active.jobId) return;

        const response = await fetch(`${API_URL}/api/status/${encodeURIComponent(active.jobId)}`);
        if (!response.ok) throw new Error("Saved job is unavailable");
        const data = (await response.json()) as { status?: string };
        const nextStatus = data.status ?? "queued";
        if (TERMINAL_STATUSES.has(nextStatus)) {
          sessionStorage.removeItem(ACTIVE_JOB_KEY);
          return;
        }
        if (cancelled) return;
        setJobId(active.jobId);
        setProjectName(active.projectName ?? null);
        setStatus(nextStatus);
        setIsTraining(["queued", "running", "started", "stopping"].includes(nextStatus));
      } catch {
        sessionStorage.removeItem(ACTIVE_JOB_KEY);
      }
    };

    restoreActiveJob();
    return () => {
      cancelled = true;
    };
  }, [didReadUrlMode, isReviewMode]);

  useEffect(() => {
    if (!didReadUrlMode || isReviewMode || jobId) return;
    let cancelled = false;
    fetch(`${API_URL}/api/runs`)
      .then((response) => (response.ok ? response.json() : { runs: [] }))
      .then((data: { runs?: Array<{ job_id?: string; project_name?: string; status?: string }> }) => {
        const active = data.runs?.find(
          (run) => run.job_id && ["queued", "running", "started", "stopping"].includes(run.status || ""),
        );
        if (cancelled || !active?.job_id) return;
        setJobId(active.job_id);
        setProjectName(active.project_name || null);
        setStatus(active.status || "queued");
        setIsTraining(true);
        sessionStorage.setItem(
          ACTIVE_JOB_KEY,
          JSON.stringify({ jobId: active.job_id, projectName: active.project_name }),
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [didReadUrlMode, isReviewMode, jobId]);

  useEffect(() => {
    fetch(`${API_URL}/api/model-catalog`)
      .then((response) => {
        if (!response.ok) throw new Error("Catalog unavailable");
        return response.json();
      })
      .then((data: CVCatalog) => {
        if (!Array.isArray(data.tasks) || data.tasks.length === 0) {
          throw new Error("Catalog has no tasks");
        }
        setCatalog(data);
        setCatalogStatus("ready");
      })
      .catch(() => setCatalogStatus("error"));
  }, []);

  useEffect(() => {
    if (!jobId) return;
    const source = new EventSource(`${API_URL}/api/jobs/${encodeURIComponent(jobId)}/events`);
    const parse = <T,>(event: Event) => JSON.parse((event as MessageEvent<string>).data) as T;

    source.addEventListener("open", () => setStreamError(""));
    source.addEventListener("snapshot", (event) => {
      const data = parse<{ status: string; project_name?: string | null; logs: string; metrics: MetricRow[] }>(event);
      setStatus(data.status);
      if (data.project_name) setProjectName(data.project_name);
      setLogs(data.logs || "");
      setMetricsHistory(data.metrics || []);
      if (TERMINAL_STATUSES.has(data.status)) {
        setIsTraining(false);
        sessionStorage.removeItem(ACTIVE_JOB_KEY);
      }
    });
    source.addEventListener("log", (event) => {
      const data = parse<{ text: string; replace?: boolean }>(event);
      setLogs((previous) => (data.replace ? data.text : previous + data.text));
    });
    source.addEventListener("status", (event) => {
      const data = parse<{ status: string }>(event);
      setStatus(data.status);
      if (TERMINAL_STATUSES.has(data.status)) {
        setIsTraining(false);
        sessionStorage.removeItem(ACTIVE_JOB_KEY);
      }
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

  useEffect(() => {
    if (logs.includes("[Dataset warning]")) {
      setShowLogs(true);
    }
  }, [logs]);

  if (catalogStatus !== "ready" && !jobId && !isTraining) {
    const failed = catalogStatus === "error";
    return (
      <MainLayout>
        <div className="space-y-6">
          <PageHeader
            title="Training Monitor"
            description={t("training.header.description")}
          />
          <EmptyState
            icon={failed ? TriangleAlert : Loader2}
            title={failed ? "Model catalog unavailable" : "Checking model catalog"}
            description={t(failed ? "config.catalog.unavailable" : "config.catalog.loading")}
            actions={
              failed ? (
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              ) : undefined
            }
          />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          title="Training Monitor"
          description={t("training.header.description")}
          actions={
            !isTraining ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/config">
                  <Settings className="h-4 w-4" />
                  Edit Config
                </Link>
              </Button>
            ) : undefined
          }
        />

        {runError && (
          <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            {runError}
          </div>
        )}

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
                    {t("training.payload.description")}
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
              {memorySafety && !memorySafety.ok && (
                <div className="rounded-lg border border-amber-300/40 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
                  <p className="font-medium">Memory safety needs adjustment</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
                    {[...memorySafety.issues, ...memorySafety.suggestions].map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              <Button onClick={startTraining} disabled={!hasSelectedDataset || !memorySafety?.ok}>
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
                {logs.includes("[Dataset warning]") && (
                  <StatusBadge tone="warning">Dataset warning</StatusBadge>
                )}
              </div>
              <p className="mt-1 break-words text-sm text-muted-foreground">
                Project: {projectName ?? "-"} | Job: {jobId ?? "-"}
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 sm:items-end">
              <div className="text-left sm:text-right">
                <p className="text-2xl font-semibold text-foreground">
                  {Math.round(epoch)}/{totalEpochs}
                </p>
                <p className="text-sm text-muted-foreground">epochs</p>
              </div>
              {isTraining && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopTraining}
                  disabled={isStopping}
                >
                  <Square className="h-4 w-4" />
                  {isStopping ? "Stopping..." : "Stop Run"}
                </Button>
              )}
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
                    {t("training.metrics.description")}
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
                        {formatMetricValue(key, latestMetrics?.[key])}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {metricsHistory.length > 0 && <MetricsCharts metrics={metricsHistory} />}
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
