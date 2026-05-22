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
import { Download, FileText, RefreshCw, Trophy } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface RunFile {
  path: string;
  name: string;
  size: number;
}

interface TrainingRun {
  project_name: string;
  createdAt: number;
  updatedAt: number;
  task_type?: string;
  model_type?: string;
  model_name?: string;
  dataset_name?: string;
  epochs?: number;
  files: RunFile[];
  latest_metrics?: Record<string, string>;
}

function formatBytes(size: number) {
  if (size > 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size > 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}

function formatDate(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString();
}

export default function ResultsPage() {
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/runs`);
      const data = response.ok ? await response.json() : { runs: [] };
      setRuns(data.runs ?? []);
      setSelectedProject((current) => current ?? data.runs?.[0]?.project_name ?? null);
    } catch (error) {
      console.error("Failed to fetch runs:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const selectedRun = useMemo(
    () => runs.find((run) => run.project_name === selectedProject) ?? runs[0],
    [runs, selectedProject],
  );

  const downloadableFiles = selectedRun?.files?.filter((file) =>
    ["pt", "pth", "csv", "log", "json", "traineddata"].some((extension) => file.name.endsWith(`.${extension}`)),
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Results</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Browse completed run folders, metrics, and downloadable artifacts from the backend.
            </p>
          </div>
          <Button variant="outline" onClick={fetchRuns} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16 text-gray-500">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
              Loading runs...
            </CardContent>
          </Card>
        ) : runs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Trophy className="h-12 w-12 text-gray-300 dark:text-gray-700" />
              <p className="mt-4 text-gray-500">No training results yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Runs</CardTitle>
                <CardDescription>{runs.length} run folders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {runs.map((run) => (
                  <button
                    key={run.project_name}
                    onClick={() => setSelectedProject(run.project_name)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      selectedRun?.project_name === run.project_name
                        ? "border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-900"
                        : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                    }`}
                  >
                    <p className="font-medium text-gray-900 dark:text-white">{run.project_name}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      {run.model_type ?? "unknown"} · {formatDate(run.updatedAt)}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {selectedRun && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>{selectedRun.project_name}</CardTitle>
                    <CardDescription>
                      {selectedRun.task_type ?? "task"} · {selectedRun.model_type ?? "model"} ·{" "}
                      {selectedRun.dataset_name ?? "dataset not recorded"}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      {[
                        ["Model", selectedRun.model_name ?? "-"],
                        ["Epochs", selectedRun.epochs ?? "-"],
                        ["Created", formatDate(selectedRun.createdAt)],
                        ["Updated", formatDate(selectedRun.updatedAt)],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                          <p className="text-xs text-gray-500">{label}</p>
                          <p className="mt-1 break-words text-sm font-medium text-gray-900 dark:text-white">{String(value)}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Latest Metrics</CardTitle>
                    <CardDescription>Last row from `results.csv`, when available.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedRun.latest_metrics ? (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {Object.entries(selectedRun.latest_metrics).slice(0, 12).map(([key, value]) => (
                          <div key={key} className="rounded-lg border border-gray-200 p-3 dark:border-gray-800">
                            <p className="text-xs text-gray-500">{key}</p>
                            <p className="mt-1 break-words text-sm font-medium text-gray-900 dark:text-white">{value || "-"}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No metrics file found.</p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      Artifacts
                    </CardTitle>
                    <CardDescription>Files under `backend/runs/{selectedRun.project_name}`.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {(downloadableFiles ?? []).map((file) => (
                        <a
                          key={file.path}
                          href={`${API_URL}/api/runs/${encodeURIComponent(selectedRun.project_name)}/files/${file.path}`}
                          className="rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <FileText className="h-5 w-5 shrink-0 text-gray-500" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{file.path}</p>
                                <p className="text-xs text-gray-500">{formatBytes(file.size)}</p>
                              </div>
                            </div>
                            <Download className="h-4 w-4 shrink-0 text-gray-400" />
                          </div>
                        </a>
                      ))}
                      {downloadableFiles?.length === 0 && <p className="text-sm text-gray-500">No downloadable artifacts found.</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
