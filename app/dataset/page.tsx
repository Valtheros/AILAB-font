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
  AlertCircle,
  Archive,
  CheckCircle2,
  Database,
  FolderOpen,
  Image as ImageIcon,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function DatasetPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [uploadMessage, setUploadMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDatasets = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/datasets`);
      const data = response.ok ? await response.json() : { datasets: [] };
      setDatasets(data.datasets ?? []);
    } catch (error) {
      console.error("Failed to fetch datasets:", error);
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

      const result = await new Promise<{ dataset_name: string; tasks?: string[]; formats?: string[] }>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            setUploadProgress(Math.round((event.loaded / event.total) * 100));
          }
        });
        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            const data = JSON.parse(xhr.responseText || "{}");
            reject(new Error(data.detail || `Upload failed with status ${xhr.status}`));
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
      const response = await fetch(`${API_URL}/api/datasets/${encodeURIComponent(datasetName)}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setDeleteConfirm(null);
        await fetchDatasets();
      }
    } catch (error) {
      console.error("Failed to delete dataset:", error);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">Dataset Management</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Upload ZIP datasets for detection, classification, segmentation, or OCR training.
            </p>
          </div>
          <Button variant="outline" onClick={fetchDatasets} disabled={isLoading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Dataset
            </CardTitle>
            <CardDescription>
              Supported: YOLO detection, ImageFolder classification, semantic masks, COCO instances,
              PaddleOCR labels, and Tesseract ground truth.
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
              className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
                isDragging
                  ? "border-gray-900 bg-gray-100 dark:border-white dark:bg-gray-900"
                  : "border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-900"
              }`}
            >
              <div className="flex flex-col items-center">
                {uploadStatus === "uploading" ? (
                  <>
                    <Archive className="mb-4 h-10 w-10 animate-pulse text-blue-500" />
                    <p className="font-medium text-gray-900 dark:text-white">{uploadMessage}</p>
                    <div className="mt-4 w-full max-w-sm">
                      <Progress value={uploadProgress} className="h-2" />
                      <p className="mt-2 text-sm text-gray-500">{uploadProgress}%</p>
                    </div>
                  </>
                ) : uploadStatus === "success" ? (
                  <>
                    <CheckCircle2 className="mb-4 h-10 w-10 text-green-500" />
                    <p className="font-medium text-green-600 dark:text-green-400">{uploadMessage}</p>
                  </>
                ) : uploadStatus === "error" ? (
                  <>
                    <AlertCircle className="mb-4 h-10 w-10 text-red-500" />
                    <p className="font-medium text-red-600 dark:text-red-400">{uploadMessage}</p>
                  </>
                ) : (
                  <>
                    <Upload className="mb-4 h-10 w-10 text-gray-400" />
                    <p className="font-medium text-gray-900 dark:text-white">Drop a dataset ZIP here</p>
                    <p className="mt-1 text-sm text-gray-500">or click to select a file</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4"
                      onClick={(event) => {
                        event.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                    >
                      <FolderOpen className="mr-2 h-4 w-4" />
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
            <CardTitle>Your Datasets</CardTitle>
            <CardDescription>{isLoading ? "Loading..." : `${datasets.length} datasets available`}</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                <p className="mt-4 text-gray-500">Loading datasets...</p>
              </div>
            ) : datasets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ImageIcon className="h-12 w-12 text-gray-300 dark:text-gray-700" />
                <p className="mt-4 text-gray-500">No datasets yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {datasets.map((dataset) => (
                  <div
                    key={dataset.id}
                    className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4 dark:border-gray-800 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex gap-4">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-900">
                        <Database className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">{dataset.name}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                          <span>{dataset.images.toLocaleString()} images</span>
                          <span>{dataset.classes?.length ?? 0} classes</span>
                          <span>{dataset.size}</span>
                          <span>{dataset.createdAt}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {(dataset.tasks ?? []).map((task) => (
                            <span key={task} className="rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                              {task}
                            </span>
                          ))}
                          {(dataset.formats ?? []).map((format) => (
                            <span key={format} className="rounded-full border border-gray-200 px-2 py-1 text-xs text-gray-500 dark:border-gray-800">
                              {format}
                            </span>
                          ))}
                        </div>
                        {dataset.classes?.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {dataset.classes.slice(0, 10).map((className) => (
                              <span key={className} className="text-xs text-gray-500">
                                {className}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end lg:self-auto">
                      {deleteConfirm === dataset.id ? (
                        <>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(dataset.name)}>
                            Confirm
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <Button variant="ghost" size="icon" onClick={() => setDeleteConfirm(dataset.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
