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
import {
  Upload,
  FolderOpen,
  Image as ImageIcon,
  FileText,
  Trash2,
  Eye,
  Plus,
} from "lucide-react";
import { useState } from "react";

interface Dataset {
  id: string;
  name: string;
  images: number;
  classes: string[];
  createdAt: string;
  size: string;
}

const mockDatasets: Dataset[] = [
  {
    id: "1",
    name: "traffic_signs",
    images: 1234,
    classes: ["stop", "yield", "speed_limit", "no_entry"],
    createdAt: "2024-12-19",
    size: "2.3 GB",
  },
  {
    id: "2",
    name: "vehicles",
    images: 5678,
    classes: ["car", "truck", "motorcycle", "bicycle"],
    createdAt: "2024-12-18",
    size: "8.1 GB",
  },
];

export default function DatasetPage() {
  const [datasets] = useState<Dataset[]>(mockDatasets);
  const [isDragging, setIsDragging] = useState(false);

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
    // Handle file drop - will connect to backend later
    console.log("Files dropped:", e.dataTransfer.files);
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
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Dataset
          </Button>
        </div>

        {/* Upload Zone */}
        <Card>
          <CardHeader>
            <CardTitle>Upload Dataset</CardTitle>
            <CardDescription>
              รองรับรูปแบบ YOLO format (.txt annotations) และรูปภาพ (.jpg, .png)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`relative rounded-xl border-2 border-dashed p-12 text-center transition-all ${
                isDragging
                  ? "border-gray-900 bg-gray-100 dark:border-white dark:bg-gray-800"
                  : "border-gray-300 hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600"
              }`}
            >
              <div className="flex flex-col items-center">
                <div className="mb-4 rounded-full bg-gray-100 p-4 dark:bg-gray-800">
                  <Upload className="h-8 w-8 text-gray-500" />
                </div>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  ลากไฟล์มาวางที่นี่
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  หรือ คลิกเพื่อเลือกไฟล์
                </p>
                <div className="mt-4 flex items-center gap-4">
                  <Button variant="outline" size="sm">
                    <FolderOpen className="mr-2 h-4 w-4" />
                    Select Folder
                  </Button>
                  <Button variant="outline" size="sm">
                    <FileText className="mr-2 h-4 w-4" />
                    Select Files
                  </Button>
                </div>
              </div>
            </div>

            {/* Format info */}
            <div className="mt-6 rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
              <h4 className="font-medium text-gray-900 dark:text-white">
                รูปแบบ Dataset ที่รองรับ:
              </h4>
              <ul className="mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-400">
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
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Dataset List */}
        <Card>
          <CardHeader>
            <CardTitle>Your Datasets</CardTitle>
            <CardDescription>
              {datasets.length} datasets available
            </CardDescription>
          </CardHeader>
          <CardContent>
            {datasets.length === 0 ? (
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
                        <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                          <span>{dataset.images.toLocaleString()} images</span>
                          <span>•</span>
                          <span>{dataset.classes.length} classes</span>
                          <span>•</span>
                          <span>{dataset.size}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
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
