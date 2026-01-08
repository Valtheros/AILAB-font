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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Square, Terminal, Activity, AlertCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";

export default function TrainingPage() {
  const [isTraining, setIsTraining] = useState(false);
  const [containerId, setContainerId] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>("");
  const [status, setStatus] = useState<string>("idle");
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Configuration State
  const [modelSize, setModelSize] = useState("n");
  const [epochs, setEpochs] = useState("100");
  const [batchSize, setBatchSize] = useState("16");

  // Metrics State
  const [metrics, setMetrics] = useState({
    epoch: 0,
    totalEpochs: 100,
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

  const API_URL = "http://localhost:8000";

  const startTraining = async () => {
    try {
      setIsTraining(true);
      setLogs("Starting training container...\n");
      // Reset metrics
      setMetrics({
        epoch: 0,
        totalEpochs: parseInt(epochs),
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

      const response = await fetch(`${API_URL}/api/train`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model_size: modelSize,
          epochs: parseInt(epochs),
          batch_size: parseInt(batchSize),
          project_name: "yolo_run_" + Date.now(),
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
      } catch (error) {
        console.error("Polling error:", error);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [containerId, status]);

  const progressPercent = (metrics.epoch / metrics.totalEpochs) * 100;

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
            {/* Only show stop button if running. Start button is inside config below/modal, 
                 but we can keep a global action if desired. For now, let's keep it simple. */}
            {isTraining && (
              <Button
                variant="destructive"
                onClick={() => setIsTraining(false)}
                disabled={status === "exited"}
              >
                <Square className="mr-2 h-4 w-4" />
                Stop Training
              </Button>
            )}
          </div>
        </div>

        {/* Configuration Section (Visible when idle) */}
        {!isTraining && status !== "running" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Configuration
              </CardTitle>
              <CardDescription>Setup training parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Model Size</Label>
                  <Select value={modelSize} onValueChange={setModelSize}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select model size" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="n">Nano (n)</SelectItem>
                      <SelectItem value="s">Small (s)</SelectItem>
                      <SelectItem value="m">Medium (m)</SelectItem>
                      <SelectItem value="l">Large (l)</SelectItem>
                      <SelectItem value="x">Extra Large (x)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Epochs</Label>
                  <Input
                    type="number"
                    value={epochs}
                    onChange={(e) => setEpochs(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Batch Size</Label>
                  <Input
                    type="number"
                    value={batchSize}
                    onChange={(e) => setBatchSize(e.target.value)}
                  />
                </div>
              </div>
              <div className="pt-4">
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
                Model: YOLOv11{modelSize} • Batch: {batchSize} • Status:{" "}
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
          </>
        )}

        {/* Training Logs */}
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
      </div>
    </MainLayout>
  );
}
