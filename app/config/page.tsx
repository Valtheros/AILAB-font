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
  Save,
  Settings,
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

const API_URL = apiBaseUrl();

interface Dataset {
  id: string;
  name: string;
  images: number;
  classes: string[];
  tasks: string[];
  formats: string[];
  size: string;
}

const taskIcons: Record<string, ComponentType<{ className?: string }>> = {
  image_classification: Cpu,
  segmentation: Boxes,
  ocr: FileText,
  object_detection: Activity,
};

function isDatasetCompatible(dataset: Dataset, model: ModelSpec) {
  return model.dataset_formats.some((format) =>
    dataset.formats?.includes(format),
  );
}

const paddleOcrSetupParamKeys = new Set(["config_path", "pretrained_model"]);

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
  value,
  onChange,
}: {
  spec: ParamSpec;
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
              {spec.description}
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
            {spec.description}
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
          {spec.description}
        </p>
      )}
    </div>
  );
}

export default function ConfigPage() {
  const router = useRouter();
  const { config, updateConfig, updateParam, setTaskModel, resetConfig } =
    useTrainingConfig();
  const [catalog, setCatalog] = useState<CVCatalog>(fallbackCatalog);
  const [catalogSource, setCatalogSource] = useState<"backend" | "fallback">(
    "backend",
  );
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetError, setDatasetError] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [deviceTouched, setDeviceTouched] = useState(false);

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
          "Datasets unavailable. Upload or refresh datasets after the backend is reachable.",
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
    if (deviceOptions.length === 0) return;
    const preferredDevice = String(deviceSpec?.default ?? deviceOptions[0].value);
    const currentDeviceAvailable = deviceOptions.some(
      (option) => option.value === config.device,
    );
    const shouldPreferGpuDefault =
      !deviceTouched && preferredDevice !== "cpu" && config.device === "cpu";

    if (!currentDeviceAvailable || shouldPreferGpuDefault) {
      updateConfig("device", preferredDevice);
    }
  }, [config.device, deviceOptions, deviceSpec?.default, deviceTouched, updateConfig]);

  const compatibleDatasets = useMemo(
    () =>
      datasets.filter((dataset) =>
        isDatasetCompatible(dataset, selectedModel),
      ),
    [datasets, selectedModel],
  );
  const selectedDataset = compatibleDatasets.find(
    (dataset) => dataset.name === config.datasetName,
  );
  const datasetFormatLabel = selectedModel.dataset_formats.join(" or ");
  const emptyDatasetMessage =
    datasets.length === 0
      ? "No datasets uploaded yet. Upload a dataset before starting a run."
      : `No dataset matches ${selectedModel.label}. Upload a dataset with ${datasetFormatLabel}.`;

  const commonSpecs = useMemo(() => catalog.common_params, [catalog]);
  const modelSpecs = selectedModel.params;
  const visibleModelSpecs =
    selectedModel.id === "paddleocr"
      ? modelSpecs.filter((spec) => !paddleOcrSetupParamKeys.has(spec.key))
      : modelSpecs;

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
      setDeviceTouched(true);
      updateConfig("device", String(value));
    }
    if (spec.key === "workers") updateConfig("workers", Number(value));
    if (spec.key === "amp") updateConfig("amp", Boolean(value));
    if (spec.key === "seed") updateConfig("seed", Number(value));
  };

  const saveConfig = () => {
    setSaveStatus("saving");
    setTimeout(() => {
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 1600);
    }, 250);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Configuration"
          title="Model Configuration"
          description="Choose a task, model family, dataset, and trainer parameters before opening the training monitor."
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  resetConfig();
                  setDeviceTouched(false);
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={saveConfig}
                disabled={saveStatus === "saving"}
              >
                {saveStatus === "saved" ? (
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saveStatus === "saved" ? "Saved" : "Save draft"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/guide")}
              >
                <BookOpenCheck className="h-4 w-4" />
                Guide
              </Button>
              <Button size="sm" onClick={() => router.push("/training")}>
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

        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <aside className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Task
                </CardTitle>
                <CardDescription>
                  Pick the workflow family that owns the trainer.
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
                  Only datasets matching the selected model format are shown.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase text-muted-foreground">
                    Required format
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedModel.dataset_formats.map((format) => (
                      <Badge variant="secondary" key={format}>
                        {format}
                      </Badge>
                    ))}
                  </div>
                </div>
                {compatibleDatasets.length > 0 ? (
                  <Select
                    value={config.datasetName}
                    onValueChange={(value) => updateConfig("datasetName", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select dataset" />
                    </SelectTrigger>
                    <SelectContent>
                      {compatibleDatasets.map((dataset) => (
                        <SelectItem key={dataset.id} value={dataset.name}>
                          {dataset.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex min-h-12 items-center rounded-lg border border-dashed border-border bg-background/70 px-3 text-sm text-muted-foreground">
                    No compatible dataset
                  </div>
                )}

                <div className="space-y-2">
                  {compatibleDatasets.map((dataset) => (
                    <div
                      key={dataset.id}
                      className="rounded-lg border border-border bg-background/70 p-3 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="break-words font-medium">{dataset.name}</span>
                        <div className="flex shrink-0 items-center gap-2">
                          {selectedDataset?.name === dataset.name && (
                            <StatusBadge tone="success">Selected</StatusBadge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {dataset.size}
                          </span>
                        </div>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        {dataset.images.toLocaleString()} images -{" "}
                        {dataset.formats.join(", ")}
                      </p>
                    </div>
                  ))}
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

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Model
                </CardTitle>
                <CardDescription>{selectedTask.description}</CardDescription>
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
                        {model.reason}
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
                  Shared values sent to every trainer in the training payload.
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
                    value={commonValue(spec)}
                    onChange={(value) => handleCommonParam(spec, value)}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{selectedModel.label} Parameters</CardTitle>
                <CardDescription>
                  Model-specific options are passed in `params` to `/api/train`.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {selectedModel.id === "paddleocr" && (
                  <PaddleOcrSetup
                    params={config.params}
                    onParamChange={updateParam}
                  />
                )}
                <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {visibleModelSpecs.map((spec) => (
                    <ParamInput
                      key={spec.key}
                      spec={spec}
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
