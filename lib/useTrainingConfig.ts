import { create } from "zustand";
import { persist } from "zustand/middleware";
import { defaultParamsFor, fallbackCatalog, getModel } from "@/lib/cvCatalog";

export type ConfigValue = number | string | boolean;

export interface TrainingConfig {
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
}

const defaultModel = getModel(fallbackCatalog, "object_detection", "yolo");

export const defaultConfig: TrainingConfig = {
  taskType: "object_detection",
  modelType: "yolo",
  modelName: defaultModel.model_name,
  datasetName: "",
  projectName: "cv_run",
  epochs: 50,
  batchSize: 16,
  device: "cpu",
  workers: 4,
  amp: true,
  seed: 0,
  params: defaultParamsFor(defaultModel, fallbackCatalog.common_params),
};

function normalizeConfig(config?: Partial<TrainingConfig>): TrainingConfig {
  const batchSize = Number(config?.batchSize ?? config?.params?.batch_size);
  const normalizedBatchSize =
    Number.isFinite(batchSize) && batchSize >= 1
      ? batchSize
      : defaultConfig.batchSize;
  const params: Record<string, ConfigValue> = {
    ...defaultConfig.params,
    ...(config?.params ?? {}),
    batch_size: normalizedBatchSize,
  };
  if (params.ocr_task === "e2e") params.ocr_task = "rec";

  return {
    ...defaultConfig,
    ...(config ?? {}),
    batchSize: normalizedBatchSize,
    params,
  };
}

type DeviceSelectionMode = "auto" | "manual";

interface UpdateConfigOptions {
  deviceSelection?: DeviceSelectionMode;
}

interface TrainingConfigStore {
  config: TrainingConfig;
  deviceSelection: DeviceSelectionMode;
  updateConfig: (
    key: keyof Omit<TrainingConfig, "params">,
    value: ConfigValue,
    options?: UpdateConfigOptions,
  ) => void;
  updateParam: (key: string, value: ConfigValue) => void;
  setTaskModel: (
    taskType: string,
    modelType: string,
    modelName: string,
    defaults: Record<string, ConfigValue>,
  ) => void;
  resetConfig: () => void;
  setConfig: (config: TrainingConfig) => void;
}

export const useTrainingConfig = create<TrainingConfigStore>()(
  persist(
    (set) => ({
      config: defaultConfig,
      deviceSelection: "auto",
      updateConfig: (key, value, options) =>
        set((state) => {
          const paramKeyByConfigKey: Partial<Record<keyof Omit<TrainingConfig, "params">, string>> = {
            epochs: "epochs",
            batchSize: "batch_size",
            device: "device",
            workers: "workers",
            amp: "amp",
            seed: "seed",
          };
          const paramKey = paramKeyByConfigKey[key];
          return {
            config: {
              ...state.config,
              [key]: value,
              params: paramKey
                ? { ...state.config.params, [paramKey]: value }
                : state.config.params,
            },
            deviceSelection:
              key === "device"
                ? options?.deviceSelection ?? "manual"
                : state.deviceSelection,
          };
        }),
      updateParam: (key, value) =>
        set((state) => ({
          config: {
            ...state.config,
            params: { ...state.config.params, [key]: value },
          },
        })),
      setTaskModel: (taskType, modelType, modelName, defaults) =>
        set((state) => ({
          config: {
            ...state.config,
            taskType,
            modelType,
            modelName,
            datasetName: "",
            params: {
              ...defaults,
              device: state.config.device,
            },
          },
        })),
      resetConfig: () => set({ config: defaultConfig, deviceSelection: "auto" }),
      setConfig: (config) => set({ config: normalizeConfig(config) }),
    }),
    {
      name: "training-config",
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<TrainingConfigStore> | undefined;
        return {
          ...current,
          config: normalizeConfig(persistedState?.config),
          deviceSelection: persistedState?.deviceSelection ?? "auto",
        };
      },
    },
  ),
);
