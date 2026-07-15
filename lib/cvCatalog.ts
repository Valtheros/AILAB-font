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
