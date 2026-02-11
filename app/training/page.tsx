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
  Play,
  Square,
  Terminal,
  Activity,
  Settings,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useTrainingConfig } from "@/lib/useTrainingConfig";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

export default function TrainingPage() {
  const { config } = useTrainingConfig();

  const [isTraining, setIsTraining] = useState(false);
  const [containerId, setContainerId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [status, setStatus] = useState<string>("idle");
  const [showLogs, setShowLogs] = useState(false);
  const [showConfigSummary, setShowConfigSummary] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Metrics State
  const [metrics, setMetrics] = useState({
    epoch: 0,
    totalEpochs: config.epochs,
    boxLoss: 0,
    clsLoss: 0,
    dflLoss: 0,
    mAP50: 0,
    mAP5095: 0,
    precision: 0,
    recall: 0,
    eta: "--:--",
    speed: "-",
  });

  const [metricsHistory, setMetricsHistory] = useState<any[]>([]);

  const handleStopTraining = async () => {
    try {
      if (!containerId) {
        throw new Error("Container ID is not available");
      }
      const response = await fetch(`${API_URL}/api/stop/${containerId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error("Failed to stop training");
      }
      setIsTraining(false);
      setStatus("exited");
      setLogs((prev) => prev + "\nTraining stopped (container exited).\n");
    } catch (error) {
      console.error(error);
      setLogs((prev) => prev + `Error stopping training: ${error}\n`);
      setIsTraining(false);
    }
  };

  const API_URL = "http://localhost:8000";

  // Extract model_size from model name (e.g. "yolo11n.pt" -> "n")
  const getModelSize = () => {
    const match = config.model.match(/yolo11(\w)\.pt/);
    return match ? match[1] : "n";
  };

  const startTraining = async () => {
    try {
      setIsTraining(true);
      setLogs("Starting training container...\n");
      // Reset metrics
      setMetrics({
        epoch: 0,
        totalEpochs: config.epochs,
        boxLoss: 0,
        clsLoss: 0,
        dflLoss: 0,
        mAP50: 0,
        mAP5095: 0,
        precision: 0,
        recall: 0,
        eta: "--:--",
        speed: "-",
      });
      setMetricsHistory([]);

      const generatedProjectName = "yolo_run_" + Date.now();
      setProjectName(generatedProjectName);

      const modelSize = getModelSize();

      const response = await fetch(`${API_URL}/api/train`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_size: modelSize,
          epochs: config.epochs,
          batch_size: config.batch,
          project_name: generatedProjectName,
          // All detailed config from Zustand store
          imgsz: config.imgsz,
          device: config.device,
          workers: config.workers,
          patience: config.patience,
          pretrained: config.pretrained,
          cache: config.cache,
          amp: config.amp,
          fraction: config.fraction,
          optimizer: config.optimizer,
          lr0: config.lr0,
          lrf: config.lrf,
          momentum: config.momentum,
          weight_decay: config.weight_decay,
          cos_lr: config.cos_lr,
          warmup_epochs: config.warmup_epochs,
          warmup_momentum: config.warmup_momentum,
          warmup_bias_lr: config.warmup_bias_lr,
          box: config.box,
          cls: config.cls,
          dfl: config.dfl,
          hsv_h: config.hsv_h,
          hsv_s: config.hsv_s,
          hsv_v: config.hsv_v,
          degrees: config.degrees,
          translate: config.translate,
          scale: config.scale,
          shear: config.shear,
          perspective: config.perspective,
          flipud: config.flipud,
          fliplr: config.fliplr,
          mosaic: config.mosaic,
          mixup: config.mixup,
          copy_paste: config.copy_paste,
          save_period: config.save_period,
          close_mosaic: config.close_mosaic,
          nbs: config.nbs,
          dropout: config.dropout,
          seed: config.seed,
          deterministic: config.deterministic,
          single_cls: config.single_cls,
          rect: config.rect,
          multi_scale: config.multi_scale,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start training");
      }

      const data = await response.json();
      setContainerId(data.container_id);
      setStatus("running");
      setLogs((prev) => prev + `Container started: ${data.container_id}\n`);
    } catch (error) {
      console.error(error);
      setLogs((prev) => prev + `Error starting training: ${error}\n`);
      setIsTraining(false);
    }
  };

  // Poll for logs and status
  useEffect(() => {
    if (!containerId || status === "exited") return;

    const interval = setInterval(async () => {
      try {
        // Get Status
        const statusRes = await fetch(`${API_URL}/api/status/${containerId}`);
        const statusData = await statusRes.json();
        setStatus(statusData.status);

        if (statusData.status === "exited") {
          setIsTraining(false);
          setLogs((prev) => prev + "\nTraining completed (container exited).");
          clearInterval(interval);
        }

        // Get Logs
        const logsRes = await fetch(`${API_URL}/api/logs/${containerId}`);
        const logsData = await logsRes.json();
        const currentLogs = logsData.logs || "";
        setLogs(currentLogs);

        // Auto-scroll to bottom
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop =
            logContainerRef.current.scrollHeight;
        }

        // Get Metrics if projectName is available
        if (projectName) {
          try {
            const metricsRes = await fetch(
              `${API_URL}/api/metrics/${projectName}`,
            );
            const metricsData = await metricsRes.json();

            if (
              metricsData.status === "success" &&
              metricsData.metrics &&
              Array.isArray(metricsData.metrics)
            ) {
              const history = metricsData.metrics;
              setMetricsHistory(history);
              const m = history[history.length - 1];
              setMetrics((prev) => ({
                ...prev,
                epoch: parseInt(m["epoch"]) || prev.epoch,
                boxLoss: parseFloat(m["train/box_loss"]) || prev.boxLoss,
                clsLoss: parseFloat(m["train/cls_loss"]) || prev.clsLoss,
                dflLoss: parseFloat(m["train/dfl_loss"]) || prev.dflLoss,
                mAP50: parseFloat(m["metrics/mAP50(B)"]) || prev.mAP50,
                mAP5095: parseFloat(m["metrics/mAP50-95(B)"]) || prev.mAP5095,
                precision:
                  parseFloat(m["metrics/precision(B)"]) || prev.precision,
                recall: parseFloat(m["metrics/recall(B)"]) || prev.recall,
              }));
            }
          } catch (err) {
            // Ignore metrics fetch error, maybe file not created yet
          }
        }
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [containerId, status]);

  const progressPercent = (metrics.epoch / metrics.totalEpochs) * 100;

  // Config summary items for display
  const configSummaryItems = [
    { label: "Model", value: config.model },
    { label: "Epochs", value: config.epochs },
    { label: "Batch Size", value: config.batch },
    { label: "Image Size", value: `${config.imgsz}px` },
    {
      label: "Device",
      value: config.device === "cpu" ? "CPU" : `GPU ${config.device}`,
    },
    { label: "Optimizer", value: config.optimizer },
    { label: "Learning Rate", value: config.lr0 },
    { label: "Patience", value: config.patience },
    { label: "AMP", value: config.amp ? "On" : "Off" },
    { label: "Cache", value: config.cache ? "On" : "Off" },
    { label: "Workers", value: config.workers },
    { label: "Pretrained", value: config.pretrained ? "Yes" : "No" },
  ];

  const configDetailItems = [
    { label: "Final LR Factor", value: config.lrf },
    { label: "Momentum", value: config.momentum },
    { label: "Weight Decay", value: config.weight_decay },
    { label: "Cosine LR", value: config.cos_lr ? "On" : "Off" },
    { label: "Warmup Epochs", value: config.warmup_epochs },
    { label: "Box Loss", value: config.box },
    { label: "Cls Loss", value: config.cls },
    { label: "DFL Loss", value: config.dfl },
    { label: "Mosaic", value: config.mosaic },
    { label: "Mixup", value: config.mixup },
    { label: "Flip LR", value: config.fliplr },
    { label: "Flip UD", value: config.flipud },
    { label: "HSV-H", value: config.hsv_h },
    { label: "HSV-S", value: config.hsv_s },
    { label: "HSV-V", value: config.hsv_v },
    { label: "Degrees", value: config.degrees },
    { label: "Translate", value: config.translate },
    { label: "Scale", value: config.scale },
    { label: "Dropout", value: config.dropout },
    { label: "Seed", value: config.seed },
  ];

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Training
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Configure and monitor YOLOv11 training.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {!isTraining && status !== "running" && (
              <Link href="/config">
                <Button variant="outline" size="sm">
                  <Settings className="mr-2 h-4 w-4" />
                  Edit Config
                </Button>
              </Link>
            )}
            {isTraining && (
              <Button
                variant="destructive"
                onClick={() => handleStopTraining()}
                disabled={status === "exited"}
              >
                <Square className="mr-2 h-4 w-4" />
                Stop Training
              </Button>
            )}
          </div>
        </div>

        {/* Configuration Summary + Start (Visible when idle) */}
        {!isTraining && status !== "running" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Training Configuration
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Review your settings before starting training
                  </CardDescription>
                </div>
                <Link href="/config">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
                  >
                    <Settings className="mr-1 h-4 w-4" />
                    Edit
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Main config grid */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {configSummaryItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/50"
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                      {String(item.value)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Expandable detail section */}
              <button
                onClick={() => setShowConfigSummary(!showConfigSummary)}
                className="flex w-full items-center justify-center gap-1 rounded-lg py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              >
                {showConfigSummary ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Hide detailed parameters
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-4 w-4" />
                    Show all parameters ({configDetailItems.length} more)
                  </>
                )}
              </button>

              {showConfigSummary && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                  {configDetailItems.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-gray-200 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-900/50"
                    >
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                        {String(item.value)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="pt-2">
                <Button className="w-full md:w-auto" onClick={startTraining}>
                  <Play className="mr-2 h-4 w-4" /> Start Training
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Banner */}
        {isTraining && (
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <Activity className="h-5 w-5 animate-spin text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">
                Training in Progress
              </p>
              <p className="text-sm text-gray-500">
                Model: {config.model} • Batch: {config.batch} • ImgSz:{" "}
                {config.imgsz} • Optimizer: {config.optimizer} • Status:{" "}
                {status}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {metrics.epoch}/{metrics.totalEpochs}
              </p>
              <p className="text-sm text-gray-500">Epochs</p>
            </div>
          </div>
        )}

        {/* Metrics Display (Only visible when training or logs exist) */}
        {(isTraining || logs) && (
          <>
            {/* Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Training Progress</CardTitle>
                <CardDescription>
                  Epoch {metrics.epoch} of {metrics.totalEpochs}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Progress value={progressPercent} className="h-3" />
                <div className="flex justify-between text-sm text-gray-500">
                  <span>{progressPercent.toFixed(1)}% complete</span>
                  <span>ETA: {metrics.eta}</span>
                </div>
              </CardContent>
            </Card>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">mAP@50</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {(metrics.mAP50 * 100).toFixed(1)}%
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">mAP@50-95</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {(metrics.mAP5095 * 100).toFixed(1)}%
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Precision</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {(metrics.precision * 100).toFixed(1)}%
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-500">Recall</p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">
                      {(metrics.recall * 100).toFixed(1)}%
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Graphs */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Loss Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={metricsHistory}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-gray-200 dark:stroke-gray-700"
                        />
                        <XAxis dataKey="epoch" />
                        <YAxis />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(255, 255, 255, 0.9)",
                            borderRadius: "8px",
                            border: "none",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                          labelStyle={{ color: "#374151" }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="train/box_loss"
                          name="Box Loss"
                          stroke="#8884d8"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="train/cls_loss"
                          name="Cls Loss"
                          stroke="#82ca9d"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="train/dfl_loss"
                          name="DFL Loss"
                          stroke="#ffc658"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={metricsHistory}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          className="stroke-gray-200 dark:stroke-gray-700"
                        />
                        <XAxis dataKey="epoch" />
                        <YAxis />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(255, 255, 255, 0.9)",
                            borderRadius: "8px",
                            border: "none",
                            boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                          }}
                          labelStyle={{ color: "#374151" }}
                        />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="metrics/mAP50(B)"
                          name="mAP@50"
                          stroke="#ff7300"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="metrics/mAP50-95(B)"
                          name="mAP@50-95"
                          stroke="#387908"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="metrics/precision(B)"
                          name="Precision"
                          stroke="#8884d8"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line
                          type="monotone"
                          dataKey="metrics/recall(B)"
                          name="Recall"
                          stroke="#82ca9d"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Training Logs */}
        <Button onClick={() => setShowLogs(!showLogs)}>
          <Terminal className="mr-2 h-4 w-4" />
          {showLogs ? "Hide Logs" : "Show Logs"}
        </Button>
        {showLogs && (
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Terminal className="h-5 w-5" />
                Training Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={logContainerRef}
                className="h-[500px] w-full overflow-y-auto rounded-lg bg-gray-950 p-6 font-mono text-sm leading-relaxed text-green-400 shadow-inner"
              >
                {logs ? (
                  <pre className="whitespace-pre-wrap font-mono">{logs}</pre>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center text-gray-500">
                    <Activity className="mb-4 h-10 w-10 animate-pulse opacity-50" />
                    <p>Waiting for training logs...</p>
                    <p className="text-xs">
                      Logs will stream here once the container starts.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
