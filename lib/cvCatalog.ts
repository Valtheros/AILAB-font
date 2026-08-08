export type ParamType = "number" | "boolean" | "select" | "text";

export interface ParamOption {
  value: string;
  label: string;
}

export interface ParamSpec {
  key: string;
  label: string;
  type: ParamType;
  default: number | boolean | string;
  description?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: ParamOption[];
}

export interface ResourceProfileMetadata {
  target_gpu_vram_mb?: number;
  safe_gpu_vram_mb?: number;
  target_system_ram_gb?: number;
  safe_system_ram_gb?: number;
  policy?: string;
}

export interface ModelSpec {
  id: string;
  label: string;
  model_name: string;
  runtime: string;
  reason: string;
  dataset_formats: string[];
  params: ParamSpec[];
  dataset_task?: string;
  required_annotations?: string[];
  accepted_source_formats?: string[];
  accepted_canonical_formats?: string[];
  canonical_format?: string;
  conversion_targets?: string[];
  train_export_format?: string;
  resource_profile?: ResourceProfileMetadata;
  safe_defaults?: Record<string, number | string | boolean>;
  hard_limits?: Record<string, number | string | boolean>;
  memory_notes?: string[];
}

export interface TaskSpec {
  id: string;
  label: string;
  description: string;
  dataset_formats: string[];
  models: ModelSpec[];
}

export interface CVCatalog {
  version: string;
  common_params: ParamSpec[];
  tasks: TaskSpec[];
}

// Keeps hooks stable while the backend-owned catalog loads. This is never
// presented as a usable catalog and cannot start a training run.
export const catalogPlaceholder: CVCatalog = {
  version: "loading",
  common_params: [],
  tasks: [
    {
      id: "object_detection",
      label: "Object Detection",
      description: "",
      dataset_formats: [],
      models: [
        {
          id: "yolo",
          label: "YOLOv11",
          model_name: "yolo11n",
          runtime: "",
          reason: "",
          dataset_formats: [],
          params: [],
        },
      ],
    },
  ],
};

export function getTask(catalog: CVCatalog, taskId: string) {
  return catalog.tasks.find((task) => task.id === taskId) ?? catalog.tasks[0];
}

export function getModel(catalog: CVCatalog, taskId: string, modelId: string) {
  const task = getTask(catalog, taskId);
  return task.models.find((model) => model.id === modelId) ?? task.models[0];
}

export function defaultParamsFor(model: ModelSpec, commonParams: ParamSpec[]) {
  return [...commonParams, ...model.params].reduce<Record<string, number | boolean | string>>(
    (acc, spec) => {
      acc[spec.key] = spec.default;
      return acc;
    },
    {},
  );
}

/**
 * Per-model starting defaults. The shared common_params default batch_size to
 * 16, which is fine for classification but far over budget for the memory-heavy
 * detectors/segmenters (Faster/Mask R-CNN, DeepLabV3+ recommend batch 2). This
 * overlays each model's own safe_defaults so a freshly selected model starts
 * inside its memory budget instead of tripping the VRAM guard immediately.
 *
 * Returns the params map plus the top-level scalars the form tracks separately
 * (batchSize/workers/amp), all sourced from safe_defaults where available.
 */
export function modelDefaults(model: ModelSpec, commonParams: ParamSpec[]) {
  const params = defaultParamsFor(model, commonParams);
  const safe = model.safe_defaults ?? {};
  for (const [key, value] of Object.entries(safe)) {
    // Only overlay keys that are real params for this model, so no unknown key
    // reaches the backend's param validation.
    if (key in params) params[key] = value as number | boolean | string;
  }
  return {
    params,
    batchSize: Number(safe.batch_size ?? params.batch_size ?? 16),
    workers: Number(safe.workers ?? params.workers ?? 4),
    amp: Boolean(safe.amp ?? params.amp ?? true),
  };
}
