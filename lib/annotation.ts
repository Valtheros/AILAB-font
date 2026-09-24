export type AnnotationTaskType =
  | "image_classification"
  | "object_detection"
  | "semantic_segmentation"
  | "instance_segmentation";

export interface AnnotationClass {
  id: string;
  name: string;
  color: `#${string}`;
}

export type StoredAnnotation =
  | { id: string; type: "classification"; classId: string }
  | { id: string; type: "rectangle"; classId: string; x: number; y: number; width: number; height: number }
  | { id: string; type: "polygon"; classId: string; instanceId?: string; points: number[][] }
  | {
      id: string;
      type: "brush";
      classId: string;
      instanceId?: string;
      mode: "paint" | "erase";
      radius: number;
      points: number[][];
    };

export interface AnnotationProject {
  id: string;
  name: string;
  task_type: AnnotationTaskType;
  classes: AnnotationClass[];
  train_ratio: number;
  val_ratio: number;
  test_ratio: number;
  status: "draft" | "publishing" | "published";
  published_version: number;
  image_count: number;
  labeled_count: number;
  excluded_count: number;
  completed_count: number;
  created_at: string;
  updated_at: string;
}

export type AnnotationSplit = "train" | "val" | "test";
export type AnnotationImageStatus = "unlabeled" | "labeled" | "empty" | "excluded";

export interface AnnotationImageSummary {
  id: string;
  project_id: string;
  file_name: string;
  width: number;
  height: number;
  sort_order: number;
  split: AnnotationSplit;
  split_source: "auto" | "manual";
  marked_empty: boolean;
  is_labeled: boolean;
  is_excluded: boolean;
  revision: number;
  status: AnnotationImageStatus;
  thumbnail_width?: number;
  thumbnail_height?: number;
  updated_at?: string;
}

export interface AnnotationImage extends AnnotationImageSummary {
  annotations: StoredAnnotation[];
}

export interface AnnotationRevision {
  id: string;
  revision: number;
  marked_empty: boolean;
  is_excluded: boolean;
  created_at: string;
}

export interface AnnotationOperation {
  id: string;
  project_id: string;
  kind: "import" | "publish";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  processed_count: number;
  total_count: number;
  skipped_count: number;
  error_detail?: string;
  result: {
    imported?: number;
    skipped?: number;
    skippedFiles?: { file: string; reason: string }[];
    datasetId?: string;
    datasetName?: string;
    version?: number;
  };
  created_at: string;
  updated_at: string;
}

export const TASK_OPTIONS: { id: AnnotationTaskType; label: string; detail: string }[] = [
  { id: "image_classification", label: "Image Classification", detail: "Assign one class to each image." },
  { id: "object_detection", label: "Object Detection", detail: "Draw bounding boxes around objects." },
  { id: "semantic_segmentation", label: "Semantic Segmentation", detail: "Paint or draw class regions across the image." },
  { id: "instance_segmentation", label: "Instance Segmentation", detail: "Create separate polygon or brush masks for each object." },
];

export const CLASS_COLORS: AnnotationClass["color"][] = [
  "#22c55e", "#3b82f6", "#f97316", "#e11d48", "#a855f7",
  "#06b6d4", "#eab308", "#ec4899", "#14b8a6", "#6366f1",
];

export function taskLabel(task: AnnotationTaskType) {
  return TASK_OPTIONS.find((item) => item.id === task)?.label ?? task;
}

export function annotationId() {
  return globalThis.crypto?.randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function isTextEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement) return true;
  return target instanceof HTMLInputElement && target.type !== "range";
}

export async function apiError(response: Response) {
  try {
    const body = await response.json();
    return String(body.detail || `Request failed (${response.status})`);
  } catch {
    return `Request failed (${response.status})`;
  }
}
