"use client";

import { MainLayout } from "@/components/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Square,
  RefreshCw,
  Clock,
  Cpu,
  HardDrive,
  Activity,
  Terminal,
} from "lucide-react";
import { useState, useEffect } from "react";

// Mock training data
const mockMetrics = {
  epoch: 45,
  totalEpochs: 100,
  boxLoss: 0.0423,
  clsLoss: 0.0312,
  dflLoss: 0.0187,
  mAP50: 0.847,
  mAP5095: 0.623,
  precision: 0.891,
  recall: 0.834,
  eta: "2h 34m",
  speed: "45.2 ms/batch",
};

const mockLogs = [
  { time: "00:45:23", message: "Epoch 45/100 started" },
  {
    time: "00:45:22",
    message: "Validation complete: mAP50=0.847, mAP50-95=0.623",
  },
  {
    time: "00:44:18",
    message: "Epoch 44/100 complete: box_loss=0.0431, cls_loss=0.0318",
  },
  { time: "00:43:15", message: "Saving checkpoint: best.pt (mAP50=0.847)" },
  { time: "00:42:10", message: "GPU Memory: 8.2 GB / 12 GB (68%)" },
  { time: "00:41:05", message: "Epoch 44/100 started" },
  {
    time: "00:40:02",
    message: "Validation complete: mAP50=0.841, mAP50-95=0.618",
  },
  {
    time: "00:38:55",
    message: "Epoch 43/100 complete: box_loss=0.0445, cls_loss=0.0325",
  },
];

export default function TrainingPage() {
  const [isTraining, setIsTraining] = useState(true);
  const [metrics, setMetrics] = useState(mockMetrics);

  // Simulate training progress
  useEffect(() => {
    if (!isTraining) return;

    const interval = setInterval(() => {
      setMetrics((prev) => ({
        ...prev,
        epoch: Math.min(prev.epoch + 1, prev.totalEpochs),
        boxLoss: Math.max(0.01, prev.boxLoss - 0.0005),
        clsLoss: Math.max(0.01, prev.clsLoss - 0.0003),
        mAP50: Math.min(0.95, prev.mAP50 + 0.002),
        mAP5095: Math.min(0.75, prev.mAP5095 + 0.001),
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [isTraining]);

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
              ติดตามความคืบหน้าการ Training
            </p>
          </div>
          <div className="flex items-center gap-3">
            {isTraining ? (
              <Button
                variant="destructive"
                onClick={() => setIsTraining(false)}
              >
                <Square className="mr-2 h-4 w-4" />
                Stop Training
              </Button>
            ) : (
              <Button onClick={() => setIsTraining(true)}>
                <Play className="mr-2 h-4 w-4" />
                Start Training
              </Button>
            )}
          </div>
        </div>

        {/* Status Banner */}
        {isTraining && (
          <div className="flex items-center gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <RefreshCw className="h-5 w-5 animate-spin text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-900 dark:text-white">
                Training in Progress
              </p>
              <p className="text-sm text-gray-500">
                Model: YOLOv11n • Dataset: traffic_signs • ETA: {metrics.eta}
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

        {/* Loss Charts and System Info */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Loss Values */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Loss Values
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-gray-900 dark:bg-white" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Box Loss
                    </span>
                  </div>
                  <span className="font-mono text-sm font-medium">
                    {metrics.boxLoss.toFixed(4)}
                  </span>
                </div>
                <Progress value={(1 - metrics.boxLoss) * 100} className="h-2" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-gray-600" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Classification Loss
                    </span>
                  </div>
                  <span className="font-mono text-sm font-medium">
                    {metrics.clsLoss.toFixed(4)}
                  </span>
                </div>
                <Progress value={(1 - metrics.clsLoss) * 100} className="h-2" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      DFL Loss
                    </span>
                  </div>
                  <span className="font-mono text-sm font-medium">
                    {metrics.dflLoss.toFixed(4)}
                  </span>
                </div>
                <Progress value={(1 - metrics.dflLoss) * 100} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* System Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                System Resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <Cpu className="h-5 w-5 text-gray-500" />
                    <span className="text-sm">GPU Usage</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">68%</span>
                    <p className="text-xs text-gray-500">8.2 GB / 12 GB</p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <HardDrive className="h-5 w-5 text-gray-500" />
                    <span className="text-sm">Memory</span>
                  </div>
                  <div className="text-right">
                    <span className="font-medium">45%</span>
                    <p className="text-xs text-gray-500">14.4 GB / 32 GB</p>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-gray-500" />
                    <span className="text-sm">Speed</span>
                  </div>
                  <span className="font-medium">{metrics.speed}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Training Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5" />
              Training Logs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 overflow-y-auto rounded-lg bg-gray-900 p-4 font-mono text-sm">
              {mockLogs.map((log, index) => (
                <div key={index} className="flex gap-4 py-1">
                  <span className="text-gray-500">[{log.time}]</span>
                  <span className="text-gray-300">{log.message}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
