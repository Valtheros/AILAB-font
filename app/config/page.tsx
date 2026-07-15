"use client";

import { MainLayout } from "@/components/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/workspace/page-header";
import { PaddleOcrSetup } from "@/components/workspace/paddleocr-setup";
import { TesseractSetup } from "@/components/workspace/tesseract-setup";
import { StatusBadge } from "@/components/workspace/status-badge";
import {
  Activity,
  BookOpenCheck,
  Boxes,
  CheckCircle,
  Cpu,
  Database,
  FileText,
  Play,
  RotateCcw,
  Settings,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import {
  CVCatalog,
  ModelSpec,
  ParamSpec,
  defaultParamsFor,
  fallbackCatalog,
  getModel,
  getTask,
} from "@/lib/cvCatalog";
import { apiBaseUrl } from "@/lib/api";
import { ConfigValue, useTrainingConfig } from "@/lib/useTrainingConfig";
import { memorySafetyForModel, safeDefaultEntries } from "@/lib/resourceSafety";
import { useLanguage } from "@/components/language-provider";

const API_URL = apiBaseUrl();

interface CompatibleModel {
  id: string;
  label: string;
  task: string;
  ready: boolean;
  reason: string;
  dataset_task?: string;
  required_annotations?: string[];
  accepted_canonical_formats?: string[];
  train_export_format?: string;
}

interface Dataset {
  id: string;
  name: string;
  images: number;
  classes: string[];
  tasks: string[];
  formats: string[];
  size: string;
  paddleocrTasks?: string[];
  sourceFormat?: string;
  datasetTask?: string;
  datasetTasks?: string[];
  canonicalTask?: string;
  canonicalFormat?: string;
  readyModels?: CompatibleModel[];
  compatibleModels?: CompatibleModel[];
}

const taskIcons: Record<string, ComponentType<{ className?: string }>> = {
  image_classification: Cpu,
  segmentation: Boxes,
  ocr: FileText,
  object_detection: Activity,
};

function formatLabel(value?: string) {
  return value ? value.replaceAll("_", " ") : "unknown";
}

function isPaddleOcrTaskCompatible(dataset: Dataset, params: Record<string, ConfigValue>) {
  const requestedTask = String(params.ocr_task ?? "rec");
  if (requestedTask === "det") return dataset.paddleocrTasks?.includes("det") ?? false;
  return Boolean(
    dataset.paddleocrTasks?.includes("rec") ||
      dataset.formats?.includes("tesseract_ground_truth"),
  );
}

function isDatasetCompatible(
  dataset: Dataset,
  model: ModelSpec,
  taskId: string,
  params: Record<string, ConfigValue>,
) {
  const compatibility = dataset.compatibleModels?.find((item) => item.id === model.id);
  if (compatibility) {
    if (!compatibility.ready) return false;
    if (model.id === "paddleocr") return isPaddleOcrTaskCompatible(dataset, params);
    return true;
  }

  const hasMatchingFormat = model.dataset_formats.some((format) =>
    dataset.formats?.includes(format),
  );
  const hasMatchingTask = dataset.tasks?.includes(taskId);
  if (!hasMatchingFormat || !hasMatchingTask) return false;

  if (model.id === "paddleocr") return isPaddleOcrTaskCompatible(dataset, params);

  return true;
}

const paddleOcrSetupParamKeys = new Set(["config_path", "pretrained_model"]);
const tesseractSetupParamKeys = new Set(["start_model"]);

function coerceValue(spec: ParamSpec, raw: string | boolean): ConfigValue {
  if (spec.type === "boolean") {
    return Boolean(raw);
  }
  if (spec.type === "number") {
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : Number(spec.default);
  }
  return String(raw);
}

function ParamInput({
  spec,
  t,
  value,
  onChange,
}: {
  spec: ParamSpec;
  t: (key: string) => string;
  value: ConfigValue;
  onChange: (value: ConfigValue) => void;
}) {
  if (spec.type === "boolean") {
    return (
      <div className="flex min-h-24 items-center justify-between rounded-lg border border-border bg-background/70 p-4">
        <div className="pr-4">
          <Label>{spec.label}</Label>
          {spec.description && (
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t(spec.description)}
            </p>
          )}
        </div>
        <Switch checked={Boolean(value)} onCheckedChange={onChange} />
      </div>
    );
  }

  if (spec.type === "select") {
    return (
      <div className="space-y-2">
        <Label>{spec.label}</Label>
        <Select
          value={String(value ?? spec.default)}
          onValueChange={(next) => onChange(next)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(spec.options ?? []).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {spec.description && (
          <p className="text-xs leading-5 text-muted-foreground">
            {t(spec.description)}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{spec.label}</Label>
      <Input
        type={spec.type === "number" ? "number" : "text"}
        value={String(value ?? spec.default)}
        min={spec.min}
        max={spec.max}
        step={spec.step}
        onChange={(event) => onChange(coerceValue(spec, event.target.value))}
      />
      {spec.description && (
        <p className="text-xs leading-5 text-muted-foreground">
          {t(spec.description)}
        </p>
      )}
    </div>
  );
}

export default function ConfigPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const {
    config,
    deviceSelection,
    updateConfig,
    updateParam,
    setTaskModel,
    resetConfig,
  } = useTrainingConfig();
  const [catalog, setCatalog] = useState<CVCatalog>(fallbackCatalog);
  const [catalogSource, setCatalogSource] = useState<"backend" | "fallback">(
    "backend",
  );
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetError, setDatasetError] = useState("");

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const response = await fetch(`${API_URL}/api/model-catalog`);
        if (!response.ok) {
          throw new Error(`Catalog returned ${response.status}`);
        }
        setCatalog(await response.json());
        setCatalogSource("backend");
      } catch {
        setCatalog(fallbackCatalog);
        setCatalogSource("fallback");
      }
    };

    const loadDatasets = async () => {
      try {
        const response = await fetch(`${API_URL}/api/datasets`);
        if (!response.ok) {
          throw new Error(`Datasets returned ${response.status}`);
        }
        const data = await response.json();
        setDatasets(data.datasets ?? []);
        setDatasetError("");
      } catch {
        setDatasets([]);
        setDatasetError(
          `Datasets unavailable. ${t("common.backendReachable")}`,
        );
      }
    };

    loadCatalog();
    loadDatasets();
  }, []);

  const selectedTask = getTask(catalog, config.taskType);
  const selectedModel = getModel(catalog, selectedTask.id, config.modelType);
  const deviceSpec = useMemo(
    () => catalog.common_params.find((param) => param.key === "device"),
    [catalog.common_params],
  );
  const deviceOptions = useMemo(() => deviceSpec?.options ?? [], [deviceSpec]);

  useEffect(() => {
    if (config.taskType === selectedTask.id && config.modelType === selectedModel.id) {
      return;
    }
    setTaskModel(
      selectedTask.id,
      selectedModel.id,
      selectedModel.model_name,
      defaultParamsFor(selectedModel, catalog.common_params),
    );
  }, [
    catalog.common_params,
    config.modelType,
    config.taskType,
    selectedModel,
    selectedTask.id,
    setTaskModel,
  ]);

  useEffect(() => {
    if (deviceOptions.length === 0) return;
    const preferredDevice = String(deviceSpec?.default ?? deviceOptions[0].value);
    const currentDeviceAvailable = deviceOptions.some(
      (option) => option.value === config.device,
    );
    const shouldPreferGpuDefault =
      deviceSelection === "auto" && preferredDevice !== "cpu" && config.device === "cpu";

    if (!currentDeviceAvailable || shouldPreferGpuDefault) {
      updateConfig("device", preferredDevice, { deviceSelection: "auto" });
    }
  }, [config.device, deviceOptions, deviceSelection, deviceSpec?.default, updateConfig]);

  const compatibleDatasets = useMemo(
    () =>
      datasets.filter((dataset) =>
        isDatasetCompatible(dataset, selectedModel, selectedTask.id, config.params),
      ),
    [config.params, datasets, selectedModel, selectedTask.id],
  );
  const selectedDataset = compatibleDatasets.find(
    (dataset) => dataset.name === config.datasetName,
  );
  const joinDetailLabels = (items: string[]) =>
    items.map((item) => t(item)).join(t("common.orSeparator"));
  const requiredAnnotationLabel = joinDetailLabels(
    selectedModel.required_annotations?.length
      ? selectedModel.required_annotations
      : selectedModel.dataset_formats,
  );
  const exportFormatLabel = selectedModel.train_export_format || selectedModel.canonical_format || selectedModel.dataset_formats.join(" or ");
  const emptyDatasetMessage =
    datasets.length === 0
      ? t("config.model.empty.noDatasets")
      : t("config.dataset.empty.noMatch")
          .replace("{model}", selectedModel.label)
          .replace("{annotations}", requiredAnnotationLabel)
          .replace("{exportFormat}", exportFormatLabel);

  const commonSpecs = useMemo(() => catalog.common_params, [catalog]);
  const modelSpecs = selectedModel.params;
  const visibleModelSpecs = useMemo(() => {
    if (selectedModel.id === "paddleocr") {
      return modelSpecs.filter((spec) => !paddleOcrSetupParamKeys.has(spec.key));
    }
    if (selectedModel.id === "tesseract") {
      return modelSpecs.filter((spec) => !tesseractSetupParamKeys.has(spec.key));
    }
    return modelSpecs;
  }, [modelSpecs, selectedModel.id]);

  const memorySafety = useMemo(
    () =>
      memorySafetyForModel(selectedModel, {
        batchSize: config.batchSize,
        workers: config.workers,
        device: config.device,
        amp: config.amp,
        params: config.params,
      }),
    [config.amp, config.batchSize, config.device, config.params, config.workers, selectedModel],
  );

  const applySafeSettings = () => {
    for (const [key, value] of safeDefaultEntries(selectedModel)) {
      if (key === "batch_size") {
        updateConfig("batchSize", Number(value));
      } else if (key === "workers") {
        updateConfig("workers", Number(value));
      } else if (key === "amp") {
        updateConfig("amp", Boolean(value));
      } else {
        updateParam(key, value as ConfigValue);
      }
    }
  };

  useEffect(() => {
    if (selectedDataset) return;
    const nextDatasetName = compatibleDatasets[0]?.name ?? "";
    if (config.datasetName !== nextDatasetName) {
      updateConfig("datasetName", nextDatasetName);
    }
  }, [compatibleDatasets, config.datasetName, selectedDataset, updateConfig]);

  const handleTaskChange = (taskId: string) => {
    const task = getTask(catalog, taskId);
    const model = task.models[0];
    setTaskModel(
      task.id,
      model.id,
      model.model_name,
      defaultParamsFor(model, catalog.common_params),
    );
  };

  const handleModelChange = (modelId: string) => {
    const model =
      selectedTask.models.find((item) => item.id === modelId) ??
      selectedTask.models[0];
    setTaskModel(
      selectedTask.id,
      model.id,
      model.model_name,
      defaultParamsFor(model, catalog.common_params),
    );
  };

  const commonValue = (spec: ParamSpec) => {
    if (spec.key === "epochs") return config.epochs;
    if (spec.key === "batch_size") return config.batchSize;
    if (spec.key === "device") return config.device;
    if (spec.key === "workers") return config.workers;
    if (spec.key === "amp") return config.amp;
    if (spec.key === "seed") return config.seed;
    return config.params[spec.key] ?? spec.default;
  };

  const handleCommonParam = (spec: ParamSpec, value: ConfigValue) => {
    updateParam(spec.key, value);
    if (spec.key === "epochs") updateConfig("epochs", Number(value));
    if (spec.key === "batch_size") updateConfig("batchSize", Number(value));
    if (spec.key === "device") {
      updateConfig("device", String(value), { deviceSelection: "manual" });
    }
    if (spec.key === "workers") updateConfig("workers", Number(value));
    if (spec.key === "amp") updateConfig("amp", Boolean(value));
    if (spec.key === "seed") updateConfig("seed", Number(value));
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Configuration"
          title="Model Configuration"
          description={t("config.header.description")}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={resetConfig}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/guide")}
              >
                <BookOpenCheck className="h-4 w-4" />
                Guide
              </Button>
              <Button size="sm" onClick={() => router.push("/training?mode=review")} disabled={!memorySafety.ok}>
                <Play className="h-4 w-4" />
                Review Training
              </Button>
            </>
          }
        />

        <div className="flex flex-wrap gap-2">
          {catalogSource === "fallback" ? (
            <StatusBadge tone="warning">Using local model catalog</StatusBadge>
          ) : (
            <StatusBadge tone="success">
              Backend catalog {catalog.version}
            </StatusBadge>
          )}
          {datasetError && <StatusBadge tone="warning">{datasetError}</StatusBadge>}
        </div>

        <div className="grid min-w-0 gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Task
                </CardTitle>
                <CardDescription>
                  {t("config.task.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select value={selectedTask.id} onValueChange={handleTaskChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.tasks.map((task) => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid gap-2">
                  {catalog.tasks.map((task) => {
                    const Icon = taskIcons[task.id] ?? Activity;
                    const active = task.id === selectedTask.id;
                    return (
                      <button
                        key={task.id}
                        onClick={() => handleTaskChange(task.id)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          active
                            ? "border-foreground bg-foreground text-background"
                            : "border-border bg-background/70 hover:bg-accent"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{task.label}</p>
                            <p
                              className={`text-xs ${
                                active ? "text-background/70" : "text-muted-foreground"
                              }`}
                            >
                              {task.models.length} models
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Dataset
                </CardTitle>
                <CardDescription>
                  {t("config.dataset.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Required annotations
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(selectedModel.required_annotations?.length
                      ? selectedModel.required_annotations
                      : selectedModel.dataset_formats
                    ).map((item) => (
                      <Badge variant="secondary" key={item}>
                        {t(item)}
                      </Badge>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {t("config.dataset.trainExport").replace("{exportFormat}", exportFormatLabel)}
                  </p>
                </div>
                <div className="space-y-2">
                  {compatibleDatasets.map((dataset) => {
                    const selected = selectedDataset?.name === dataset.name;
                    return (
                      <button
                        aria-pressed={selected}
                        key={dataset.id}
                        type="button"
                        onClick={() => updateConfig("datasetName", dataset.name)}
                        className={`w-full rounded-lg border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          selected
                            ? "border-foreground bg-accent"
                            : "border-border bg-background/70 hover:bg-accent/60"
                        }`}
                      >
                        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                          <span className="min-w-0 break-all font-medium sm:break-words">{dataset.name}</span>
                          <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:shrink-0 sm:justify-end">
                            {selected && (
                              <StatusBadge tone="success">Selected</StatusBadge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {dataset.size}
                            </span>
                          </div>
                        </div>
                        <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">
                          {dataset.images.toLocaleString()} images - {formatLabel(dataset.datasetTask ?? dataset.canonicalTask)} - {formatLabel(dataset.canonicalFormat)}
                          {dataset.paddleocrTasks?.length
                            ? ` - OCR: ${dataset.paddleocrTasks.join(", ")}`
                            : ""}
                        </p>
                      </button>
                    );
                  })}
                  {compatibleDatasets.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border bg-background/70 p-3">
                      <StatusBadge tone="warning">No compatible dataset</StatusBadge>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        {emptyDatasetMessage}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </aside>

          <div className="min-w-0 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Model
                </CardTitle>
                <CardDescription>{t(selectedTask.description)}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                {selectedTask.models.map((model) => {
                  const active = model.id === selectedModel.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleModelChange(model.id)}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        active
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-background/70 hover:bg-accent"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{model.label}</p>
                          <p
                            className={`mt-1 text-xs ${
                              active ? "text-background/70" : "text-muted-foreground"
                            }`}
                          >
                            {model.runtime}
                          </p>
                        </div>
                        {active && <CheckCircle className="h-5 w-5 shrink-0" />}
                      </div>
                      <p
                        className={`mt-3 text-sm leading-6 ${
                          active ? "text-background/80" : "text-muted-foreground"
                        }`}
                      >
                        {t(model.reason)}
                      </p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Run Settings</CardTitle>
                <CardDescription>
                  {t("config.run.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Project name</Label>
                  <Input
                    value={config.projectName}
                    onChange={(event) =>
                      updateConfig("projectName", event.target.value)
                    }
                  />
                </div>
                {commonSpecs.map((spec) => (
                  <ParamInput
                    key={spec.key}
                    spec={spec}
                    t={t}
                    value={commonValue(spec)}
                    onChange={(value) => handleCommonParam(spec, value)}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5" />
                      Memory safety
                    </CardTitle>
                    <CardDescription>
                      {t("Helps prevent memory errors before training starts.")}
                    </CardDescription>
                  </div>
                  <StatusBadge tone={memorySafety.ok ? "success" : "warning"}>
                    {memorySafety.label}
                  </StatusBadge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {memorySafety.summary.map((item) => (
                    <Badge variant="secondary" key={item}>
                      {item}
                    </Badge>
                  ))}
                  <Badge variant="outline">
                    AMP {config.amp ? "on" : "off"}
                  </Badge>
                </div>

                {!memorySafety.ok && (
                  <div className="rounded-lg border border-amber-300/40 bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
                    <div className="flex items-start gap-2 font-medium">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                      {t("Adjust these values before training")}
                    </div>
                    <ul className="mt-2 list-disc space-y-1 pl-5 leading-6">
                      {[...memorySafety.issues, ...memorySafety.suggestions].map((item) => (
                        <li key={item}>{t(item)}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedModel.memory_notes?.length ? (
                  <div className="grid gap-2 md:grid-cols-2">
                    {selectedModel.memory_notes.map((note) => (
                      <div key={note} className="rounded-lg border border-border bg-background/70 p-3 text-sm leading-6 text-muted-foreground">
                        {t(note)}
                      </div>
                    ))}
                  </div>
                ) : null}

                <Button variant="outline" size="sm" onClick={applySafeSettings}>
                  Apply safe settings
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{selectedModel.label} Parameters</CardTitle>
                <CardDescription>
                  {t("config.params.description")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {selectedModel.id === "paddleocr" && (
                  <PaddleOcrSetup
                    params={config.params}
                    presets={selectedModel.base_model_presets}
                    onParamChange={updateParam}
                  />
                )}
                {selectedModel.id === "tesseract" && (
                  <TesseractSetup
                    params={config.params}
                    presets={selectedModel.base_model_presets}
                    onParamChange={updateParam}
                  />
                )}
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {visibleModelSpecs.map((spec) => (
                    <ParamInput
                      key={spec.key}
                      spec={spec}
                      t={t}
                      value={config.params[spec.key] ?? spec.default}
                      onChange={(value) => updateParam(spec.key, value)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
