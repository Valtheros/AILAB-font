"use client";

import Link from "next/link";
import { MainLayout } from "@/components/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/workspace/empty-state";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import {
  AlertCircle,
  BookOpenCheck,
  Archive,
  CheckCircle2,
  Database,
  FileArchive,
  FolderOpen,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiBaseUrl, parseJsonText } from "@/lib/api";
import { useLanguage } from "@/components/language-provider";

interface CompatibleModel {
  id: string;
  label: string;
  task: string;
  ready: boolean;
  reason: string;
  dataset_task?: string;
  required_annotations?: string[];
  accepted_canonical_formats?: string[];
  train_export_format?: string;
}

interface ExportCacheEntry {
  model?: string;
  export_format?: string;
  fingerprint?: string;
  path?: string;
  created_at?: number;
}

interface AnnotationStats {
  images?: number;
  classes?: number;
  yolo_boxes?: number;
  yolo_polygons?: number;
  coco_boxes?: number;
  coco_masks?: number;
  semantic_masks?: number;
  paddleocr_tasks?: string[];
  tesseract_pairs?: number;
}

interface ImportProfile {
  tasks: string[];
  formats: string[];
  classes: string[];
  image_count: number;
  source_format: string;
  dataset_task?: string;
  dataset_tasks?: string[];
  canonical_task: string;
  canonical_format?: string;
  normalized_formats: string[];
  annotation_stats: AnnotationStats;
  conversion_warnings?: string[];
  warnings?: string[];
  errors?: string[];
  ready_models?: CompatibleModel[];
  compatible_models?: CompatibleModel[];
  export_cache?: ExportCacheEntry[];
}

interface Dataset {
  id: string;
  name: string;
  images: number;
  classes: string[];
  createdAt: string;
  size: string;
  tasks: string[];
  formats: string[];
  warnings?: string[];
  sourceFormat?: string;
  datasetTask?: string;
  datasetTasks?: string[];
  canonicalTask?: string;
  canonicalFormat?: string;
  normalizedFormats?: string[];
  annotationStats?: AnnotationStats;
  conversionWarnings?: string[];
  readyModels?: CompatibleModel[];
  exportCache?: ExportCacheEntry[];
}

const API_URL = apiBaseUrl();

function formatLabel(value?: string) {
  return value ? value.replaceAll("_", " ") : "unknown";
}

function normalizeUploadMessage(message: string) {
  const sentences = message
    .split(/(?<=\.)\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (sentences.length === 0) return message;

  const seen = new Set<string>();
  const unique = sentences.filter((sentence) => {
    if (seen.has(sentence)) return false;
    seen.add(sentence);
    return true;
  });

  const normalized = unique.slice(0, 4).join(" ");
  const omitted = unique.length - 4;
  return omitted > 0 ? `${normalized} ${omitted} more issues were omitted.` : normalized;
}

export default function DatasetPage() {
  const { t } = useLanguage();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<{ datasetName: string; profile: ImportProfile } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDatasets = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/datasets`);
      if (!response.ok) {
        throw new Error(`Dataset service returned ${response.status}`);
      }
      const data = await response.json();
      setDatasets(data.datasets ?? []);
      setLoadError("");
    } catch (error) {
      console.error("Failed to fetch datasets:", error);
      setDatasets([]);
      setLoadError(
        `Dataset service unavailable. ${t("common.backendReachable")}`,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const sendDatasetZip = async <T,>(file: File, endpoint: string, failureLabel: string) => {
    const formData = new FormData();
    formData.append("file", file);
    const xhr = new XMLHttpRequest();

    return new Promise<T>((resolve, reject) => {
      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      xhr.addEventListener("load", () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(parseJsonText(xhr.responseText, `${failureLabel} returned an invalid response`));
          } else {
            const data = parseJsonText<{ detail?: string }>(
              xhr.responseText || "{}",
              `${failureLabel} failed with status ${xhr.status}`,
            );
            reject(new Error(data.detail || `${failureLabel} failed with status ${xhr.status}`));
          }
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
      xhr.addEventListener("error", () => reject(new Error("Network error")));
      xhr.open("POST", `${API_URL}${endpoint}`);
      xhr.send(formData);
    });
  };

  const inspectFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setUploadStatus("error");
      setUploadMessage("Please upload a .zip dataset.");
      return;
    }

    setPendingFile(file);
    setImportPreview(null);
    setIsUploading(true);
    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadMessage(`Inspecting ${file.name}...`);

    try {
      const result = await sendDatasetZip<{ dataset_name: string; profile: ImportProfile }>(
        file,
        "/api/datasets/inspect-upload",
        "Dataset inspection",
      );
      setImportPreview({ datasetName: result.dataset_name, profile: result.profile });
      setUploadStatus("success");
      setUploadProgress(100);
      setUploadMessage(`${result.dataset_name} is ready to import.`);
    } catch (error) {
      setPendingFile(null);
      setUploadStatus("error");
      setUploadMessage(normalizeUploadMessage(error instanceof Error ? error.message : "Inspection failed"));
    } finally {
      setIsUploading(false);
    }
  };

  const importFile = async () => {
    if (!pendingFile) return;
    setIsUploading(true);
    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadMessage(`Importing ${pendingFile.name}...`);

    try {
      const result = await sendDatasetZip<{ dataset_name: string; tasks?: string[] }>(
        pendingFile,
        "/api/datasets/import",
        "Dataset import",
      );
      setUploadStatus("success");
      setUploadProgress(100);
      setUploadMessage(
        `${result.dataset_name} imported. Detected: ${(result.tasks ?? []).join(", ") || "dataset"}`,
      );
      setPendingFile(null);
      setImportPreview(null);
      await fetchDatasets();
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadMessage("");
        setUploadProgress(0);
      }, 2600);
    } catch (error) {
      setUploadStatus("error");
      setUploadMessage(normalizeUploadMessage(error instanceof Error ? error.message : "Import failed"));
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (datasetName: string) => {
    try {
      const response = await fetch(
        `${API_URL}/api/datasets/${encodeURIComponent(datasetName)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        throw new Error(`Delete failed with status ${response.status}`);
      }
      setDeleteError("");
      setDeleteConfirm(null);
      await fetchDatasets();
    } catch (error) {
      console.error("Failed to delete dataset:", error);
      setDeleteError(`Could not delete ${datasetName}. Check the backend and retry.`);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Data"
          title="Dataset Management"
          description={t("dataset.header.description")}
          actions={
            <>
              <Button asChild variant="outline">
                <Link href="/guide?tab=datasets">
                  <BookOpenCheck className="h-4 w-4" />
                  Dataset layouts
                </Link>
              </Button>
              <Button variant="outline" onClick={fetchDatasets} disabled={isLoading}>
                <RefreshCw className={isLoading ? "animate-spin" : ""} />
                Refresh
              </Button>
            </>
          }
        />

        <section className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap gap-2">
                <StatusBadge tone={uploadStatus === "error" ? "danger" : "neutral"}>
                  ZIP upload
                </StatusBadge>
                <Badge variant="secondary">Format detection</Badge>
              </div>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Dataset
              </CardTitle>
              <CardDescription>
                {t("dataset.upload.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) inspectFile(file);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              />
              <div
                onDragOver={(event) => {
                  event.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDragging(false);
                  const file = event.dataTransfer.files?.[0];
                  if (file) inspectFile(file);
                }}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                className={`cursor-pointer rounded-lg border border-dashed p-8 text-center transition-colors sm:p-10 ${
                  isDragging
                    ? "border-foreground bg-accent"
                    : "border-border bg-background/70 hover:bg-accent/70"
                }`}
              >
                <div className="flex flex-col items-center">
                  {uploadStatus === "uploading" ? (
                    <>
                      <Archive className="mb-4 h-10 w-10 animate-pulse text-muted-foreground" />
                      <StatusBadge tone="warning">Working</StatusBadge>
                      <p className="mt-3 font-medium">{uploadMessage}</p>
                      <div className="mt-4 w-full max-w-sm">
                        <Progress value={uploadProgress} className="h-2" />
                        <p className="mt-2 text-sm text-muted-foreground">
                          {uploadProgress}%
                        </p>
                      </div>
                    </>
                  ) : uploadStatus === "success" ? (
                    <>
                      <CheckCircle2 className="mb-4 h-10 w-10 text-emerald-500" />
                      <StatusBadge tone="success">Ready</StatusBadge>
                      <p className="mt-3 max-w-lg font-medium">{uploadMessage}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={(event) => {
                          event.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        <Upload className="h-4 w-4" />
                        Choose another ZIP
                      </Button>
                    </>
                  ) : uploadStatus === "error" ? (
                    <>
                      <AlertCircle className="mb-4 h-10 w-10 text-red-500" />
                      <StatusBadge tone="danger">Upload failed</StatusBadge>
                      <p className="mt-3 max-h-40 max-w-lg overflow-y-auto whitespace-pre-wrap break-words px-1 text-sm font-medium leading-relaxed sm:text-base">
                        {uploadMessage}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={(event) => {
                          event.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        <Upload className="h-4 w-4" />
                        Choose another ZIP
                      </Button>
                    </>
                  ) : (
                    <>
                      <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
                      <p className="font-medium">Drop a dataset ZIP here</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t("dataset.drop.hint")}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-4"
                        onClick={(event) => {
                          event.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        <FolderOpen className="h-4 w-4" />
                        Select ZIP
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import Preview</CardTitle>
              <CardDescription>
                {importPreview ? importPreview.datasetName : t("dataset.preview.empty")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {importPreview ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-background/70 p-3">
                      <p className="text-xs font-medium uppercase text-muted-foreground">Source</p>
                      <p className="mt-1 text-sm font-semibold">{formatLabel(importPreview.profile.source_format)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 p-3">
                      <p className="text-xs font-medium uppercase text-muted-foreground">Task group</p>
                      <p className="mt-1 text-sm font-semibold">{formatLabel(importPreview.profile.dataset_task ?? importPreview.profile.canonical_task)}</p>
                    </div>
                    <div className="rounded-lg border border-border bg-background/70 p-3">
                      <p className="text-xs font-medium uppercase text-muted-foreground">Canonical</p>
                      <p className="mt-1 text-sm font-semibold">{formatLabel(importPreview.profile.canonical_format)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(importPreview.profile.dataset_tasks ?? []).map((task) => (
                      <StatusBadge key={task}>{formatLabel(task)}</StatusBadge>
                    ))}
                    {importPreview.profile.normalized_formats.map((format) => (
                      <Badge key={format} variant="secondary">
                        {format}
                      </Badge>
                    ))}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <StatusBadge>{importPreview.profile.image_count.toLocaleString()} images</StatusBadge>
                    <StatusBadge>{importPreview.profile.classes.length} classes</StatusBadge>
                    <StatusBadge>{importPreview.profile.ready_models?.length ?? 0} ready models</StatusBadge>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Compatible models</p>
                    <div className="flex flex-wrap gap-2">
                      {(importPreview.profile.ready_models ?? []).map((model) => (
                        <Badge key={`${model.task}-${model.id}`}>{model.label}</Badge>
                      ))}
                    </div>
                  </div>
                  {(importPreview.profile.conversion_warnings ?? []).length > 0 && (
                    <div className="space-y-2">
                      {(importPreview.profile.conversion_warnings ?? []).slice(0, 3).map((warning) => (
                        <StatusBadge key={warning} tone="warning">
                          {warning}
                        </StatusBadge>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={importFile} disabled={isUploading || !pendingFile}>
                      <Upload className="h-4 w-4" />
                      Import dataset
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPendingFile(null);
                        setImportPreview(null);
                        setUploadStatus("idle");
                        setUploadMessage("");
                        setUploadProgress(0);
                      }}
                    >
                      Clear
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {[
                    t("dataset.preview.note.inspect"),
                    t("dataset.preview.note.coco"),
                    t("dataset.preview.note.ocr"),
                  ].map((note) => (
                    <div
                      className="flex gap-3 rounded-lg border border-border bg-background/70 p-3"
                      key={note}
                    >
                      <FileArchive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <p className="text-sm leading-6 text-muted-foreground">{note}</p>
                    </div>
                  ))}
                </>
              )}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Dataset Inventory</CardTitle>
            <CardDescription>
              {isLoading
                ? t("dataset.inventory.loading")
                : `${datasets.length} ${t("dataset.inventory.available")}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <EmptyState
                icon={RefreshCw}
                title="Loading datasets"
                description={t("common.loadingBackendInventory")}
              />
            ) : loadError ? (
              <EmptyState
                icon={AlertCircle}
                title="Dataset service unavailable"
                description={loadError}
                actions={
                  <Button variant="outline" onClick={fetchDatasets}>
                    Retry
                  </Button>
                }
              />
            ) : datasets.length === 0 ? (
              <EmptyState
                icon={ImageIcon}
                title="No datasets yet"
                description={t("dataset.empty.description")}
              />
            ) : (
              <div className="space-y-3">
                {deleteError && (
                  <StatusBadge tone="danger" className="w-fit">
                    {deleteError}
                  </StatusBadge>
                )}
                {datasets.map((dataset) => (
                  <article
                    key={dataset.id}
                    className="flex flex-col gap-4 rounded-lg border border-border bg-background/70 p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex min-w-0 gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-card">
                        <Database className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="break-words font-medium">{dataset.name}</h2>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span>{dataset.images.toLocaleString()} images</span>
                          <span>{dataset.classes?.length ?? 0} classes</span>
                          <span>{dataset.size}</span>
                          <span>{dataset.createdAt}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <StatusBadge tone="success">{formatLabel(dataset.datasetTask ?? dataset.canonicalTask)}</StatusBadge>
                          {dataset.canonicalFormat && (
                            <StatusBadge>{formatLabel(dataset.canonicalFormat)}</StatusBadge>
                          )}
                          {(dataset.datasetTasks ?? []).map((task) => (
                            <StatusBadge key={task}>{formatLabel(task)}</StatusBadge>
                          ))}
                          {(dataset.formats ?? []).map((format) => (
                            <Badge key={format} variant="secondary">
                              {format}
                            </Badge>
                          ))}
                        </div>
                        {(dataset.readyModels?.length ?? 0) > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {dataset.readyModels?.slice(0, 6).map((model) => (
                              <Badge key={`${dataset.id}-${model.task}-${model.id}`}>
                                {model.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {(dataset.exportCache?.length ?? 0) > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {dataset.exportCache?.slice(0, 3).map((entry) => (
                              <StatusBadge key={`${entry.model}-${entry.fingerprint}`} tone="success">
                                cached {entry.model}: {entry.export_format}
                              </StatusBadge>
                            ))}
                          </div>
                        )}
                        {(dataset.conversionWarnings?.length ?? 0) > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {dataset.conversionWarnings?.slice(0, 2).map((warning) => (
                              <StatusBadge key={warning} tone="warning">
                                {warning}
                              </StatusBadge>
                            ))}
                          </div>
                        )}
                        {dataset.classes?.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {dataset.classes.slice(0, 10).map((className) => (
                              <Badge key={className}>{className}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end lg:self-auto">
                      {deleteConfirm === dataset.id ? (
                        <>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(dataset.name)}
                          >
                            Confirm delete
                          </Button>
                          <Button
                            aria-label="Cancel delete"
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          aria-label={`Delete ${dataset.name}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(dataset.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
