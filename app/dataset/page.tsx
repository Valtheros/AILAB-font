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
  Upload,
  FolderOpen,
  Image as ImageIcon,
  FileText,
  Trash2,
  Eye,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Archive,
  X,
} from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface Dataset {
  id: string;
  name: string;
  images: number;
  classes: string[];
  createdAt: string;
  size: string;
}

const API_URL = "http://localhost:8000";

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
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch datasets from backend
  const fetchDatasets = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/datasets`);
      if (res.ok) {
        const data = await res.json();
        setDatasets(data.datasets || []);
      }
    } catch (error) {
      console.error("Failed to fetch datasets:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDatasets();
  }, [fetchDatasets]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadFile(files[0]);
    }
    // Reset input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const uploadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".zip")) {
      setUploadStatus("error");
      setUploadMessage("กรุณาอัพโหลดไฟล์ .zip เท่านั้น");
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadMessage("");
      }, 4000);
      return;
    }

    setIsUploading(true);
    setUploadStatus("uploading");
    setUploadProgress(0);
    setUploadMessage(`กำลังอัพโหลด ${file.name}...`);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      const uploadPromise = new Promise<{
        status: string;
        dataset_name: string;
      }>((resolve, reject) => {
        xhr.upload.addEventListener("progress", (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            setUploadProgress(percent);
          }
        });

        xhr.addEventListener("load", () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              resolve(JSON.parse(xhr.responseText));
            } catch {
              reject(new Error("Invalid response"));
            }
          } else {
            try {
              const errData = JSON.parse(xhr.responseText);
              reject(new Error(errData.detail || "Upload failed"));
            } catch {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener("error", () => reject(new Error("Network error")));
        xhr.addEventListener("abort", () =>
          reject(new Error("Upload cancelled")),
        );

        xhr.open("POST", `${API_URL}/api/upload-dataset`);
        xhr.send(formData);
      });

      const result = await uploadPromise;
      setUploadStatus("success");
      setUploadMessage(`อัพโหลด "${result.dataset_name}" สำเร็จ!`);
      setUploadProgress(100);

      // Refresh the datasets list
      await fetchDatasets();

      // Reset after delay
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadMessage("");
        setIsUploading(false);
        setUploadProgress(0);
      }, 3000);
    } catch (error: any) {
      setUploadStatus("error");
      setUploadMessage(error.message || "อัพโหลดไม่สำเร็จ");
      setIsUploading(false);
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadMessage("");
        setUploadProgress(0);
      }, 4000);
    }
  };

  const handleDelete = async (datasetName: string) => {
    try {
      const res = await fetch(
        `${API_URL}/api/datasets/${encodeURIComponent(datasetName)}`,
        {
          method: "DELETE",
        },
      );
      if (res.ok) {
        setDeleteConfirm(null);
        await fetchDatasets();
      } else {
        console.error("Failed to delete dataset");
      }
    } catch (error) {
      console.error("Failed to delete dataset:", error);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Dataset Management
            </h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              จัดการ Dataset สำหรับ Training
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchDatasets}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        {/* Upload Zone */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload Dataset
            </CardTitle>
            <CardDescription>
              อัพโหลด Dataset เป็นไฟล์ ZIP ที่มีโครงสร้าง YOLO format
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".zip"
              className="hidden"
              onChange={handleFileSelect}
              aria-label="Dataset Upload"
              title="Dataset Upload"
            />

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !isUploading && fileInputRef.current?.click()}
              className={`relative cursor-pointer rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                isDragging
                  ? "border-gray-900 bg-gray-100 dark:border-white dark:bg-gray-800"
                  : isUploading
                    ? "border-gray-300 cursor-not-allowed dark:border-gray-700"
                    : "border-gray-300 hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:border-gray-600 dark:hover:bg-gray-800/50"
              }`}
            >
              <div className="flex flex-col items-center">
                {uploadStatus === "uploading" ? (
                  <>
                    <div className="mb-4 rounded-full bg-blue-100 p-4 dark:bg-blue-900/30">
                      <Archive className="h-8 w-8 animate-pulse text-blue-600 dark:text-blue-400" />
                    </div>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">
                      {uploadMessage}
                    </p>
                    <div className="mt-4 w-full max-w-sm">
                      <Progress value={uploadProgress} className="h-2" />
                      <p className="mt-2 text-sm text-gray-500">
                        {uploadProgress}%
                      </p>
                    </div>
                  </>
                ) : uploadStatus === "success" ? (
                  <>
                    <div className="mb-4 rounded-full bg-green-100 p-4 dark:bg-green-900/30">
                      <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <p className="text-lg font-medium text-green-600 dark:text-green-400">
                      {uploadMessage}
                    </p>
                  </>
                ) : uploadStatus === "error" ? (
                  <>
                    <div className="mb-4 rounded-full bg-red-100 p-4 dark:bg-red-900/30">
                      <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <p className="text-lg font-medium text-red-600 dark:text-red-400">
                      {uploadMessage}
                    </p>
                  </>
                ) : (
                  <>
                    <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-gray-800">
                      <Upload className="h-8 w-8 text-gray-500" />
                    </div>
                    <p className="text-lg font-medium text-gray-900 dark:text-white">
                      ลากไฟล์ ZIP มาวางที่นี่
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      หรือ คลิกเพื่อเลือกไฟล์ (.zip เท่านั้น)
                    </p>
                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        <FolderOpen className="mr-2 h-4 w-4" />
                        Select ZIP File
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Format info */}
            <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
              <h4 className="font-medium text-gray-900 dark:text-white">
                โครงสร้าง Dataset ที่รองรับ (ZIP):
              </h4>
              <div className="mt-3 rounded-lg bg-gray-900 p-4 dark:bg-gray-950">
                <pre className="text-xs text-green-400 font-mono leading-relaxed">
                  {`dataset.zip
├── data.yaml          # Config file (classes, paths)
├── train/
│   ├── images/        # Training images (.jpg, .png)
│   └── labels/        # YOLO annotations (.txt)
├── valid/
│   ├── images/        # Validation images
│   └── labels/        # Validation annotations
└── test/              # (Optional)
    ├── images/
    └── labels/`}
                </pre>
              </div>
              <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>
                  • <strong>Images:</strong> .jpg, .jpeg, .png, .bmp, .webp
                </li>
                <li>
                  • <strong>Annotations:</strong> YOLO format (.txt) - class_id
                  x_center y_center width height
                </li>
                <li>
                  • <strong>Config:</strong> data.yaml (classes list, train/val
                  paths)
                </li>
                <li>
                  • <strong>Export จาก:</strong> Roboflow, CVAT, LabelImg, หรือ
                  tools อื่นๆ ที่ export เป็น YOLO format
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Dataset List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Datasets</CardTitle>
            <CardDescription>
              {isLoading
                ? "กำลังโหลด..."
                : `${datasets.length} datasets available`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                <p className="mt-4 text-gray-500">กำลังโหลด datasets...</p>
              </div>
            ) : datasets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ImageIcon className="h-12 w-12 text-gray-300 dark:text-gray-700" />
                <p className="mt-4 text-gray-500">ยังไม่มี Dataset</p>
                <p className="text-sm text-gray-400">
                  อัพโหลด Dataset แรกของคุณเพื่อเริ่มต้น
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {datasets.map((dataset) => (
                  <div
                    key={dataset.id}
                    className="flex items-center justify-between rounded-xl border border-gray-200 p-4 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                        <ImageIcon className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {dataset.name}
                        </h3>
                        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                          <span>{dataset.images.toLocaleString()} images</span>
                          <span>•</span>
                          <span>
                            {dataset.classes.length > 0
                              ? `${dataset.classes.length} classes`
                              : "No classes found"}
                          </span>
                          <span>•</span>
                          <span>{dataset.size}</span>
                          <span>•</span>
                          <span>{dataset.createdAt}</span>
                        </div>
                        {dataset.classes.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {dataset.classes.slice(0, 8).map((cls, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              >
                                {cls}
                              </span>
                            ))}
                            {dataset.classes.length > 8 && (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                +{dataset.classes.length - 8} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {deleteConfirm === dataset.id ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-red-500">ลบ?</span>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(dataset.name)}
                          >
                            ยืนยัน
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteConfirm(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteConfirm(dataset.id)}
                        >
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
