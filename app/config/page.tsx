"use client";

import { MainLayout } from "@/components/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
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
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useRouter } from "next/navigation";
import {
  CVCatalog,
  ModelSpec,
  ParamSpec,
  defaultParamsFor,
  fallbackCatalog,
  getModel,
  getTask,
} from "@/lib/cvCatalog";
import { ConfigValue, useTrainingConfig } from "@/lib/useTrainingConfig";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  return model.dataset_formats.some((format) => dataset.formats?.includes(format));
}

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
      <div className="flex min-h-24 items-center justify-between rounded-lg border border-gray-200 p-4 dark:border-gray-800">
        <div className="pr-4">
          <Label>{spec.label}</Label>
          {spec.description && <p className="mt-1 text-xs text-gray-500">{spec.description}</p>}
        </div>
        <Switch checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />
      </div>
    );
  }

  if (spec.type === "select") {
    return (
      <div className="space-y-2">
        <Label>{spec.label}</Label>
        <Select value={String(value ?? spec.default)} onValueChange={(next) => onChange(next)}>
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
        {spec.description && <p className="text-xs text-gray-500">{spec.description}</p>}
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
      {spec.description && <p className="text-xs text-gray-500">{spec.description}</p>}
    </div>
  );
}

export default function ConfigPage() {
  const router = useRouter();
  const { config, updateConfig, updateParam, setTaskModel, resetConfig } = useTrainingConfig();
  const [catalog, setCatalog] = useState<CVCatalog>(fallbackCatalog);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    fetch(`${API_URL}/api/model-catalog`)
      .then((response) => (response.ok ? response.json() : fallbackCatalog))
      .then((data) => setCatalog(data))
      .catch(() => setCatalog(fallbackCatalog));

    fetch(`${API_URL}/api/datasets`)
      .then((response) => (response.ok ? response.json() : { datasets: [] }))
      .then((data) => setDatasets(data.datasets ?? []))
      .catch(() => setDatasets([]));
  }, []);

  const selectedTask = getTask(catalog, config.taskType);
  const selectedModel = getModel(catalog, selectedTask.id, config.modelType);
  const compatibleDatasets = datasets.filter((dataset) => isDatasetCompatible(dataset, selectedModel));

  const commonSpecs = useMemo(() => catalog.common_params, [catalog]);
  const modelSpecs = selectedModel.params;

  const handleTaskChange = (taskId: string) => {
    const task = getTask(catalog, taskId);
    const model = task.models[0];
    setTaskModel(task.id, model.id, model.model_name, defaultParamsFor(model, catalog.common_params));
  };

  const handleModelChange = (modelId: string) => {
    const model = selectedTask.models.find((item) => item.id === modelId) ?? selectedTask.models[0];
    setTaskModel(selectedTask.id, model.id, model.model_name, defaultParamsFor(model, catalog.common_params));
  };

  const handleCommonParam = (spec: ParamSpec, value: ConfigValue) => {
    updateParam(spec.key, value);
    if (spec.key === "epochs") updateConfig("epochs", Number(value));
    if (spec.key === "batch_size") updateConfig("batchSize", Number(value));
    if (spec.key === "device") updateConfig("device", String(value));
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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white sm:text-3xl">
              Model Configuration
            </h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Choose a computer vision task, model family, dataset, and tunable training parameters.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={resetConfig}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={saveConfig} disabled={saveStatus === "saving"}>
              {saveStatus === "saved" ? (
                <CheckCircle className="mr-2 h-4 w-4 text-green-500" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saveStatus === "saved" ? "Saved" : "Save"}
            </Button>
            <Button size="sm" onClick={() => router.push("/training")}>
              <Play className="mr-2 h-4 w-4" />
              Review Training
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[360px_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Task
                </CardTitle>
                <CardDescription>Backend catalog version: {catalog.version}</CardDescription>
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

                <div className="grid grid-cols-1 gap-3">
                  {catalog.tasks.map((task) => {
                    const Icon = taskIcons[task.id] ?? Activity;
                    const active = task.id === selectedTask.id;
                    return (
                      <button
                        key={task.id}
                        onClick={() => handleTaskChange(task.id)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          active
                            ? "border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-900"
                            : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{task.label}</p>
                            <p className="text-xs text-gray-500">{task.models.length} models</p>
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
                  Compatible formats: {selectedModel.dataset_formats.join(", ")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Select
                  value={config.datasetName || "none"}
                  onValueChange={(value) => updateConfig("datasetName", value === "none" ? "" : value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select dataset" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Use latest compatible dataset</SelectItem>
                    {compatibleDatasets.map((dataset) => (
                      <SelectItem key={dataset.id} value={dataset.name}>
                        {dataset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="space-y-2">
                  {compatibleDatasets.slice(0, 3).map((dataset) => (
                    <div key={dataset.id} className="rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-800">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-gray-900 dark:text-white">{dataset.name}</span>
                        <span className="text-xs text-gray-500">{dataset.size}</span>
                      </div>
                      <p className="mt-1 text-xs text-gray-500">
                        {dataset.images.toLocaleString()} images · {dataset.formats.join(", ")}
                      </p>
                    </div>
                  ))}
                  {compatibleDatasets.length === 0 && (
                    <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500 dark:border-gray-700">
                      No compatible dataset found yet. Upload one on the Dataset page or the backend will reject the job.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Model
                </CardTitle>
                <CardDescription>{selectedTask.description}</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {selectedTask.models.map((model) => {
                  const active = model.id === selectedModel.id;
                  return (
                    <button
                      key={model.id}
                      onClick={() => handleModelChange(model.id)}
                      className={`rounded-lg border p-4 text-left transition-colors ${
                        active
                          ? "border-gray-900 bg-gray-50 dark:border-white dark:bg-gray-900"
                          : "border-gray-200 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-900"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{model.label}</p>
                          <p className="mt-1 text-xs text-gray-500">{model.runtime}</p>
                        </div>
                        {active && <CheckCircle className="h-5 w-5 text-green-500" />}
                      </div>
                      <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{model.reason}</p>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Run Settings</CardTitle>
                <CardDescription>Shared parameters sent to every trainer.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <Label>Project name</Label>
                  <Input value={config.projectName} onChange={(event) => updateConfig("projectName", event.target.value)} />
                </div>
                {commonSpecs.map((spec) => (
                  <ParamInput
                    key={spec.key}
                    spec={spec}
                    value={config.params[spec.key] ?? spec.default}
                    onChange={(value) => handleCommonParam(spec, value)}
                  />
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{selectedModel.label} Parameters</CardTitle>
                <CardDescription>
                  These values are passed in `params` to `/api/train` for the selected trainer.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {modelSpecs.map((spec) => (
                  <ParamInput
                    key={spec.key}
                    spec={spec}
                    value={config.params[spec.key] ?? spec.default}
                    onChange={(value) => updateParam(spec.key, value)}
                  />
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
