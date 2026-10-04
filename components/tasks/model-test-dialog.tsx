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
import { ExecutionSelector } from './execution-selector';
import { ComputeJob, ExecutionSelection, computeActive, computeMessage } from '@/lib/compute';

const API_URL = apiBaseUrl();
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/bmp", "image/tiff"];

interface Prediction {
  className: string;
  confidence: number;
  percent: number;
  // Present only for detection results: [x1, y1, x2, y2] in original pixels.
  box?: [number, number, number, number];
}

interface LegendEntry {
  name: string;
  color: string;
  percent: number;
}

interface Instance {
  className: string;
  color: string;
  percent: number;
  box: [number, number, number, number];
}

interface Segmentation {
  kind: "semantic" | "instance";
  overlay: string; // data:image/png;base64,... sized to the original image
  legend?: LegendEntry[]; // semantic: per-class coverage
  instances?: Instance[]; // instance: one entry per detected object
  counts?: Record<string, number>;
}

interface PredictResponse {
  taskType?: string;
  predictions?: Prediction[];
  top?: Prediction | null;
  classes: string[];
  model: { architecture: string; checkpoint: string; imageSize?: number; device: string };
  image: { width: number; height: number };
  timingMs: { modelLoad: number; inference: number; total: number };
  // Detection-only fields.
  count?: number;
  counts?: Record<string, number>;
  threshold?: number;
  // Segmentation-only field.
  segmentation?: Segmentation;
}

// Distinct, high-contrast hues cycled per class so overlaid boxes stay legible
// on both light and dark images.
const BOX_COLOURS = [
  "#ef4444", "#3b82f6", "#22c55e", "#f59e0b",
  "#a855f7", "#ec4899", "#06b6d4", "#84cc16",
];

function colourForClass(classes: string[], name: string) {
  const index = Math.max(0, classes.indexOf(name));
  return BOX_COLOURS[index % BOX_COLOURS.length];
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
  const { t, language } = useLanguage();
  const thai = language === 'th';
  const [execution, setExecution] = useState<ExecutionSelection>({ mode: 'auto' });
  const [job, setJob] = useState<ComputeJob | null>(null);
  const generation = useRef(0);
  const executionEdited = useRef(false);
  const requestKey = useRef<string | null>(null);
  const jobId = job?.id;
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
    generation.current += 1;
    requestKey.current = null;
    setJob(null);
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
    reset();
    executionEdited.current = false;
    if (!open) return;
    const controller = new AbortController();
    const version = generation.current;
    fetch(`${API_URL}/api/compute/jobs?runSlug=${encodeURIComponent(runSlug)}`, { signal: controller.signal })
      .then((r) => r.ok ? r.json() : null).then((data) => {
        if (!controller.signal.aborted && version === generation.current && data?.job) {
          setJob(data.job);
          if (!executionEdited.current) setExecution(data.job.requestedExecution);
          setPreviewUrl(`${API_URL}/api/compute/jobs/${data.job.id}/input`);
        }
      }).catch(() => undefined);
    return () => { controller.abort(); generation.current += 1; };
  }, [open, runSlug, reset]);

  useEffect(() => {
    if (!open || !jobId) return;
    const controller = new AbortController();
    const version = generation.current;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let terminal = false;
      try {
        const response = await fetch(`${API_URL}/api/compute/jobs/${jobId}`, { signal: controller.signal });
        const current = await response.json();
        if (!response.ok) {
          terminal = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
          throw new Error(computeMessage(current.code, thai, current.detail || 'Status unavailable'));
        }
        if (controller.signal.aborted || version !== generation.current) return;
        setJob(current);
        setError('');
        terminal = !computeActive(current);
        if (current.status === 'completed') {
          // A completed job still needs retryable delivery of its result.
          terminal = false;
          const response = await fetch(`${API_URL}/api/compute/jobs/${jobId}/result`, { signal: controller.signal });
          const data = await response.json();
          if (!response.ok) {
            terminal = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
            throw new Error(computeMessage(data.code, thai, data.detail));
          }
          if (!controller.signal.aborted && version === generation.current) {
            setResult(data);
            setPredicting(false);
          }
          return;
        }
        if (current.status === 'failed' || current.status === 'cancelled') {
          setPredicting(false);
          if (current.status === 'failed') setError(computeMessage(current.errorCode, thai, current.error));
          return;
        }
      } catch (caught) {
        if (controller.signal.aborted || version !== generation.current) return;
        setError(caught instanceof TypeError || !(caught instanceof Error)
          ? computeMessage('CONNECTION_INTERRUPTED', thai) : caught.message);
      }
      if (!controller.signal.aborted && !terminal) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [open, jobId, thai]);

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
    generation.current += 1;
    requestKey.current = null;
    setJob(null);
    setPredicting(false);
    setError("");
    setResult(null);
    setFile(next);
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(next);
    });
  };

  const isDetection = result?.taskType === "object_detection";
  const isSegmentation = result?.taskType === "segmentation";

  const predict = async () => {
    if (!file) return;
    setPredicting(true);
    setError("");
    setResult(null);
    const version = generation.current;
    try {
      const form = new FormData();
      form.append("file", file);
      form.append('execution', JSON.stringify(execution));
      // getRandomValues also works on HTTP deployments where randomUUID is unavailable.
      requestKey.current ??= Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, '0')).join('');
      const response = await fetch(
        `${API_URL}/api/runs/${encodeURIComponent(runSlug)}/predict`,
        { method: "POST", body: form, headers: { 'Idempotency-Key': requestKey.current } },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(computeMessage(data.code, thai, data.detail || t("test.error.failed")));
      if (version !== generation.current) return;
      requestKey.current = null;
      if (response.status === 202) setJob(data); else setResult(data as PredictResponse);
    } catch (caught) {
      if (version === generation.current) setError(caught instanceof TypeError
        ? computeMessage('SUBMISSION_UNCONFIRMED', thai)
        : caught instanceof Error ? caught.message : t("test.error.failed"));
    } finally {
      if (version === generation.current) setPredicting(false);
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
          <ExecutionSelector value={execution} onChange={(next) => { executionEdited.current = true; requestKey.current = null; setExecution(next); }} disabled={predicting || computeActive(job)} />
          {job && <div role="status" className="space-y-2 border-b pb-3 text-sm">
            <p>{computeMessage(job.status, thai)}{job.assignedGpu && ` · ${job.assignedGpu.name || job.assignedGpu.uuid}`}</p>
            {job.queueReason && <p className="text-muted-foreground">{computeMessage(job.queueReason, thai)}</p>}
            {computeActive(job) && <Button variant="outline" onClick={async () => {
              const version = generation.current;
              try {
                const response = await fetch(`${API_URL}/api/compute/jobs/${job.id}/cancel`, { method: 'POST' });
                const data = await response.json();
                if (version !== generation.current) return;
                if (response.ok) setJob(data); else setError(computeMessage(data.code, thai, data.detail));
              } catch {
                if (version === generation.current) setError(thai ? 'ยกเลิกไม่สำเร็จ กรุณาลองอีกครั้ง' : 'Cancellation failed. Please retry.');
              }
            }}><X className="h-4 w-4" />{thai ? 'ยกเลิกงาน' : 'Cancel job'}</Button>}
          </div>}
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
              <div className="relative flex justify-center overflow-hidden rounded-md border bg-muted/30">
                {/* Tight inline-block wrapper so the detection overlay's
                    percentage coordinates line up with the rendered image
                    exactly, regardless of how the image is scaled to fit. */}
                <div className="relative inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={file?.name ?? "preview"}
                    className="block max-h-[320px] w-auto max-w-full"
                  />
                  {isSegmentation && result?.segmentation && (
                    // The overlay PNG is exactly the original image's size, so
                    // stretching it to the rendered image lines masks up 1:1.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={result.segmentation.overlay}
                      alt="segmentation overlay"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    />
                  )}
                  {isDetection && result && (
                    <div className="pointer-events-none absolute inset-0">
                      {(result.predictions ?? []).map((prediction, index) => {
                        if (!prediction.box) return null;
                        const [x1, y1, x2, y2] = prediction.box;
                        const w = result.image.width || 1;
                        const h = result.image.height || 1;
                        const colour = colourForClass(result.classes, prediction.className);
                        return (
                          <div
                            key={index}
                            className="absolute"
                            style={{
                              left: `${(x1 / w) * 100}%`,
                              top: `${(y1 / h) * 100}%`,
                              width: `${((x2 - x1) / w) * 100}%`,
                              height: `${((y2 - y1) / h) * 100}%`,
                              border: `2px solid ${colour}`,
                            }}
                          >
                            <span
                              className="absolute left-0 top-0 -translate-y-full whitespace-nowrap px-1 text-[10px] font-semibold leading-tight text-white"
                              style={{ backgroundColor: colour }}
                            >
                              {prediction.className} {prediction.percent}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
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
                {file?.name ?? job?.inputName ?? (thai ? 'รูปทดสอบ' : 'Test image')}
                {(file?.size ?? job?.inputBytes) != null && ` · ${Math.max(1, Math.ceil((file?.size ?? job?.inputBytes ?? 0) / 1024))} KB`}
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
          {(predicting || computeActive(job)) && (
            <div className="flex items-center gap-3 rounded-md border bg-accent/40 p-4">
              <Loader2 className="h-5 w-5 shrink-0 animate-spin" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{t("test.loading.title")}</p>
                <p className="text-xs text-muted-foreground">{t("test.loading.hint")}</p>
              </div>
            </div>
          )}

          {result && isDetection && (
            <div className="space-y-4">
              <div className="rounded-md border bg-accent/30 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs text-muted-foreground">{t("test.detect.summary")}</p>
                  <p className="text-2xl font-semibold tabular-nums">
                    {result.count ?? result.predictions?.length ?? 0}
                  </p>
                </div>
                {typeof result.threshold === "number" && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("test.detect.threshold").replace("{value}", String(Math.round(result.threshold * 100)))}
                  </p>
                )}
              </div>

              {(result.predictions?.length ?? 0) === 0 ? (
                <p className="rounded-md border p-3 text-sm text-muted-foreground">{t("test.detect.none")}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("test.detect.objects")}</p>
                  {(result.predictions ?? []).map((prediction, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0 rounded-sm"
                          style={{ backgroundColor: colourForClass(result.classes, prediction.className) }}
                        />
                        <span className="break-words">{prediction.className}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">{prediction.percent}%</span>
                    </div>
                  ))}
                </div>
              )}

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

          {result && isSegmentation && result.segmentation && (
            <div className="space-y-4">
              <div className="rounded-md border bg-accent/30 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-xs text-muted-foreground">
                    {result.segmentation.kind === "instance" ? t("test.detect.summary") : t("test.seg.classes")}
                  </p>
                  <p className="text-2xl font-semibold tabular-nums">{result.count ?? 0}</p>
                </div>
              </div>

              {result.segmentation.kind === "instance" ? (
                (result.segmentation.instances?.length ?? 0) === 0 ? (
                  <p className="rounded-md border p-3 text-sm text-muted-foreground">{t("test.detect.none")}</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">{t("test.detect.objects")}</p>
                    {(result.segmentation.instances ?? []).map((instance, index) => (
                      <div key={index} className="flex items-center justify-between gap-3 rounded-md border p-2 text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: instance.color }} />
                          <span className="break-words">{instance.className}</span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">{instance.percent}%</span>
                      </div>
                    ))}
                  </div>
                )
              ) : (result.segmentation.legend?.length ?? 0) === 0 ? (
                <p className="rounded-md border p-3 text-sm text-muted-foreground">{t("test.seg.none")}</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm font-medium">{t("test.seg.coverage")}</p>
                  {(result.segmentation.legend ?? []).map((entry, index) => (
                    <div key={index} className="space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="flex min-w-0 items-center gap-2 text-sm">
                          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: entry.color }} />
                          <span className="break-words">{entry.name}</span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums">{entry.percent}%</span>
                      </div>
                      <Progress value={entry.percent} className="h-2.5" />
                    </div>
                  ))}
                </div>
              )}

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

          {result && !isDetection && !isSegmentation && (
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
                {(result.predictions ?? []).map((prediction, index) => (
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
          <Button onClick={predict} disabled={!file || predicting || computeActive(job)}>
            {predicting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {predicting ? t("test.button.predicting") : t("test.button.predict")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
