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
}

const API_URL = apiBaseUrl();

export default function DatasetPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [uploadMessage, setUploadMessage] = useState("");
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
        "Dataset service unavailable. Start the backend and refresh this page.",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const uploadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setUploadStatus("error");
      setUploadMessage("Please upload a .zip dataset.");
      return;
    }

    setIsUploading(true);
    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadMessage(`Uploading ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const xhr = new XMLHttpRequest();

      const result = await new Promise<{
        dataset_name: string;
        tasks?: string[];
        formats?: string[];
      }>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        });
        xhr.addEventListener("load", () => {
          try {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(parseJsonText(xhr.responseText, "Upload returned an invalid response"));
            } else {
              const data = parseJsonText<{ detail?: string }>(
                xhr.responseText || "{}",
                `Upload failed with status ${xhr.status}`,
              );
              reject(new Error(data.detail || `Upload failed with status ${xhr.status}`));
            }
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.open("POST", `${API_URL}/api/upload-dataset`);
        xhr.send(formData);
      });

      setUploadStatus("success");
      setUploadProgress(100);
      setUploadMessage(
        `${result.dataset_name} uploaded. Detected: ${(result.tasks ?? []).join(", ") || "dataset"}`,
      );
      await fetchDatasets();
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadMessage("");
        setIsUploading(false);
        setUploadProgress(0);
      }, 2600);
    } catch (error) {
      setUploadStatus("error");
      setUploadMessage(error instanceof Error ? error.message : "Upload failed");
      setIsUploading(false);
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadMessage("");
        setUploadProgress(0);
      }, 4500);
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
          description="Upload ZIP datasets, inspect detected formats, and keep training inputs compatible with the selected model."
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
                Supported: YOLO detection, ImageFolder classification, semantic
                masks, COCO instances, PaddleOCR labels, and Tesseract ground truth.
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
                  if (file) uploadFile(file);
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
                  if (file) uploadFile(file);
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
                      <StatusBadge tone="warning">Uploading</StatusBadge>
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
                      <StatusBadge tone="success">Upload complete</StatusBadge>
                      <p className="mt-3 max-w-lg font-medium">{uploadMessage}</p>
                    </>
                  ) : uploadStatus === "error" ? (
                    <>
                      <AlertCircle className="mb-4 h-10 w-10 text-red-500" />
                      <StatusBadge tone="danger">Upload failed</StatusBadge>
                      <p className="mt-3 max-w-lg font-medium">{uploadMessage}</p>
                    </>
                  ) : (
                    <>
                      <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
                      <p className="font-medium">Drop a dataset ZIP here</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        or click to select a file
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
              <CardTitle>Detection Notes</CardTitle>
              <CardDescription>
                Metadata appears after the backend inspects the archive.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Detected task families are surfaced as status chips.",
                "Formats gate compatible model choices in configuration.",
                "Classes and warnings stay attached to each dataset row.",
              ].map((note) => (
                <div
                  className="flex gap-3 rounded-lg border border-border bg-background/70 p-3"
                  key={note}
                >
                  <FileArchive className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <p className="text-sm leading-6 text-muted-foreground">{note}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Dataset Inventory</CardTitle>
            <CardDescription>
              {isLoading ? "Loading datasets..." : `${datasets.length} datasets available`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <EmptyState
                icon={RefreshCw}
                title="Loading datasets"
                description="Waiting for the backend inventory response."
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
                description="Upload a ZIP archive to make it available for model configuration."
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
                          {(dataset.tasks ?? []).map((task) => (
                            <StatusBadge key={task}>{task}</StatusBadge>
                          ))}
                          {(dataset.formats ?? []).map((format) => (
                            <Badge key={format} variant="secondary">
                              {format}
                            </Badge>
                          ))}
                        </div>
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
