"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageUp, Loader2, RotateCcw, Sparkles, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/workspace/status-badge";
import { apiBaseUrl } from "@/lib/api";
import { useLanguage } from "@/components/language-provider";

const API_URL = apiBaseUrl();
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"];

interface Prediction {
  className: string;
  confidence: number;
  percent: number;
}

interface PredictResponse {
  predictions: Prediction[];
  top: Prediction | null;
  classes: string[];
  model: { architecture: string; checkpoint: string; imageSize: number; device: string };
  image: { width: number; height: number };
  timingMs: { modelLoad: number; inference: number; total: number };
}

export function ModelTestDialog({
  open,
  onOpenChange,
  runSlug,
  modelName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runSlug: string;
  modelName?: string;
}) {
  const { t } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const [predicting, setPredicting] = useState(false);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Revoke the object URL whenever the preview is replaced or the dialog closes,
  // otherwise every selected image leaks until a full page reload.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const reset = useCallback(() => {
    setFile(null);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return "";
    });
    setResult(null);
    setError("");
    setPredicting(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const chooseFile = (next: File | null | undefined) => {
    if (!next) return;
    if (!next.type.startsWith("image/") && !ACCEPTED.includes(next.type)) {
      setError(t("test.error.notImage"));
      return;
    }
    if (next.size > MAX_IMAGE_BYTES) {
      setError(t("test.error.tooLarge"));
      return;
    }
    setError("");
    setResult(null);
    setFile(next);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(next);
    });
  };

  const predict = async () => {
    if (!file) return;
    setPredicting(true);
    setError("");
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(
        `${API_URL}/api/runs/${encodeURIComponent(runSlug)}/predict`,
        { method: "POST", body: form },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || t("test.error.failed"));
      setResult(data as PredictResponse);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("test.error.failed"));
    } finally {
      setPredicting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-2rem)] max-w-3xl flex-col overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0 text-left">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Test Model
          </DialogTitle>
          <DialogDescription>
            {t("test.dialog.description")}
            {modelName ? ` (${modelName})` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {/* Upload area */}
          {!previewUrl ? (
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                chooseFile(event.dataTransfer.files?.[0]);
              }}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed p-10 text-center transition-colors ${
                dragging ? "border-foreground bg-accent" : "hover:border-foreground/40 hover:bg-accent/40"
              }`}
            >
              <ImageUp className="mb-3 h-9 w-9 text-muted-foreground" />
              <p className="font-medium">{t("test.upload.title")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("test.upload.hint")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-md border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt={file?.name ?? "preview"}
                  className="mx-auto max-h-[280px] w-auto object-contain"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label={t("test.button.clear")}
                  title={t("test.button.clear")}
                  className="absolute right-2 top-2 h-8 w-8"
                  onClick={reset}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {file?.name} · {((file?.size ?? 0) / 1024).toFixed(0)} KB
              </p>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => chooseFile(event.target.files?.[0])}
          />

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          )}

          {/* Loading state: the first prediction has to load the checkpoint from
              disk, which is noticeably slower than later ones. */}
          {predicting && (
            <div className="flex items-center gap-3 rounded-md border bg-accent/40 p-4">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("test.loading.title")}</p>
                <p className="text-xs text-muted-foreground">{t("test.loading.hint")}</p>
              </div>
            </div>
          )}

          {result && (
            <div className="space-y-4">
              <div className="rounded-md border bg-accent/30 p-4">
                <p className="text-xs text-muted-foreground">{t("test.result.top")}</p>
                <p className="mt-1 break-words text-2xl font-semibold">
                  {result.top?.className ?? "-"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("test.result.confidence")} {result.top?.percent ?? 0}%
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-medium">{t("test.result.all")}</p>
                {result.predictions.map((prediction, index) => (
                  <div key={prediction.className} className="space-y-1.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 break-words text-sm">
                        {index === 0 && <span className="mr-1.5">★</span>}
                        {prediction.className}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {prediction.percent}%
                      </span>
                    </div>
                    <Progress value={prediction.percent} className="h-2.5" />
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2 border-t pt-3 text-xs text-muted-foreground">
                <StatusBadge tone="neutral">{result.model.architecture}</StatusBadge>
                <StatusBadge tone="neutral">{result.model.device}</StatusBadge>
                <StatusBadge tone="neutral">
                  {result.image.width}×{result.image.height}px
                </StatusBadge>
                <StatusBadge tone="success">{result.timingMs.total} ms</StatusBadge>
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-2 border-t pt-4">
          {result && (
            <Button variant="outline" onClick={reset}>
              <RotateCcw className="h-4 w-4" />
              {t("test.button.another")}
            </Button>
          )}
          <Button onClick={predict} disabled={!file || predicting}>
            {predicting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {predicting ? t("test.button.predicting") : t("test.button.predict")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
