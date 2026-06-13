"use client";

import { CheckCircle2, Languages } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/workspace/status-badge";
import { type OcrBaseModelPreset } from "@/lib/cvCatalog";
import { type ConfigValue } from "@/lib/useTrainingConfig";
import { useLanguage } from "@/components/language-provider";

const fallbackTesseractPresets: OcrBaseModelPreset[] = [
  {
    id: "eng",
    value: "eng",
    label: "English (eng)",
    description: "Bundled with the OCR worker image.",
    available: true,
  },
  {
    id: "tha",
    value: "tha",
    label: "Thai (tha)",
    description: "Bundled with the OCR worker image after rebuild.",
    available: true,
  },
];

export function TesseractSetup({
  params,
  presets,
  onParamChange,
}: {
  params: Record<string, ConfigValue>;
  presets?: OcrBaseModelPreset[];
  onParamChange: (key: string, value: ConfigValue) => void;
}) {
  const { t } = useLanguage();
  const basePresets = presets?.length ? presets : fallbackTesseractPresets;
  const startModel = String(params.start_model ?? "eng");
  const customStartModel = basePresets.some(
    (preset) => (preset.value ?? preset.id) === startModel,
  )
    ? ""
    : startModel;

  return (
    <div className="rounded-lg border border-border bg-background/70 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Tesseract start model</h3>
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-5 text-muted-foreground">
            {t("ocr.tesseract.helper")}
          </p>
        </div>
        <StatusBadge tone="neutral">Base traineddata</StatusBadge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {basePresets.map((preset) => {
          const value = preset.value ?? preset.id;
          const active = startModel === value;
          const unavailable = preset.available === false;
          return (
            <button
              key={preset.id}
              type="button"
              disabled={unavailable}
              onClick={() => onParamChange("start_model", value)}
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
                <Badge variant={active ? "outline" : "secondary"}>{value}</Badge>
                {unavailable && <Badge variant="secondary">Admin install required</Badge>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 max-w-sm space-y-2">
        <Label>Custom start model</Label>
        <Input
          value={customStartModel}
          onChange={(event) => onParamChange("start_model", event.target.value)}
          placeholder="custom_lang"
        />
        <p className="text-xs leading-5 text-muted-foreground">
          {t("ocr.tesseract.customHelper")}
        </p>
      </div>
    </div>
  );
}
