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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Download,
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle2,
  BarChart3,
  Eye,
  Play,
} from "lucide-react";
import { useState } from "react";

// Mock trained models
const mockModels = [
  {
    id: "1",
    name: "traffic_signs_v1",
    dataset: "traffic_signs",
    epochs: 100,
    mAP50: 0.892,
    mAP5095: 0.673,
    precision: 0.912,
    recall: 0.867,
    size: "12.4 MB",
    createdAt: "2024-12-19 14:30",
    variant: "YOLOv11n",
  },
  {
    id: "2",
    name: "vehicles_detector_v2",
    dataset: "vehicles",
    epochs: 150,
    mAP50: 0.934,
    mAP5095: 0.721,
    precision: 0.945,
    recall: 0.889,
    size: "24.8 MB",
    createdAt: "2024-12-18 09:15",
    variant: "YOLOv11s",
  },
];

export default function ResultsPage() {
  const [selectedModel, setSelectedModel] = useState(mockModels[0]);
  const [testImage, setTestImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setTestImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const runInference = () => {
    setIsProcessing(true);
    // Simulate inference
    setTimeout(() => {
      setIsProcessing(false);
      console.log("Inference complete");
    }, 2000);
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Results
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            ดูผลลัพธ์และดาวน์โหลด Trained Models
          </p>
        </div>

        <Tabs defaultValue="models" className="space-y-6">
          <TabsList>
            <TabsTrigger value="models">Trained Models</TabsTrigger>
            <TabsTrigger value="inference">Test Inference</TabsTrigger>
          </TabsList>

          {/* Models Tab */}
          <TabsContent value="models">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Models List */}
              <div className="lg:col-span-1">
                <Card>
                  <CardHeader>
                    <CardTitle>Your Models</CardTitle>
                    <CardDescription>
                      {mockModels.length} models available
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {mockModels.map((model) => (
                        <button
                          key={model.id}
                          onClick={() => setSelectedModel(model)}
                          className={`w-full rounded-lg border p-4 text-left transition-all ${
                            selectedModel.id === model.id
                              ? "border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-800"
                              : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white">
                                {model.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {model.variant} • {model.size}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Model Details */}
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedModel.name}</CardTitle>
                        <CardDescription>
                          Trained on {selectedModel.dataset} •{" "}
                          {selectedModel.createdAt}
                        </CardDescription>
                      </div>
                      <Button>
                        <Download className="mr-2 h-4 w-4" />
                        Download Model
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                      <div className="rounded-lg border border-gray-200 p-4 text-center dark:border-gray-800">
                        <p className="text-sm text-gray-500">mAP@50</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {(selectedModel.mAP50 * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-4 text-center dark:border-gray-800">
                        <p className="text-sm text-gray-500">mAP@50-95</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {(selectedModel.mAP5095 * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-4 text-center dark:border-gray-800">
                        <p className="text-sm text-gray-500">Precision</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {(selectedModel.precision * 100).toFixed(1)}%
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-200 p-4 text-center dark:border-gray-800">
                        <p className="text-sm text-gray-500">Recall</p>
                        <p className="text-2xl font-bold text-gray-900 dark:text-white">
                          {(selectedModel.recall * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Model Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Model Information
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-sm text-gray-500">Model Variant</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedModel.variant}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-500">Dataset</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedModel.dataset}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-500">Epochs Trained</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedModel.epochs}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm text-gray-500">File Size</p>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {selectedModel.size}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Download Options */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Download className="h-5 w-5" />
                      Download Options
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <Button
                        variant="outline"
                        className="h-auto flex-col gap-2 py-4"
                      >
                        <FileText className="h-6 w-6" />
                        <span>best.pt</span>
                        <span className="text-xs text-gray-500">
                          Best weights
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto flex-col gap-2 py-4"
                      >
                        <FileText className="h-6 w-6" />
                        <span>last.pt</span>
                        <span className="text-xs text-gray-500">
                          Last epoch weights
                        </span>
                      </Button>
                      <Button
                        variant="outline"
                        className="h-auto flex-col gap-2 py-4"
                      >
                        <BarChart3 className="h-6 w-6" />
                        <span>results.csv</span>
                        <span className="text-xs text-gray-500">
                          Training metrics
                        </span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* Inference Tab */}
          <TabsContent value="inference">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Upload Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Test Image
                  </CardTitle>
                  <CardDescription>
                    อัพโหลดรูปภาพเพื่อทดสอบ Model
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <label className="block">
                      <div className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 p-8 transition-colors hover:border-gray-400 dark:border-gray-700 dark:hover:border-gray-600">
                        {testImage ? (
                          <img
                            src={testImage}
                            alt="Test"
                            className="max-h-64 rounded-lg object-contain"
                          />
                        ) : (
                          <>
                            <ImageIcon className="mb-4 h-12 w-12 text-gray-400" />
                            <p className="text-gray-600 dark:text-gray-400">
                              คลิกเพื่อเลือกรูปภาพ
                            </p>
                            <p className="text-sm text-gray-400">
                              JPG, PNG up to 10MB
                            </p>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                      </div>
                    </label>

                    <Button
                      className="w-full"
                      disabled={!testImage || isProcessing}
                      onClick={runInference}
                    >
                      {isProcessing ? (
                        <>
                          <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Play className="mr-2 h-4 w-4" />
                          Run Detection
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Results Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    Detection Results
                  </CardTitle>
                  <CardDescription>ผลการตรวจจับ Objects</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 p-12 text-center dark:border-gray-800">
                    <ImageIcon className="mb-4 h-12 w-12 text-gray-300 dark:text-gray-700" />
                    <p className="text-gray-500">
                      อัพโหลดรูปภาพและกด Run Detection
                    </p>
                    <p className="text-sm text-gray-400">ผลลัพธ์จะแสดงที่นี่</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
