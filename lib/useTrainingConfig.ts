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
  device: "0",
  workers: 4,
  amp: true,
  seed: 0,
  params: defaultParamsFor(defaultModel, fallbackCatalog.common_params),
};

function normalizeConfig(config?: Partial<TrainingConfig>): TrainingConfig {
  return {
    ...defaultConfig,
    ...(config ?? {}),
    params: {
      ...defaultConfig.params,
      ...(config?.params ?? {}),
    },
  };
}

interface TrainingConfigStore {
  config: TrainingConfig;
  updateConfig: (key: keyof Omit<TrainingConfig, "params">, value: ConfigValue) => void;
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
      updateConfig: (key, value) =>
        set((state) => ({
          config: { ...state.config, [key]: value },
        })),
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
            params: defaults,
          },
        })),
      resetConfig: () => set({ config: defaultConfig }),
      setConfig: (config) => set({ config: normalizeConfig(config) }),
    }),
    {
      name: "training-config",
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<TrainingConfigStore> | undefined;
        return {
          ...current,
          config: normalizeConfig(persistedState?.config),
        };
      },
    },
  ),
);
