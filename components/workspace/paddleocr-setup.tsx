"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FolderOpen, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/workspace/status-badge";
import { type OcrBaseModelPreset } from "@/lib/cvCatalog";
import { type ConfigValue } from "@/lib/useTrainingConfig";
import { useLanguage } from "@/components/language-provider";

const fallbackPaddlePresets: OcrBaseModelPreset[] = [
  {
    id: "ppocrv4-rec",
    label: "PP-OCRv4 Recognition",
    task: "rec",
    config_path: "/opt/PaddleOCR/configs/rec/PP-OCRv4/ch_PP-OCRv4_rec.yml",
    pretrained_model: "",
    labels: ["rec_gt_train.txt", "rec_gt_val.txt"],
    description: "General text recognition using the selected PaddleOCR config default weights.",
    available: true,
  },
  {
    id: "ppocrv4-det",
    label: "PP-OCRv4 Detection",
    task: "det",
    config_path: "/opt/PaddleOCR/configs/det/ch_PP-OCRv4/ch_PP-OCRv4_det.yml",
    pretrained_model: "",
    labels: ["det_gt_train.txt", "det_gt_val.txt"],
    description: "General text detection using the selected PaddleOCR config default weights.",
    available: true,
  },
];

type CheckpointMode = "none" | "previous-run" | "custom";

function previousRunPath(runFolder: string) {
  const trimmed = runFolder.trim();
  return trimmed ? `/app/runs/${trimmed}/best_accuracy` : "";
}

function folderFromPreviousRunPath(path: string) {
  const match = path.match(/^\/app\/runs\/(.+)\/best_accuracy$/);
  return match?.[1] ?? "";
}

function recipeFromConfig(
  presets: OcrBaseModelPreset[],
  configPath: string,
  ocrTask: string,
) {
  const exactConfigMatch = presets.find(
    (preset) => preset.config_path === configPath,
  );
  if (exactConfigMatch) {
    return exactConfigMatch.id;
  }
  if (configPath.trim()) {
    return "custom";
  }
  const taskMatch = presets.find((preset) => preset.task === ocrTask);
  return taskMatch?.id ?? "custom";
}

function checkpointModeFromPath(path: string): CheckpointMode {
  if (!path) return "none";
  return folderFromPreviousRunPath(path) ? "previous-run" : "custom";
}

export function PaddleOcrSetup({
  params,
  presets,
  onParamChange,
}: {
  params: Record<string, ConfigValue>;
  presets?: OcrBaseModelPreset[];
  onParamChange: (key: string, value: ConfigValue) => void;
}) {
  const { t } = useLanguage();
  const paddlePresets = useMemo(
    () => (presets?.length ? presets : fallbackPaddlePresets),
    [presets],
  );
  const configPath = String(params.config_path ?? "");
  const pretrainedModel = String(params.pretrained_model ?? "");
  const ocrTask = String(params.ocr_task ?? "rec");
  const activeRecipe = useMemo(
    () => recipeFromConfig(paddlePresets, configPath, ocrTask),
    [configPath, ocrTask, paddlePresets],
  );
  const activeLabels =
    paddlePresets.find((preset) => preset.id === activeRecipe)?.labels ??
    (ocrTask === "det"
      ? ["det_gt_train.txt", "det_gt_val.txt"]
      : ["rec_gt_train.txt", "rec_gt_val.txt"]);

  const [checkpointMode, setCheckpointMode] = useState<CheckpointMode>(
    checkpointModeFromPath(pretrainedModel),
  );
  const [previousRunFolder, setPreviousRunFolder] = useState(
    folderFromPreviousRunPath(pretrainedModel),
  );

  useEffect(() => {
    setCheckpointMode(checkpointModeFromPath(pretrainedModel));
    setPreviousRunFolder(folderFromPreviousRunPath(pretrainedModel));
  }, [pretrainedModel]);

  const selectRecipe = (presetId: string) => {
    const preset = paddlePresets.find((item) => item.id === presetId);
    if (!preset || preset.available === false) return;
    if (preset.task) onParamChange("ocr_task", preset.task);
    if (preset.config_path) onParamChange("config_path", preset.config_path);
    if (preset.pretrained_model) {
      onParamChange("pretrained_model", preset.pretrained_model);
    }
  };

  const selectCheckpointMode = (mode: CheckpointMode) => {
    setCheckpointMode(mode);
    if (mode === "none") {
      onParamChange("pretrained_model", "");
      return;
    }
    if (mode === "previous-run") {
      onParamChange("pretrained_model", previousRunPath(previousRunFolder));
    }
  };

  const updatePreviousRunFolder = (value: string) => {
    setPreviousRunFolder(value);
    onParamChange("pretrained_model", previousRunPath(value));
  };

  return (
    <div className="rounded-lg border border-border bg-background/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">PaddleOCR base model</h3>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            {t("ocr.paddle.helper")}
          </p>
        </div>
        <StatusBadge tone="neutral">Preset catalog</StatusBadge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {paddlePresets.map((preset) => {
          const active = activeRecipe === preset.id;
          const unavailable = preset.available === false;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={unavailable}
              onClick={() => selectRecipe(preset.id)}
              className={`rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background hover:bg-accent"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{preset.label}</p>
                  {preset.description && (
                    <p
                      className={`mt-1 text-xs leading-5 ${
                        active ? "text-background/70" : "text-muted-foreground"
                      }`}
                    >
                      {preset.description}
                    </p>
                  )}
                </div>
                {active && <CheckCircle2 className="h-4 w-4 shrink-0" />}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {(preset.labels ?? []).map((label) => (
                  <Badge key={label} variant={active ? "outline" : "secondary"}>
                    {label}
                  </Badge>
                ))}
                {unavailable && <Badge variant="secondary">Admin install required</Badge>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-2">
          <Label>PaddleOCR config</Label>
          <Input
            value={configPath}
            onChange={(event) => onParamChange("config_path", event.target.value)}
            placeholder="/opt/PaddleOCR/configs/rec/PP-OCRv4/ch_PP-OCRv4_rec.yml"
          />
          <p className="text-xs leading-5 text-muted-foreground">
            {t("ocr.paddle.configHelper")}
          </p>
        </div>

        <div className="space-y-3">
          <Label>Fine-tune checkpoint</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { id: "none", label: "Config default" },
              { id: "previous-run", label: "Previous run" },
              { id: "custom", label: "Custom path" },
            ].map((option) => (
              <Button
                key={option.id}
                type="button"
                variant={checkpointMode === option.id ? "default" : "outline"}
                onClick={() => selectCheckpointMode(option.id as CheckpointMode)}
              >
                {option.id === "previous-run" && <FolderOpen className="h-4 w-4" />}
                {option.label}
              </Button>
            ))}
          </div>

          {checkpointMode === "previous-run" && (
            <div className="space-y-2">
              <Input
                value={previousRunFolder}
                onChange={(event) => updatePreviousRunFolder(event.target.value)}
                placeholder="previous_ocr_run_1710000000000"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                {t("ocr.paddle.previousRunHelper")}{" "}
                <span className="font-mono text-foreground">
                  /app/runs/{previousRunFolder || "<run-folder>"}/best_accuracy
                </span>
              </p>
            </div>
          )}

          {checkpointMode === "custom" && (
            <div className="space-y-2">
              <Input
                value={pretrainedModel}
                onChange={(event) =>
                  onParamChange("pretrained_model", event.target.value)
                }
                placeholder="/app/runs/my_ocr_run/best_accuracy"
              />
              <p className="text-xs leading-5 text-muted-foreground">
                {t("ocr.paddle.customPathHelper")}
              </p>
            </div>
          )}

          {checkpointMode === "none" && (
            <p className="text-xs leading-5 text-muted-foreground">
              {t("ocr.paddle.noneHelper")}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-border bg-card p-3">
        <p className="text-xs font-medium text-foreground">Expected labels</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {activeLabels.map((label) => (
            <Badge key={label} variant="secondary">
              {label}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
