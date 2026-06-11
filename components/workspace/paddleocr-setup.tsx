"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FolderOpen, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/workspace/status-badge";
import { type ConfigValue } from "@/lib/useTrainingConfig";

const paddleRecipes = [
  {
    id: "rec",
    label: "Text recognition",
    task: "rec",
    configPath: "/opt/PaddleOCR/configs/rec/PP-OCRv4/ch_PP-OCRv4_rec.yml",
    labels: ["rec_gt_train.txt", "rec_gt_val.txt"],
    description: "Use this when each cropped text image has one transcript.",
  },
  {
    id: "det",
    label: "Text detection",
    task: "det",
    configPath: "/opt/PaddleOCR/configs/det/ch_PP-OCRv4/ch_PP-OCRv4_det.yml",
    labels: ["det_gt_train.txt", "det_gt_val.txt"],
    description: "Use this when labels mark text boxes or polygons.",
  },
] as const;

type RecipeId = (typeof paddleRecipes)[number]["id"] | "custom";
type CheckpointMode = "none" | "previous-run" | "custom";

function previousRunPath(runFolder: string) {
  const trimmed = runFolder.trim();
  return trimmed ? `/app/runs/${trimmed}/best_accuracy` : "";
}

function folderFromPreviousRunPath(path: string) {
  const match = path.match(/^\/app\/runs\/(.+)\/best_accuracy$/);
  return match?.[1] ?? "";
}

function recipeFromConfig(configPath: string, ocrTask: string): RecipeId {
  const exactConfigMatch = paddleRecipes.find(
    (recipe) => recipe.configPath === configPath,
  );
  if (exactConfigMatch) {
    return exactConfigMatch.id;
  }
  if (configPath.trim()) {
    return "custom";
  }
  const taskMatch = paddleRecipes.find((recipe) => recipe.task === ocrTask);
  return taskMatch?.id ?? "custom";
}

function checkpointModeFromPath(path: string): CheckpointMode {
  if (!path) return "none";
  return folderFromPreviousRunPath(path) ? "previous-run" : "custom";
}

export function PaddleOcrSetup({
  params,
  onParamChange,
}: {
  params: Record<string, ConfigValue>;
  onParamChange: (key: string, value: ConfigValue) => void;
}) {
  const configPath = String(params.config_path ?? "");
  const pretrainedModel = String(params.pretrained_model ?? "");
  const ocrTask = String(params.ocr_task ?? "rec");
  const activeRecipe = useMemo(
    () => recipeFromConfig(configPath, ocrTask),
    [configPath, ocrTask],
  );
  const activeLabels =
    paddleRecipes.find((recipe) => recipe.id === activeRecipe)?.labels ??
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

  const selectRecipe = (recipeId: RecipeId) => {
    if (recipeId === "custom") return;
    const recipe = paddleRecipes.find((item) => item.id === recipeId);
    if (!recipe) return;
    onParamChange("ocr_task", recipe.task);
    onParamChange("config_path", recipe.configPath);
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
            <h3 className="text-sm font-semibold">PaddleOCR setup</h3>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            Pick a recipe first. AILAB will fill the PaddleOCR config path and
            keep the expected label filenames visible before you train.
          </p>
        </div>
        <StatusBadge tone="neutral">OCR helper</StatusBadge>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {paddleRecipes.map((recipe) => {
          const active = activeRecipe === recipe.id;
          return (
            <button
              key={recipe.id}
              type="button"
              onClick={() => selectRecipe(recipe.id)}
              className={`rounded-lg border p-3 text-left transition-colors ${
                active
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background hover:bg-accent"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{recipe.label}</p>
                  <p
                    className={`mt-1 text-xs leading-5 ${
                      active ? "text-background/70" : "text-muted-foreground"
                    }`}
                  >
                    {recipe.description}
                  </p>
                </div>
                {active && <CheckCircle2 className="h-4 w-4 shrink-0" />}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {recipe.labels.map((label) => (
                  <Badge key={label} variant={active ? "outline" : "secondary"}>
                    {label}
                  </Badge>
                ))}
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
            Use the preset value unless you have a custom config inside the OCR
            worker image.
          </p>
        </div>

        <div className="space-y-3">
          <Label>Fine-tune from checkpoint</Label>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { id: "none", label: "None" },
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
                AILAB will send{" "}
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
                The path must exist inside the OCR worker container.
              </p>
            </div>
          )}

          {checkpointMode === "none" && (
            <p className="text-xs leading-5 text-muted-foreground">
              No pretrained override will be sent. PaddleOCR will use whatever
              the selected config defines.
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
