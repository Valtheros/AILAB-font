import { type ModelSpec } from "@/lib/cvCatalog";
import { type ConfigValue } from "@/lib/useTrainingConfig";

export interface MemorySafetyInput {
  batchSize: number;
  workers: number;
  device: string;
  amp: boolean;
  params: Record<string, ConfigValue>;
}

export interface MemorySafetyResult {
  ok: boolean;
  status: "safe" | "warning";
  label: string;
  issues: string[];
  suggestions: string[];
  summary: string[];
}

function numeric(value: ConfigValue | undefined, fallback: number) {
  if (typeof value === "boolean") return fallback;
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isCpu(device: string) {
  return String(device).toLowerCase() === "cpu";
}

function classificationBatchCap(imageSize: number, cpu: boolean) {
  if (cpu) return imageSize <= 224 ? 8 : 2;
  if (imageSize <= 224) return 64;
  if (imageSize <= 512) return 16;
  return 4;
}

function yoloBatchCap(modelSize: string, imgsz: number, cpu: boolean) {
  if (cpu) return imgsz <= 640 && ["n", "s"].includes(modelSize) ? 4 : 1;
  const base: Record<string, number> = { n: 16, s: 16, m: 8, l: 4, x: 4 };
  if (imgsz <= 640) return base[modelSize] ?? 8;
  const large: Record<string, number> = { n: 4, s: 4, m: 2, l: 1, x: 1 };
  return Math.max(1, Math.min(base[modelSize] ?? 8, large[modelSize] ?? 2));
}

function detectorBatchCap(imageSize: number, cpu: boolean) {
  if (cpu) return 1;
  return imageSize <= 640 ? 4 : 2;
}

function deeplabBatchCap(imageSize: number, cpu: boolean) {
  if (cpu) return 1;
  if (imageSize <= 512) return 4;
  if (imageSize <= 768) return 2;
  return 1;
}

export function memorySafetyForModel(model: ModelSpec, input: MemorySafetyInput): MemorySafetyResult {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const summary: string[] = [];
  const cpu = isCpu(input.device);
  const workerCap = cpu || model.id === "tesseract" ? 2 : 4;

  if (input.workers > workerCap) {
    issues.push("Workers " + input.workers + " is high for the current RAM profile.");
    suggestions.push("Use workers <= " + workerCap + ".");
  }

  if (["resnet", "efficientnet"].includes(model.id)) {
    const imageSize = numeric(input.params.image_size, 224);
    const cap = classificationBatchCap(imageSize, cpu);
    summary.push("image_size " + imageSize, "safe batch <= " + cap);
    if (imageSize > 1024) issues.push(model.label + " image_size " + imageSize + " exceeds the 1024 safe cap.");
    if (input.batchSize > cap) {
      issues.push(model.label + " batch " + input.batchSize + " is too high for image_size " + imageSize + ".");
      suggestions.push("Use batch_size <= " + cap + ".");
    }
  }

  if (model.id === "yolo") {
    const imgsz = numeric(input.params.imgsz, 640);
    const modelSize = String(input.params.model_size ?? "n").replace("yolo11", "").replace(".pt", "") || "n";
    const cap = yoloBatchCap(modelSize, imgsz, cpu);
    summary.push("imgsz " + imgsz, "YOLOv11" + modelSize, "safe batch <= " + cap);
    if (imgsz > 1024) issues.push("YOLOv11 imgsz " + imgsz + " exceeds the 1024 safe cap.");
    if (input.batchSize > cap) {
      issues.push("YOLOv11" + modelSize + " batch " + input.batchSize + " is too high for imgsz " + imgsz + ".");
      suggestions.push("Use batch_size <= " + cap + ".");
    }
    if (input.params.cache === true) {
      issues.push("YOLO cache=true can cause memory errors on large datasets.");
      suggestions.push("Keep cache disabled unless the dataset is tiny.");
    }
  }

  if (["faster_rcnn", "mask_rcnn"].includes(model.id)) {
    const imageSize = numeric(input.params.image_size, 640);
    const maxSize = numeric(input.params.max_size, 1333);
    const cap = detectorBatchCap(imageSize, cpu);
    summary.push("short side " + imageSize, "long side <= " + maxSize, "safe batch <= " + cap);
    if (imageSize > 1024) issues.push(model.label + " image_size " + imageSize + " exceeds the 1024 safe cap.");
    if (maxSize > 1600) issues.push(model.label + " max_size " + maxSize + " exceeds the 1600 safe cap.");
    if (input.batchSize > cap) {
      issues.push(model.label + " batch " + input.batchSize + " is too high for image_size " + imageSize + ".");
      suggestions.push("Use batch_size <= " + cap + "; batch 1-2 is recommended.");
    }
  }

  if (model.id === "deeplabv3plus") {
    const imageSize = numeric(input.params.image_size, 512);
    const cap = deeplabBatchCap(imageSize, cpu);
    summary.push("image_size " + imageSize, "safe batch <= " + cap);
    if (imageSize > 1024) issues.push("DeepLabV3+ image_size " + imageSize + " exceeds the 1024 safe cap.");
    if (input.batchSize > cap) {
      issues.push("DeepLabV3+ batch " + input.batchSize + " is too high for image_size " + imageSize + ".");
      suggestions.push("Use image_size 512 batch 2, or image_size 1024 batch 1.");
    }
  }

  if (model.id === "paddleocr") {
    const task = String(input.params.ocr_task ?? "rec");
    const batch = numeric(input.params.batch_size_per_card, 32);
    const cap = cpu ? 8 : task === "det" ? 8 : 64;
    summary.push("OCR " + task, "batch per card " + batch, "safe <= " + cap);
    if (batch > cap) {
      issues.push("PaddleOCR " + task + " batch_size_per_card " + batch + " exceeds the safe limit.");
      suggestions.push("Use batch_size_per_card <= " + cap + ".");
    }
  }

  if (model.id === "tesseract") {
    summary.push("CPU/RAM guarded", "workers <= " + workerCap);
  }

  if (summary.length === 0) summary.push("Conservative defaults");

  return {
    ok: issues.length === 0,
    status: issues.length === 0 ? "safe" : "warning",
    label: issues.length === 0 ? "Auto-safe" : "Needs adjustment",
    issues,
    suggestions: [...new Set(suggestions)],
    summary,
  };
}

export function safeDefaultEntries(model: ModelSpec) {
  return Object.entries(model.safe_defaults ?? {});
}
