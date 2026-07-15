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
import { EmptyState } from "@/components/workspace/empty-state";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import {
  MetricsCharts,
  formatMetricValue,
  type MetricRow,
} from "@/components/workspace/metrics-charts";
import { Download, FileText, History, RefreshCw, Trash2, Trophy, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiBaseUrl, artifactDownloadUrl } from "@/lib/api";
import { useLanguage } from "@/components/language-provider";

const API_URL = apiBaseUrl();

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
  const { t } = useLanguage();
  const [runs, setRuns] = useState<TrainingRun[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [metricsHistory, setMetricsHistory] = useState<MetricRow[]>([]);

  const fetchRuns = useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/api/runs`);
      if (!response.ok) {
        throw new Error(`Run service returned ${response.status}`);
      }

      const data = await response.json();
      const nextRuns = data.runs ?? [];
      setLoadError("");
      setDeleteError("");
      setRuns(nextRuns);
      setSelectedProject((current) =>
        nextRuns.some((run: TrainingRun) => run.project_name === current)
          ? current
          : nextRuns[0]?.project_name ?? null,
      );
    } catch {
      setRuns([]);
      setSelectedProject(null);
      setLoadError(
        "Run history unavailable. Start the backend and refresh results.",
      );
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

  useEffect(() => {
    if (!selectedRun) {
      setMetricsHistory([]);
      return;
    }
    const controller = new AbortController();
    setMetricsHistory([]);
    fetch(`${API_URL}/api/metrics/${encodeURIComponent(selectedRun.project_name)}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : { metrics: [] }))
      .then((data) => setMetricsHistory(data.metrics ?? []))
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMetricsHistory([]);
      });
    return () => controller.abort();
  }, [selectedRun]);

  const downloadableFiles = selectedRun?.files?.filter((file) =>
    ["pt", "pth", "csv", "log", "json", "traineddata"].some((extension) =>
      file.name.endsWith(`.${extension}`),
    ),
  );

  const handleDeleteRun = async (projectName: string) => {
    setDeletingProject(projectName);

    try {
      const response = await fetch(
        `${API_URL}/api/runs/${encodeURIComponent(projectName)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Delete failed with status ${response.status}`);
      }

      const remainingRuns = runs.filter((run) => run.project_name !== projectName);
      setRuns(remainingRuns);
      setSelectedProject((current) =>
        current === projectName ? remainingRuns[0]?.project_name ?? null : current,
      );
      setDeleteConfirm(null);
      setDeleteError("");
    } catch (error) {
      console.error("Failed to delete run:", error);
      setDeleteError(
        error instanceof Error ? error.message : `Could not delete ${projectName}. Check the backend and retry.`,
      );
    } finally {
      setDeletingProject(null);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workspace"
          title="Results"
          description={t("results.header.description")}
          actions={
            <Button variant="outline" onClick={fetchRuns} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          }
        />

        {isLoading ? (
          <EmptyState
            icon={RefreshCw}
            title="Loading run history"
            description={t("results.loading.description")}
          />
        ) : loadError ? (
          <EmptyState
            icon={History}
            title="Results service offline"
            description={loadError}
            actions={
              <Button variant="outline" onClick={fetchRuns}>
                <RefreshCw className="h-4 w-4" />
                Refresh Results
              </Button>
            }
          />
        ) : runs.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="No training results yet"
            description={t("results.empty.description")}
          />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Run History</CardTitle>
                <CardDescription>{runs.length} backend run folders</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {runs.map((run) => (
                  <button
                    key={run.project_name}
                    onClick={() => setSelectedProject(run.project_name)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      selectedRun?.project_name === run.project_name
                        ? "border-foreground bg-muted"
                        : "border-border bg-background hover:bg-muted"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="min-w-0 break-words font-medium text-foreground">
                        {run.project_name}
                      </p>
                      {selectedRun?.project_name === run.project_name && (
                        <StatusBadge tone="success">Selected</StatusBadge>
                      )}
                    </div>
                    <p className="mt-2 break-words text-xs text-muted-foreground">
                      {run.model_type ?? "unknown model"} | Updated{" "}
                      {formatDate(run.updatedAt)}
                    </p>
                  </button>
                ))}
              </CardContent>
            </Card>

            {selectedRun && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle>{selectedRun.project_name}</CardTitle>
                        <CardDescription className="mt-2">
                          {selectedRun.dataset_name ?? "Dataset not recorded"}
                        </CardDescription>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {selectedRun.task_type && (
                          <Badge variant="outline">{selectedRun.task_type}</Badge>
                        )}
                        {selectedRun.model_type && (
                          <Badge variant="outline">{selectedRun.model_type}</Badge>
                        )}
                        {deleteConfirm === selectedRun.project_name ? (
                          <>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deletingProject === selectedRun.project_name}
                              onClick={() => handleDeleteRun(selectedRun.project_name)}
                            >
                              <Trash2 className="h-4 w-4" />
                              {deletingProject === selectedRun.project_name ? "Deleting" : "Confirm delete"}
                            </Button>
                            <Button
                              aria-label="Cancel delete"
                              variant="ghost"
                              size="icon"
                              disabled={deletingProject === selectedRun.project_name}
                              onClick={() => setDeleteConfirm(null)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            aria-label={`Delete ${selectedRun.project_name}`}
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(selectedRun.project_name)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {deleteError && (
                      <p className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400">
                        {deleteError}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      {[
                        ["Model", selectedRun.model_name ?? "-"],
                        ["Epochs", selectedRun.epochs ?? "-"],
                        ["Created", formatDate(selectedRun.createdAt)],
                        ["Updated", formatDate(selectedRun.updatedAt)],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-lg border border-border bg-background p-3"
                        >
                          <p className="text-xs text-muted-foreground">{label}</p>
                          <p className="mt-1 break-words text-sm font-medium text-foreground">
                            {String(value)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {metricsHistory.length > 0 && (
                  <MetricsCharts metrics={metricsHistory} />
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Latest Metrics</CardTitle>
                    <CardDescription>
                      {t("results.metrics.description")}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {selectedRun.latest_metrics ? (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {Object.entries(selectedRun.latest_metrics)
                          .slice(0, 12)
                          .map(([key, value]) => (
                            <div
                              key={key}
                              className="rounded-lg border border-border bg-background p-3"
                            >
                              <p className="break-words text-xs text-muted-foreground">
                                {key}
                              </p>
                              <p className="mt-1 break-words text-sm font-medium text-foreground">
                                {formatMetricValue(key, value)}
                              </p>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {t("results.noMetrics")}
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      Artifacts
                    </CardTitle>
                    <CardDescription>
                      Files under `backend/runs/{selectedRun.project_name}`.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {(downloadableFiles ?? []).map((file) => (
                        <a
                          key={file.path}
                          href={artifactDownloadUrl(API_URL, selectedRun.project_name, file.path)}
                          className="rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {file.path}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {formatBytes(file.size)}
                                </p>
                              </div>
                            </div>
                            <Download className="h-4 w-4 shrink-0 text-muted-foreground" />
                          </div>
                        </a>
                      ))}
                      {downloadableFiles?.length === 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t("results.noArtifacts")}
                        </p>
                      )}
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
