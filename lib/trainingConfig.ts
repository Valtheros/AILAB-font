export type ConfigValue = number | string | boolean;
import type { ComputeJob, ExecutionSelection } from './compute';

export interface TrainingConfig {
  execution: ExecutionSelection;
  taskType: string;
  modelType: string;
  modelName: string;
  datasetName: string;
  projectName: string;
  epochs: number;
  batchSize: number;
  device: string;
  workers: number;
  amp: boolean;
  seed: number;
  params: Record<string, ConfigValue>;
  deviceSelection: "auto" | "manual";
}

export interface TrainingTask extends TrainingConfig {
  computeJob?: ComputeJob | null;
  id: string;
  displayName: string;
  status: string;
  runSlug?: string | null;
  jobId?: string | null;
  errorDetail?: string | null;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
  files?: Array<{ path: string; name: string; size: number }>;
  latestMetrics?: Record<string, string> | null;
}

export const defaultConfig: TrainingConfig = {
  execution: { mode: "auto", gpuUuid: null },
  taskType: "object_detection",
  modelType: "yolo",
  modelName: "yolo11n",
  datasetName: "",
  projectName: "cv_run",
  epochs: 50,
  batchSize: 16,
  device: "cpu",
  workers: 4,
  amp: true,
  seed: 0,
  params: {
    epochs: 50,
    batch_size: 16,
    device: "cpu",
    workers: 4,
    amp: true,
    seed: 0,
  },
  deviceSelection: "auto",
};

export function taskConfig(task: TrainingTask): TrainingConfig {
  return {
    execution: task.execution ?? { mode: "auto", gpuUuid: null },
    taskType: task.taskType,
    modelType: task.modelType,
    modelName: task.modelName,
    datasetName: task.datasetName,
    projectName: task.displayName,
    epochs: task.epochs,
    batchSize: task.batchSize,
    device: task.device,
    workers: task.workers,
    amp: task.amp,
    seed: task.seed,
    params: task.params,
    deviceSelection: task.deviceSelection,
  };
}

export function taskDraftPayload(config: TrainingConfig) {
  const modelName = config.modelType === "yolo"
    ? `yolo11${String(config.params.model_size ?? "n").replace(/^yolo11/, "").replace(/\.pt$/, "")}`
    : config.modelType === "resnet" || config.modelType === "efficientnet"
      ? String(config.params.architecture ?? config.modelName)
    : config.modelName;
  return {
    execution: config.execution,
    display_name: config.projectName.trim() || "cv_run",
    task_type: config.taskType,
    model_type: config.modelType,
    model_name: modelName,
    dataset_name: config.datasetName,
    epochs: config.epochs,
    batch_size: config.batchSize,
    params: {
      ...config.params,
      epochs: config.epochs,
      batch_size: config.batchSize,
      device: config.device,
      workers: config.workers,
      amp: config.amp,
      seed: config.seed,
    },
    device_selection: config.deviceSelection,
  };
}
