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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Cpu,
  Zap,
  Sparkles,
  RotateCcw,
  Save,
  Play,
  Info,
  CheckCircle,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useTrainingConfig,
  defaultConfig,
  type TrainingConfig,
} from "@/lib/useTrainingConfig";

export default function ConfigPage() {
  const { config, updateConfig, resetConfig } = useTrainingConfig();
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const router = useRouter();

  const handleReset = () => {
    resetConfig();
    setSaveStatus("idle");
  };

  const saveConfig = () => {
    setSaveStatus("saving");
    // Zustand persist middleware auto-saves, but we show feedback
    setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    }, 300);
  };

  const handleStartTraining = () => {
    // Config is already in Zustand store (auto-persisted), just navigate
    router.push("/training");
  };

  return (
    <MainLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              Model Configuration
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 sm:text-base">
              ตั้งค่า Training Parameters สำหรับ YOLOv11
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="flex-1 sm:flex-none"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={saveConfig}
              className="flex-1 sm:flex-none"
              disabled={saveStatus === "saving"}
            >
              {saveStatus === "saving" ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Saving...
                </>
              ) : saveStatus === "saved" ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
            <Button
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={handleStartTraining}
            >
              <Play className="mr-2 h-4 w-4" />
              Start Training
            </Button>
          </div>
        </div>

        {/* Reference Link */}
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
          <Info className="h-4 w-4 shrink-0 text-gray-500" />
          <span className="text-xs text-gray-600 dark:text-gray-400 sm:text-sm">
            Reference:{" "}
            <a
              href="https://docs.ultralytics.com/modes/train/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-900 underline dark:text-white"
            >
              Ultralytics YOLO Train Documentation
            </a>
          </span>
        </div>

        {/* Config Tabs */}
        <Tabs defaultValue="model" className="space-y-6">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-auto min-w-full sm:grid sm:w-full sm:grid-cols-7">
              <TabsTrigger value="model" className="whitespace-nowrap">
                Model
              </TabsTrigger>
              <TabsTrigger value="training" className="whitespace-nowrap">
                Training
              </TabsTrigger>
              <TabsTrigger value="optimizer" className="whitespace-nowrap">
                Optimizer
              </TabsTrigger>
              <TabsTrigger value="warmup" className="whitespace-nowrap">
                Warmup
              </TabsTrigger>
              <TabsTrigger value="loss" className="whitespace-nowrap">
                Loss
              </TabsTrigger>
              <TabsTrigger value="augmentation" className="whitespace-nowrap">
                Augment
              </TabsTrigger>
              <TabsTrigger value="advanced" className="whitespace-nowrap">
                Advanced
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Model Settings */}
          <TabsContent value="model">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Model Settings
                </CardTitle>
                <CardDescription>
                  เลือก Model variant และ Pretrained weights
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="model">Model Variant</Label>
                    <Select
                      value={config.model}
                      onValueChange={(v) => updateConfig("model", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yolo11n.pt">
                          YOLOv11n (Nano) - 2.6M params
                        </SelectItem>
                        <SelectItem value="yolo11s.pt">
                          YOLOv11s (Small) - 9.4M params
                        </SelectItem>
                        <SelectItem value="yolo11m.pt">
                          YOLOv11m (Medium) - 20.1M params
                        </SelectItem>
                        <SelectItem value="yolo11l.pt">
                          YOLOv11l (Large) - 25.3M params
                        </SelectItem>
                        <SelectItem value="yolo11x.pt">
                          YOLOv11x (XLarge) - 56.9M params
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      เลือก Model ขนาดเล็กสำหรับ Speed, ขนาดใหญ่สำหรับ Accuracy
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Pretrained Weights</Label>
                    <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Use Pretrained
                        </p>
                        <p className="text-sm text-gray-500">
                          ใช้ weights ที่ train ไว้จาก COCO dataset
                        </p>
                      </div>
                      <Switch
                        checked={config.pretrained}
                        onCheckedChange={(v) => updateConfig("pretrained", v)}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Training Settings */}
          <TabsContent value="training">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Training Settings
                </CardTitle>
                <CardDescription>ตั้งค่าพื้นฐานสำหรับ Training</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="epochs">Epochs</Label>
                    <Input
                      id="epochs"
                      type="number"
                      value={config.epochs}
                      onChange={(e) =>
                        updateConfig("epochs", parseInt(e.target.value))
                      }
                      min={1}
                      max={1000}
                    />
                    <p className="text-xs text-gray-500">
                      จำนวนรอบการ Train (default: 100)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="patience">Early Stopping Patience</Label>
                    <Input
                      id="patience"
                      type="number"
                      value={config.patience}
                      onChange={(e) =>
                        updateConfig("patience", parseInt(e.target.value))
                      }
                      min={0}
                      max={500}
                    />
                    <p className="text-xs text-gray-500">
                      หยุด Train ถ้าไม่ดีขึ้นใน N epochs
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="batch">Batch Size</Label>
                    <Input
                      id="batch"
                      type="number"
                      value={config.batch}
                      onChange={(e) =>
                        updateConfig("batch", parseInt(e.target.value))
                      }
                      min={-1}
                      max={128}
                    />
                    <p className="text-xs text-gray-500">
                      -1 = auto, ขึ้นกับ GPU memory
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="imgsz">Image Size</Label>
                    <Select
                      value={config.imgsz.toString()}
                      onValueChange={(v) => updateConfig("imgsz", parseInt(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="320">320 px</SelectItem>
                        <SelectItem value="416">416 px</SelectItem>
                        <SelectItem value="512">512 px</SelectItem>
                        <SelectItem value="640">640 px (default)</SelectItem>
                        <SelectItem value="800">800 px</SelectItem>
                        <SelectItem value="1024">1024 px</SelectItem>
                        <SelectItem value="1280">1280 px</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      ขนาดภาพสำหรับ Training
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="device">Device</Label>
                    <Select
                      value={config.device}
                      onValueChange={(v) => updateConfig("device", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">GPU 0</SelectItem>
                        <SelectItem value="0,1">GPU 0,1 (Multi-GPU)</SelectItem>
                        <SelectItem value="cpu">CPU</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      อุปกรณ์สำหรับ Training
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="workers">Workers</Label>
                    <Input
                      id="workers"
                      type="number"
                      value={config.workers}
                      onChange={(e) =>
                        updateConfig("workers", parseInt(e.target.value))
                      }
                      min={0}
                      max={16}
                    />
                    <p className="text-xs text-gray-500">
                      จำนวน DataLoader workers
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Cache
                      </p>
                      <p className="text-xs text-gray-500">
                        Cache images in RAM
                      </p>
                    </div>
                    <Switch
                      checked={config.cache}
                      onCheckedChange={(v) => updateConfig("cache", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        AMP
                      </p>
                      <p className="text-xs text-gray-500">
                        Mixed Precision Training
                      </p>
                    </div>
                    <Switch
                      checked={config.amp}
                      onCheckedChange={(v) => updateConfig("amp", v)}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Dataset Fraction</Label>
                      <span className="text-sm text-gray-500">
                        {config.fraction}
                      </span>
                    </div>
                    <Slider
                      value={[config.fraction]}
                      onValueChange={([v]) => updateConfig("fraction", v)}
                      min={0.1}
                      max={1}
                      step={0.1}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Optimizer Settings */}
          <TabsContent value="optimizer">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Optimizer Settings
                </CardTitle>
                <CardDescription>
                  ตั้งค่า Optimizer และ Learning Rate
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Optimizer</Label>
                    <Select
                      value={config.optimizer}
                      onValueChange={(v) => updateConfig("optimizer", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto</SelectItem>
                        <SelectItem value="SGD">SGD</SelectItem>
                        <SelectItem value="Adam">Adam</SelectItem>
                        <SelectItem value="AdamW">AdamW</SelectItem>
                        <SelectItem value="NAdam">NAdam</SelectItem>
                        <SelectItem value="RAdam">RAdam</SelectItem>
                        <SelectItem value="RMSProp">RMSProp</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lr0">Initial Learning Rate (lr0)</Label>
                    <Input
                      id="lr0"
                      type="number"
                      value={config.lr0}
                      onChange={(e) =>
                        updateConfig("lr0", parseFloat(e.target.value))
                      }
                      min={0.0001}
                      max={0.1}
                      step={0.001}
                    />
                    <p className="text-xs text-gray-500">
                      SGD=0.01, Adam=0.001
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lrf">Final LR Factor (lrf)</Label>
                    <Input
                      id="lrf"
                      type="number"
                      value={config.lrf}
                      onChange={(e) =>
                        updateConfig("lrf", parseFloat(e.target.value))
                      }
                      min={0.001}
                      max={1}
                      step={0.01}
                    />
                    <p className="text-xs text-gray-500">
                      Final LR = lr0 × lrf
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Momentum</Label>
                      <span className="text-sm text-gray-500">
                        {config.momentum}
                      </span>
                    </div>
                    <Slider
                      value={[config.momentum]}
                      onValueChange={([v]) => updateConfig("momentum", v)}
                      min={0.5}
                      max={0.99}
                      step={0.001}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="weight_decay">Weight Decay</Label>
                    <Input
                      id="weight_decay"
                      type="number"
                      value={config.weight_decay}
                      onChange={(e) =>
                        updateConfig("weight_decay", parseFloat(e.target.value))
                      }
                      min={0}
                      max={0.01}
                      step={0.0001}
                    />
                    <p className="text-xs text-gray-500">L2 regularization</p>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Cosine LR
                      </p>
                      <p className="text-xs text-gray-500">
                        Cosine LR scheduler
                      </p>
                    </div>
                    <Switch
                      checked={config.cos_lr}
                      onCheckedChange={(v) => updateConfig("cos_lr", v)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Warmup Settings */}
          <TabsContent value="warmup">
            <Card>
              <CardHeader>
                <CardTitle>Warmup Settings</CardTitle>
                <CardDescription>
                  ตั้งค่า Warmup สำหรับช่วงเริ่มต้น Training
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="warmup_epochs">Warmup Epochs</Label>
                    <Input
                      id="warmup_epochs"
                      type="number"
                      value={config.warmup_epochs}
                      onChange={(e) =>
                        updateConfig(
                          "warmup_epochs",
                          parseFloat(e.target.value),
                        )
                      }
                      min={0}
                      max={10}
                      step={0.5}
                    />
                    <p className="text-xs text-gray-500">
                      จำนวน epochs สำหรับ warmup
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Warmup Momentum</Label>
                      <span className="text-sm text-gray-500">
                        {config.warmup_momentum}
                      </span>
                    </div>
                    <Slider
                      value={[config.warmup_momentum]}
                      onValueChange={([v]) =>
                        updateConfig("warmup_momentum", v)
                      }
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="warmup_bias_lr">Warmup Bias LR</Label>
                    <Input
                      id="warmup_bias_lr"
                      type="number"
                      value={config.warmup_bias_lr}
                      onChange={(e) =>
                        updateConfig(
                          "warmup_bias_lr",
                          parseFloat(e.target.value),
                        )
                      }
                      min={0}
                      max={1}
                      step={0.01}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Loss Weights */}
          <TabsContent value="loss">
            <Card>
              <CardHeader>
                <CardTitle>Loss Weights</CardTitle>
                <CardDescription>
                  ปรับ weight ของแต่ละ Loss component
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Box Loss</Label>
                      <span className="text-sm text-gray-500">
                        {config.box}
                      </span>
                    </div>
                    <Slider
                      value={[config.box]}
                      onValueChange={([v]) => updateConfig("box", v)}
                      min={0}
                      max={20}
                      step={0.5}
                    />
                    <p className="text-xs text-gray-500">
                      Bounding box loss weight
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Classification Loss</Label>
                      <span className="text-sm text-gray-500">
                        {config.cls}
                      </span>
                    </div>
                    <Slider
                      value={[config.cls]}
                      onValueChange={([v]) => updateConfig("cls", v)}
                      min={0}
                      max={5}
                      step={0.1}
                    />
                    <p className="text-xs text-gray-500">
                      Classification loss weight
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>DFL Loss</Label>
                      <span className="text-sm text-gray-500">
                        {config.dfl}
                      </span>
                    </div>
                    <Slider
                      value={[config.dfl]}
                      onValueChange={([v]) => updateConfig("dfl", v)}
                      min={0}
                      max={5}
                      step={0.1}
                    />
                    <p className="text-xs text-gray-500">
                      Distribution Focal Loss weight
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Augmentation Settings */}
          <TabsContent value="augmentation">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Data Augmentation
                </CardTitle>
                <CardDescription>
                  ตั้งค่า Augmentation เพื่อเพิ่มความหลากหลายของ Training Data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* HSV Augmentation */}
                <div>
                  <h4 className="mb-4 font-medium text-gray-900 dark:text-white">
                    Color Augmentation (HSV)
                  </h4>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Hue (hsv_h)</Label>
                        <span className="text-sm text-gray-500">
                          {config.hsv_h}
                        </span>
                      </div>
                      <Slider
                        value={[config.hsv_h]}
                        onValueChange={([v]) => updateConfig("hsv_h", v)}
                        min={0}
                        max={1}
                        step={0.005}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Saturation (hsv_s)</Label>
                        <span className="text-sm text-gray-500">
                          {config.hsv_s}
                        </span>
                      </div>
                      <Slider
                        value={[config.hsv_s]}
                        onValueChange={([v]) => updateConfig("hsv_s", v)}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Value/Brightness (hsv_v)</Label>
                        <span className="text-sm text-gray-500">
                          {config.hsv_v}
                        </span>
                      </div>
                      <Slider
                        value={[config.hsv_v]}
                        onValueChange={([v]) => updateConfig("hsv_v", v)}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </div>
                  </div>
                </div>

                {/* Geometric Augmentation */}
                <div>
                  <h4 className="mb-4 font-medium text-gray-900 dark:text-white">
                    Geometric Augmentation
                  </h4>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Rotation (degrees)</Label>
                        <span className="text-sm text-gray-500">
                          {config.degrees}°
                        </span>
                      </div>
                      <Slider
                        value={[config.degrees]}
                        onValueChange={([v]) => updateConfig("degrees", v)}
                        min={0}
                        max={180}
                        step={5}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Translate</Label>
                        <span className="text-sm text-gray-500">
                          {config.translate}
                        </span>
                      </div>
                      <Slider
                        value={[config.translate]}
                        onValueChange={([v]) => updateConfig("translate", v)}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Scale</Label>
                        <span className="text-sm text-gray-500">
                          {config.scale}
                        </span>
                      </div>
                      <Slider
                        value={[config.scale]}
                        onValueChange={([v]) => updateConfig("scale", v)}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Shear</Label>
                        <span className="text-sm text-gray-500">
                          {config.shear}°
                        </span>
                      </div>
                      <Slider
                        value={[config.shear]}
                        onValueChange={([v]) => updateConfig("shear", v)}
                        min={0}
                        max={180}
                        step={5}
                      />
                    </div>
                  </div>
                </div>

                {/* Flip Augmentation */}
                <div>
                  <h4 className="mb-4 font-medium text-gray-900 dark:text-white">
                    Flip Augmentation
                  </h4>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Flip Up-Down (flipud)</Label>
                        <span className="text-sm text-gray-500">
                          {config.flipud}
                        </span>
                      </div>
                      <Slider
                        value={[config.flipud]}
                        onValueChange={([v]) => updateConfig("flipud", v)}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Flip Left-Right (fliplr)</Label>
                        <span className="text-sm text-gray-500">
                          {config.fliplr}
                        </span>
                      </div>
                      <Slider
                        value={[config.fliplr]}
                        onValueChange={([v]) => updateConfig("fliplr", v)}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                    </div>
                  </div>
                </div>

                {/* Advanced Augmentation */}
                <div>
                  <h4 className="mb-4 font-medium text-gray-900 dark:text-white">
                    Advanced Augmentation
                  </h4>
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Mosaic</Label>
                        <span className="text-sm text-gray-500">
                          {config.mosaic}
                        </span>
                      </div>
                      <Slider
                        value={[config.mosaic]}
                        onValueChange={([v]) => updateConfig("mosaic", v)}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                      <p className="text-xs text-gray-500">รวม 4 ภาพเป็น 1</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Mixup</Label>
                        <span className="text-sm text-gray-500">
                          {config.mixup}
                        </span>
                      </div>
                      <Slider
                        value={[config.mixup]}
                        onValueChange={([v]) => updateConfig("mixup", v)}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                      <p className="text-xs text-gray-500">
                        ผสม 2 ภาพเข้าด้วยกัน
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Copy-Paste</Label>
                        <span className="text-sm text-gray-500">
                          {config.copy_paste}
                        </span>
                      </div>
                      <Slider
                        value={[config.copy_paste]}
                        onValueChange={([v]) => updateConfig("copy_paste", v)}
                        min={0}
                        max={1}
                        step={0.1}
                      />
                      <p className="text-xs text-gray-500">
                        Copy objects ไปวางในภาพอื่น
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Advanced Settings */}
          <TabsContent value="advanced">
            <Card>
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>
                  ตั้งค่าขั้นสูงสำหรับผู้เชี่ยวชาญ
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="save_period">Save Period</Label>
                    <Input
                      id="save_period"
                      type="number"
                      value={config.save_period}
                      onChange={(e) =>
                        updateConfig("save_period", parseInt(e.target.value))
                      }
                      min={-1}
                      max={100}
                    />
                    <p className="text-xs text-gray-500">
                      Save ทุก N epochs (-1 = disabled)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="close_mosaic">Close Mosaic</Label>
                    <Input
                      id="close_mosaic"
                      type="number"
                      value={config.close_mosaic}
                      onChange={(e) =>
                        updateConfig("close_mosaic", parseInt(e.target.value))
                      }
                      min={0}
                      max={50}
                    />
                    <p className="text-xs text-gray-500">
                      ปิด Mosaic ใน N epochs สุดท้าย
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nbs">Nominal Batch Size</Label>
                    <Input
                      id="nbs"
                      type="number"
                      value={config.nbs}
                      onChange={(e) =>
                        updateConfig("nbs", parseInt(e.target.value))
                      }
                      min={1}
                      max={256}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Dropout</Label>
                      <span className="text-sm text-gray-500">
                        {config.dropout}
                      </span>
                    </div>
                    <Slider
                      value={[config.dropout]}
                      onValueChange={([v]) => updateConfig("dropout", v)}
                      min={0}
                      max={0.5}
                      step={0.05}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seed">Random Seed</Label>
                    <Input
                      id="seed"
                      type="number"
                      value={config.seed}
                      onChange={(e) =>
                        updateConfig("seed", parseInt(e.target.value))
                      }
                      min={0}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Deterministic
                      </p>
                    </div>
                    <Switch
                      checked={config.deterministic}
                      onCheckedChange={(v) => updateConfig("deterministic", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Single Class
                      </p>
                    </div>
                    <Switch
                      checked={config.single_cls}
                      onCheckedChange={(v) => updateConfig("single_cls", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Rect Training
                      </p>
                    </div>
                    <Switch
                      checked={config.rect}
                      onCheckedChange={(v) => updateConfig("rect", v)}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        Multi-Scale
                      </p>
                    </div>
                    <Switch
                      checked={config.multi_scale}
                      onCheckedChange={(v) => updateConfig("multi_scale", v)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
