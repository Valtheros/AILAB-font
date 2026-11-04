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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/workspace/empty-state";
import { LoadingState } from "@/components/workspace/loading-state";
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
  RotateCcw,
  Settings2,
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
  collectionId?: string | null;
  collectionName?: string | null;
  version?: number | null;
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
  compatibleModels?: CompatibleModel[];
  exportCache?: ExportCacheEntry[];
}

interface DatasetTagPreference {
  tasks: string[];
  models: string[];
}

const DATASET_TAGS_STORAGE_KEY = "ailab.dataset-display-tags.v1";

function datasetClassNames(dataset: Dataset) {
  return dataset.classes.filter((className) => !/^\d+$/.test(className.trim()));
}

const API_URL = apiBaseUrl();
const MAX_DATASET_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;
const UPLOAD_IDLE_TIMEOUT_MS = 60_000;

function formatLabel(value?: string) {
  return value ? value.replaceAll("_", " ") : "unknown";
}

function taskTagOptions(dataset: Dataset) {
  const options = [
    ...defaultDatasetTags(dataset).tasks,
    ...(dataset.compatibleModels ?? []).map((model) => model.dataset_task ?? model.task),
  ];
  return [...new Set(options)].map((id) => ({ id, label: formatLabel(id) }));
}

function modelTagOptions(dataset: Dataset) {
  return [...new Map((dataset.compatibleModels ?? dataset.readyModels ?? []).map((model) => [model.id, { id: model.id, label: model.label }])).values()];
}

function defaultDatasetTags(dataset: Dataset): DatasetTagPreference {
  const task = dataset.datasetTask ?? dataset.canonicalTask;
  return {
    tasks: task ? [task] : [],
    models: (dataset.readyModels ?? []).map((model) => model.id),
  };
}

function displayModelTags(dataset: Dataset, preference?: DatasetTagPreference) {
  const labels = new Map(modelTagOptions(dataset).map((model) => [model.id, model.label]));
  return (preference ?? defaultDatasetTags(dataset)).models.map((id) => ({ id, label: labels.get(id) ?? id }));
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
  const { t, language } = useLanguage();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState<"uploading" | "inspecting" | "importing">("uploading");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingUploadToken, setPendingUploadToken] = useState<string | null>(null);
  const [importPreview, setImportPreview] = useState<{ datasetName: string; profile: ImportProfile } | null>(null);
  const [collectionChoice, setCollectionChoice] = useState("new");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleteImpact, setDeleteImpact] = useState<{ runCount: number; activeCount: number } | null>(null);
  const deleteRequest = useRef(0);
  const [classDialog, setClassDialog] = useState<{ name: string; classes: string[] } | null>(null);
  const [tagDialog, setTagDialog] = useState<Dataset | null>(null);
  const [tagPreferences, setTagPreferences] = useState<Record<string, DatasetTagPreference>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadRequestRef = useRef<XMLHttpRequest | null>(null);

  useEffect(() => () => uploadRequestRef.current?.abort(), []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(DATASET_TAGS_STORAGE_KEY) ?? "{}");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore browser-only preferences after hydration.
      if (stored && typeof stored === "object") setTagPreferences(stored);
    } catch {
      localStorage.removeItem(DATASET_TAGS_STORAGE_KEY);
    }
  }, []);

  const saveTagPreferences = (next: Record<string, DatasetTagPreference>) => {
    setTagPreferences(next);
    localStorage.setItem(DATASET_TAGS_STORAGE_KEY, JSON.stringify(next));
  };

  const toggleDisplayTag = (kind: keyof DatasetTagPreference, value: string) => {
    if (!tagDialog) return;
    const current = tagPreferences[tagDialog.id] ?? defaultDatasetTags(tagDialog);
    const values = current[kind].includes(value)
      ? current[kind].filter((item) => item !== value)
      : [...current[kind], value];
    saveTagPreferences({ ...tagPreferences, [tagDialog.id]: { ...current, [kind]: values } });
  };

  const resetDisplayTags = () => {
    if (!tagDialog) return;
    const next = { ...tagPreferences };
    delete next[tagDialog.id];
    saveTagPreferences(next);
  };

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
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Start the initial dataset request and loading state.
    fetchDatasets();
  }, [fetchDatasets]);

  const sendDatasetZip = async <T,>(file: File, endpoint: string, failureLabel: string) => {
    const formData = new FormData();
    formData.append("file", file);
    const xhr = new XMLHttpRequest();
    uploadRequestRef.current = xhr;

    return new Promise<T>((resolve, reject) => {
      let idleTimer: ReturnType<typeof setTimeout> | undefined;
      let stalled = false;
      let lastUploadedBytes = 0;
      const clearIdleTimer = () => clearTimeout(idleTimer);
      const resetIdleTimer = () => {
        clearIdleTimer();
        idleTimer = setTimeout(() => {
          stalled = true;
          xhr.abort();
        }, UPLOAD_IDLE_TIMEOUT_MS);
      };
      xhr.upload.addEventListener("progress", (event) => {
        if (event.loaded > lastUploadedBytes) {
          lastUploadedBytes = event.loaded;
          resetIdleTimer();
        }
        if (event.lengthComputable) {
          setUploadProgress(Math.round((event.loaded / event.total) * 100));
        }
      });
      xhr.upload.addEventListener("load", () => {
        clearIdleTimer();
        setUploadStage("inspecting");
        setUploadMessage(t("dataset.upload.inspecting").replace("{name}", file.name));
      });
      xhr.addEventListener("readystatechange", () => {
        if (xhr.readyState >= 2 && xhr.status === 413) {
          reject(new Error(t("dataset.upload.tooLargeProxy")));
          xhr.abort();
        }
      });
      xhr.addEventListener("load", () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(parseJsonText(xhr.responseText, `${failureLabel} returned an invalid response`));
          } else if (xhr.status === 413) {
            reject(new Error(t("dataset.upload.tooLargeProxy")));
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
      xhr.addEventListener("error", () => reject(new Error(t("dataset.upload.networkError"))));
      xhr.addEventListener("abort", () => reject(new Error(t(stalled ? "dataset.upload.stalled" : "dataset.upload.cancelled"))));
      xhr.addEventListener("loadend", () => {
        clearIdleTimer();
        if (uploadRequestRef.current === xhr) uploadRequestRef.current = null;
      });
      try {
        xhr.open("POST", `${API_URL}${endpoint}`);
        resetIdleTimer();
        xhr.send(formData);
      } catch (error) {
        clearIdleTimer();
        if (uploadRequestRef.current === xhr) uploadRequestRef.current = null;
        reject(error);
      }
    });
  };

  const inspectFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setUploadStatus("error");
      setUploadMessage("Please upload a .zip dataset.");
      return;
    }

    if (file.size > MAX_DATASET_UPLOAD_BYTES) {
      setPendingFile(null);
      setPendingUploadToken(null);
      setImportPreview(null);
      setUploadStatus("error");
      setUploadMessage(t("dataset.upload.tooLargeApp"));
      return;
    }

    setPendingFile(file);
    setPendingUploadToken(null);
    setImportPreview(null);
    setIsUploading(true);
    setUploadStage("uploading");
    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadMessage(t("dataset.upload.uploading").replace("{name}", file.name));

    try {
      const result = await sendDatasetZip<{ dataset_name: string; profile: ImportProfile; uploadToken: string }>(
        file,
        "/api/datasets/inspect-upload",
        "Dataset inspection",
      );
      setImportPreview({ datasetName: result.dataset_name, profile: result.profile });
      const matches = new Map(datasets.filter((dataset) => dataset.collectionId && dataset.collectionName === result.dataset_name)
        .map((dataset) => [dataset.collectionId!, dataset.collectionName!]));
      setCollectionChoice(matches.size === 1 ? [...matches.keys()][0] : "new");
      setPendingUploadToken(result.uploadToken);
      setUploadStatus("success");
      setUploadProgress(100);
      setUploadMessage(`${result.dataset_name} is ready to import.`);
    } catch (error) {
      setPendingFile(null);
      setPendingUploadToken(null);
      setUploadStatus("error");
      setUploadMessage(normalizeUploadMessage(error instanceof Error ? error.message : "Inspection failed"));
    } finally {
      setIsUploading(false);
    }
  };

  const importFile = async () => {
    if (!pendingFile || !pendingUploadToken) return;
    setIsUploading(true);
    setUploadStage("importing");
    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadMessage(`Importing ${pendingFile.name}...`);

    try {
      const response = await fetch(`${API_URL}/api/datasets/import`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ uploadToken: pendingUploadToken, collectionId: collectionChoice === "new" ? null : collectionChoice }),
      });
      const result = parseJsonText<{ dataset_name?: string; tasks?: string[]; detail?: string }>(
        await response.text(), "Dataset import returned an invalid response",
      );
      if (!response.ok || !result.dataset_name) throw new Error(result.detail || `Dataset import failed with status ${response.status}`);
      setUploadStatus("success");
      setUploadProgress(100);
      setUploadMessage(
        `${result.dataset_name} imported. Detected: ${(result.tasks ?? []).join(", ") || "dataset"}`,
      );
      setPendingFile(null);
      setPendingUploadToken(null);
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
        const data = await response.json().catch(() => ({}));
        throw new Error(data.detail || `Delete failed with status ${response.status}`);
      }
      setDeleteError("");
      setDeleteConfirm(null);
      setDeleteImpact(null);
      deleteRequest.current += 1;
      await fetchDatasets();
    } catch (error) {
      console.error("Failed to delete dataset:", error);
      setDeleteError(
        error instanceof Error ? error.message : `Could not delete ${datasetName}. Check the backend and retry.`,
      );
    }
  };

  const prepareDelete = async (dataset: Dataset) => {
    const request = ++deleteRequest.current;
    setDeleteConfirm(dataset.id);
    setDeleteImpact(null);
    setDeleteError("");
    try {
      const response = await fetch(`${API_URL}/api/datasets/${encodeURIComponent(dataset.name)}/impact`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail || "Could not check dataset usage.");
      if (request === deleteRequest.current) setDeleteImpact(result);
    } catch (error) {
      if (request === deleteRequest.current) setDeleteError(error instanceof Error ? error.message : "Could not check dataset usage.");
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
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
                disabled={isUploading}
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
                  if (isUploading) return;
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
                      <StatusBadge tone="warning">{t("dataset.upload.working")}</StatusBadge>
                      <p className="mt-3 font-medium">{uploadMessage}</p>
                      {uploadStage === "uploading" && (
                        <div className="mt-4 w-full max-w-sm">
                          <Progress value={uploadProgress} className="h-2" />
                          <p className="mt-2 text-sm text-muted-foreground">{uploadProgress}%</p>
                          <p className="mt-1 text-xs text-muted-foreground">{t("dataset.upload.stallHint")}</p>
                        </div>
                      )}
                      {uploadStage === "uploading" && (
                        <Button variant="outline" size="sm" className="mt-4" onClick={(event) => {
                          event.stopPropagation();
                          uploadRequestRef.current?.abort();
                        }}>
                          <X className="h-4 w-4" />
                          {t("dataset.upload.cancel")}
                        </Button>
                      )}
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
                      <StatusBadge tone="danger">{t("dataset.upload.failed")}</StatusBadge>
                      <p role="alert" className="mt-3 max-h-40 max-w-lg overflow-y-auto whitespace-pre-wrap break-words px-1 text-sm font-medium leading-relaxed sm:text-base">
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
                        {t("dataset.upload.chooseAnother")}
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
                  <div className="space-y-2">
                    <label htmlFor="dataset-collection" className="text-sm font-medium">
                      {language === "th" ? "บันทึกเป็น" : "Save as"}
                    </label>
                    <select id="dataset-collection" value={collectionChoice} onChange={(event) => setCollectionChoice(event.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" disabled={isUploading}>
                      <option value="new">{language === "th" ? "ชุดข้อมูลใหม่" : "New dataset"}</option>
                      {[...new Map(datasets.filter((dataset) => dataset.collectionId)
                        .map((dataset) => [dataset.collectionId!, dataset.collectionName || dataset.name])).entries()].map(([id, name]) => (
                          <option key={id} value={id}>{language === "th" ? "เวอร์ชันใหม่ของ" : "New version of"} {name} ({id.slice(0, 8)})</option>
                        ))}
                    </select>
                    <p className="text-xs text-muted-foreground">{language === "th" ? "ข้อมูลเวอร์ชันเดิมจะยังคงอยู่" : "Existing dataset versions are preserved."}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={importFile} disabled={isUploading || !pendingFile || !pendingUploadToken}>
                      <Upload className="h-4 w-4" />
                      Import dataset
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPendingFile(null);
                        setPendingUploadToken(null);
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
              <LoadingState compact icon={Database} title={language === "th" ? "กำลังโหลดชุดข้อมูล" : "Loading datasets"} />
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
                        <h2 className="break-words font-medium">{dataset.collectionName || dataset.name}{dataset.version ? ` · v${dataset.version}` : ""}</h2>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                          <span>{dataset.images.toLocaleString()} images</span>
                          <span>{dataset.size}</span>
                          <span>{dataset.createdAt}</span>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <p className="text-xs font-medium uppercase text-muted-foreground">Display tags</p>
                          <Button className="h-7 px-2 text-xs" variant="ghost" size="sm" onClick={() => setTagDialog(dataset)}>
                            <Settings2 className="h-3.5 w-3.5" />Customize
                          </Button>
                        </div>
                        <div className="mt-3 grid gap-4 md:grid-cols-3">
                          <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">Task</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {(tagPreferences[dataset.id]?.tasks ?? defaultDatasetTags(dataset).tasks).map((task) => (
                                <StatusBadge key={task} tone="success">{formatLabel(task)}</StatusBadge>
                              ))}
                              {(tagPreferences[dataset.id]?.tasks ?? defaultDatasetTags(dataset).tasks).length === 0 && <span className="text-xs text-muted-foreground">No task tags</span>}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-medium uppercase text-muted-foreground">Models</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {displayModelTags(dataset, tagPreferences[dataset.id]).map((model) => (
                                <Badge key={`${dataset.id}-${model.id}`}>{model.label}</Badge>
                              ))}
                              {displayModelTags(dataset, tagPreferences[dataset.id]).length === 0 && <span className="text-xs text-muted-foreground">No model tags</span>}
                            </div>
                          </div>
                          {dataset.classes?.length > 0 && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground">Classes ({datasetClassNames(dataset).length})</p>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {datasetClassNames(dataset).slice(0, 10).map((className) => <Badge key={className}>{className}</Badge>)}
                                {datasetClassNames(dataset).length > 10 && (
                                  <Button className="h-auto px-1 py-0.5 text-xs" onClick={() => setClassDialog({ name: dataset.name, classes: datasetClassNames(dataset) })} size="sm" type="button" variant="ghost">
                                    +{datasetClassNames(dataset).length - 10} more
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        {(dataset.conversionWarnings?.length ?? 0) > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {dataset.conversionWarnings?.slice(0, 2).map((warning) => (
                              <StatusBadge key={warning} tone="warning">
                                {warning}
                              </StatusBadge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 self-end lg:self-auto">
                      <div className="flex items-center gap-2">
                      <Button asChild variant="outline" size="sm"><Link href={`/dataset/${encodeURIComponent(dataset.id)}`}><FolderOpen className="h-4 w-4" />{language === "th" ? "รายละเอียด" : "Details"}</Link></Button>
                      {deleteConfirm === dataset.id ? (
                        <>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(dataset.name)}
                            disabled={!deleteImpact || deleteImpact.activeCount > 0}
                          >
                            Confirm delete
                          </Button>
                          <Button
                            aria-label="Cancel delete"
                            variant="ghost"
                            size="icon"
                            onClick={() => { deleteRequest.current += 1; setDeleteConfirm(null); setDeleteImpact(null); }}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button
                          aria-label={`Delete ${dataset.name}`}
                          variant="ghost"
                          size="icon"
                          onClick={() => prepareDelete(dataset)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                      </div>
                      {deleteConfirm === dataset.id && (
                        <p className="max-w-xs text-right text-xs text-muted-foreground" role="status">
                          {deleteImpact ? (language === "th"
                            ? `มี ${deleteImpact.runCount} งานที่อ้างอิงข้อมูลนี้ ลบแล้วจะเทรนหรือประเมินซ้ำจากชุดนี้ไม่ได้${deleteImpact.activeCount ? " กรุณาหยุดงานที่ใช้งานอยู่ก่อน" : ""}`
                            : `${deleteImpact.runCount} runs reference this dataset. Deleting it prevents retraining or evaluation from this version.${deleteImpact.activeCount ? " Stop active jobs first." : ""}`)
                            : (language === "th" ? "กำลังตรวจสอบงานที่เกี่ยวข้อง" : "Checking dataset usage")}
                        </p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <Dialog open={tagDialog !== null} onOpenChange={(open) => !open && setTagDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Customize display tags</DialogTitle>
              <DialogDescription>
                These tags only change how {tagDialog?.name} appears in this browser. Training compatibility is unchanged.
              </DialogDescription>
            </DialogHeader>
            {tagDialog && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm font-medium">Task tags</p>
                  <div className="flex flex-wrap gap-2">
                    {taskTagOptions(tagDialog).map((option) => {
                      const selected = (tagPreferences[tagDialog.id] ?? defaultDatasetTags(tagDialog)).tasks.includes(option.id);
                      return <Button aria-pressed={selected} key={option.id} size="sm" variant={selected ? "default" : "outline"} onClick={() => toggleDisplayTag("tasks", option.id)}>{option.label}</Button>;
                    })}
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Model tags</p>
                  <div className="flex flex-wrap gap-2">
                    {modelTagOptions(tagDialog).map((option) => {
                      const selected = (tagPreferences[tagDialog.id] ?? defaultDatasetTags(tagDialog)).models.includes(option.id);
                      return <Button aria-pressed={selected} key={option.id} size="sm" variant={selected ? "default" : "outline"} onClick={() => toggleDisplayTag("models", option.id)}>{option.label}</Button>;
                    })}
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={resetDisplayTags}><RotateCcw className="h-4 w-4" />Reset</Button>
              <Button onClick={() => setTagDialog(null)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={classDialog !== null} onOpenChange={(open) => !open && setClassDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{classDialog?.name} Classes</DialogTitle>
              <DialogDescription>
                {t("dataset.classes.dialogDescription").replace(
                  "{count}",
                  String(classDialog?.classes.length ?? 0),
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="flex max-h-[60vh] flex-wrap gap-2 overflow-y-auto pr-1">
              {classDialog?.classes.map((className) => (
                <Badge key={className}>{className}</Badge>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
