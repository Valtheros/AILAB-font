import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface TrainingConfig {
  // Model Settings
  model: string;
  pretrained: boolean;

  // Training Settings
  epochs: number;
  patience: number;
  batch: number;
  imgsz: number;
  device: string;
  workers: number;
  cache: boolean;
  amp: boolean;
  fraction: number;

  // Optimizer Settings
  optimizer: string;
  lr0: number;
  lrf: number;
  momentum: number;
  weight_decay: number;
  cos_lr: boolean;

  // Warmup Settings
  warmup_epochs: number;
  warmup_momentum: number;
  warmup_bias_lr: number;

  // Loss Weights
  box: number;
  cls: number;
  dfl: number;

  // Augmentation Settings
  hsv_h: number;
  hsv_s: number;
  hsv_v: number;
  degrees: number;
  translate: number;
  scale: number;
  shear: number;
  perspective: number;
  flipud: number;
  fliplr: number;
  mosaic: number;
  mixup: number;
  copy_paste: number;

  // Advanced Settings
  save_period: number;
  close_mosaic: number;
  nbs: number;
  dropout: number;
  seed: number;
  deterministic: boolean;
  single_cls: boolean;
  rect: boolean;
  multi_scale: boolean;
}

export const defaultConfig: TrainingConfig = {
  model: "yolo11n.pt",
  pretrained: true,
  epochs: 100,
  patience: 100,
  batch: 16,
  imgsz: 640,
  device: "0",
  workers: 8,
  cache: false,
  amp: true,
  fraction: 1.0,
  optimizer: "auto",
  lr0: 0.01,
  lrf: 0.01,
  momentum: 0.937,
  weight_decay: 0.0005,
  cos_lr: false,
  warmup_epochs: 3.0,
  warmup_momentum: 0.8,
  warmup_bias_lr: 0.1,
  box: 7.5,
  cls: 0.5,
  dfl: 1.5,
  hsv_h: 0.015,
  hsv_s: 0.7,
  hsv_v: 0.4,
  degrees: 0.0,
  translate: 0.1,
  scale: 0.5,
  shear: 0.0,
  perspective: 0.0,
  flipud: 0.0,
  fliplr: 0.5,
  mosaic: 1.0,
  mixup: 0.0,
  copy_paste: 0.0,
  save_period: -1,
  close_mosaic: 10,
  nbs: 64,
  dropout: 0.0,
  seed: 0,
  deterministic: true,
  single_cls: false,
  rect: false,
  multi_scale: false,
};

interface TrainingConfigStore {
  config: TrainingConfig;
  updateConfig: (
    key: keyof TrainingConfig,
    value: number | string | boolean,
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
      resetConfig: () => set({ config: defaultConfig }),
      setConfig: (config) => set({ config }),
    }),
    {
      name: "training-config", // localStorage key
    },
  ),
);
