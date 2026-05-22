"use client";

import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Activity,
  ChevronDown,
  ChevronUp,
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
import { fallbackCatalog, getModel, getTask } from "@/lib/cvCatalog";
import { useTrainingConfig } from "@/lib/useTrainingConfig";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type MetricRow = Record<string, string | number>;

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

export default function TrainingPage() {
  const { config } = useTrainingConfig();
  const [isTraining, setIsTraining] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [logs, setLogs] = useState("");
  const [status, setStatus] = useState("idle");
  const [showLogs, setShowLogs] = useState(false);
  const [showConfigSummary, setShowConfigSummary] = useState(false);
  const [metricsHistory, setMetricsHistory] = useState<MetricRow[]>([]);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const selectedTask = getTask(fallbackCatalog, config.taskType);
  const selectedModel = getModel(fallbackCatalog, config.taskType, config.modelType);

  const effectiveModelName = useMemo(() => {
    if (config.modelType === "yolo") {
      const size = String(config.params.model_size ?? "n").replace("yolo11", "").replace(".pt", "");
      return `yolo11${size}`;
    }
    const architecture = config.params.architecture;
    if (typeof architecture === "string" && (config.modelType === "resnet" || config.modelType === "efficientnet")) {
      return architecture;
    }
    return config.modelName || selectedModel.model_name;
  }, [config.modelName, config.modelType, config.params, selectedModel.model_name]);

  const latestMetrics = metricsHistory[metricsHistory.length - 1];
  const epoch = numericValue(latestMetrics, "epoch") ?? 0;
  const totalEpochs = config.epochs;
  const progressPercent = totalEpochs > 0 ? Math.min((epoch / totalEpochs) * 100, 100) : 0;

  const metricKeys = useMemo(() => {
    if (!latestMetrics) return [];
    return Object.keys(latestMetrics).filter((key) => key !== "epoch" && numericValue(latestMetrics, key) !== undefined);
  }, [latestMetrics]);

  const chartKeys = metricKeys.filter(
    (key) => key.includes("loss") || key.includes("accuracy") || key.includes("mAP") || key.includes("precision") || key.includes("recall"),
  );

  const summaryItems = [
    { label: "Task", value: selectedTask.label },
    { label: "Model", value: `${selectedModel.label} (${effectiveModelName})` },
    { label: "Dataset", value: config.datasetName || "Latest compatible" },
    { label: "Epochs", value: config.epochs },
    { label: "Batch", value: config.batchSize },
    { label: "Device", value: config.device === "cpu" ? "CPU" : `GPU ${config.device}` },
    { label: "Workers", value: config.workers },
    { label: "AMP", value: config.amp ? "On" : "Off" },
  ];

  const detailItems = Object.entries(config.params).map(([key, value]) => ({ label: key, value }));

  const startTraining = async () => {
    const generatedProjectName = `${config.projectName || config.modelType}_${Date.now()}`;
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
          task_type: config.taskType,
          model_type: config.modelType,
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
      setJobId(data.job_id ?? data.container_id);
      setLogs((prev) => `${prev}Job queued: ${data.job_id ?? data.container_id}\n`);
    } catch (error) {
      setIsTraining(false);
      setStatus("failed");
      setLogs((prev) => `${prev}Error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  };

  const stopTraining = async () => {
    if (!jobId) return;
    try {
      const response = await fetch(`${API_URL}/api/stop/${jobId}`, { method: "POST" });
      if (!response.ok) throw new Error("Failed to stop training");
      setIsTraining(false);
      setStatus("stopped");
      setLogs((prev) => `${prev}\nStop requested.\n`);
    } catch (error) {
      setLogs((prev) => `${prev}\nStop error: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  };

  useEffect(() => {
    if (!jobId || ["exited", "failed", "stopped"].includes(status)) return;

    const interval = setInterval(async () => {
      try {
        const statusRes = await fetch(`${API_URL}/api/status/${jobId}`);
        const statusData = await statusRes.json();
        setStatus(statusData.status);
        if (["exited", "failed", "stopped"].includes(statusData.status)) {
          setIsTraining(false);
        }

        const logsRes = await fetch(`${API_URL}/api/logs/${jobId}`);
        const logsData = await logsRes.json();
        setLogs(logsData.logs || "");
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }

        if (projectName) {
          const metricsRes = await fetch(`${API_URL}/api/metrics/${projectName}`);
          const metricsData = await metricsRes.json();
          if (metricsData.status === "success" && Array.isArray(metricsData.metrics)) {
            setMetricsHistory(metricsData.metrics);
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [jobId, projectName, status]);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Training</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Review the selected computer vision job, start it, and monitor logs and metrics.
            </p>
          </div>
          <div className="flex gap-2">
            {!isTraining && (
              <Link href="/config">
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Config
                </Button>
              </Link>
            )}
            {isTraining && (
              <Button variant="destructive" onClick={stopTraining}>
                <Square className="mr-2 h-4 w-4" />
                Stop
              </Button>
            )}
          </div>
        </div>

        {!isTraining && status !== "running" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Training Configuration
              </CardTitle>
              <CardDescription>Payload is compatible with the new `/api/train` contract.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {summaryItems.map((item) => (
                  <div key={item.label} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                    <p className="text-xs text-gray-500">{item.label}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-gray-900 dark:text-white">{String(item.value)}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowConfigSummary(!showConfigSummary)}
                className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 dark:hover:bg-gray-900"
              >
                {showConfigSummary ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {showConfigSummary ? "Hide parameters" : `Show parameters (${detailItems.length})`}
              </button>
              {showConfigSummary && (
                <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                  {detailItems.map((item) => (
                    <div key={item.label} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                      <p className="text-xs text-gray-500">{item.label}</p>
                      <p className="mt-1 break-words text-sm text-gray-900 dark:text-white">{String(item.value)}</p>
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={startTraining}>
                <Play className="mr-2 h-4 w-4" />
                Start Training
              </Button>
            </CardContent>
          </Card>
        )}

        {(isTraining || jobId) && (
          <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-black sm:flex-row sm:items-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-900">
              <Activity className={`h-5 w-5 ${isTraining ? "animate-spin text-green-500" : "text-gray-500"}`} />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">
                {selectedModel.label} · {projectName}
              </p>
              <p className="text-sm text-gray-500">Status: {status} · Job: {jobId ?? "-"}</p>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(epoch)}/{totalEpochs}
              </p>
              <p className="text-sm text-gray-500">epochs</p>
            </div>
          </div>
        )}

        {(isTraining || metricsHistory.length > 0) && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Progress</CardTitle>
                <CardDescription>{progressPercent.toFixed(1)}% complete</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={progressPercent} className="h-3" />
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {(metricKeys.length ? metricKeys.slice(0, 8) : ["train/loss", "val/loss", "val/accuracy", "lr"]).map((key) => (
                <Card key={key}>
                  <CardContent className="pt-6">
                    <p className="text-sm text-gray-500">{key}</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">
                      {displayMetric(latestMetrics?.[key])}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {metricsHistory.length > 0 && chartKeys.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Metrics</CardTitle>
                  <CardDescription>Generic chart for numeric trainer metrics.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-[320px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={metricsHistory} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
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
                            stroke={["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2"][index]}
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

        <div>
          <Button variant="outline" onClick={() => setShowLogs(!showLogs)}>
            <Terminal className="mr-2 h-4 w-4" />
            {showLogs ? "Hide Logs" : "Show Logs"}
          </Button>
        </div>

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
                className="h-[460px] w-full overflow-y-auto rounded-lg bg-gray-950 p-5 font-mono text-sm leading-relaxed text-green-400"
              >
                {logs ? <pre className="whitespace-pre-wrap">{logs}</pre> : "No logs yet."}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
