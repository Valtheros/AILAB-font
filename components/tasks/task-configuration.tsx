"use client";

import { useEffect, useMemo, useState } from "react";
import { Activity, Boxes, CheckCircle, Cpu, Database, Loader2, Play, Save, Settings, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/workspace/status-badge";
import { useLanguage } from "@/components/language-provider";
import { apiBaseUrl } from "@/lib/api";
import { CVCatalog, ModelSpec, ParamSpec, catalogPlaceholder, modelDefaults, getModel, getTask } from "@/lib/cvCatalog";
import { memorySafetyForModel, safeDefaultEntries } from "@/lib/resourceSafety";
import { ConfigValue, TrainingConfig } from "@/lib/trainingConfig";

const API_URL = apiBaseUrl();

interface ResourcePlanPreview {
  estimatedVramMb: number;
  safeLimitMb: number;
  isWithinLimit: boolean;
  device?: string;
}

interface Dataset {
  id: string; name: string; images: number; size: string; formats: string[]; tasks: string[];
  datasetTask?: string; canonicalTask?: string; canonicalFormat?: string;
  compatibleModels?: Array<{ id: string; ready: boolean }>;
}

const taskIcons: Record<string, typeof Activity> = { image_classification: Cpu, segmentation: Boxes, object_detection: Activity };

function compatible(dataset: Dataset, model: ModelSpec, taskId: string) {
  const match = dataset.compatibleModels?.find((item) => item.id === model.id);
  return match ? match.ready : model.dataset_formats.some((format) => dataset.formats?.includes(format)) && dataset.tasks?.includes(taskId);
}

function coerce(spec: ParamSpec, raw: string | boolean): ConfigValue {
  if (spec.type === "boolean") return Boolean(raw);
  if (spec.type === "number") {
    const value = Number(raw);
    return Number.isFinite(value) ? value : Number(spec.default);
  }
  return String(raw);
}

function ParamInput({ spec, value, onChange }: { spec: ParamSpec; value: ConfigValue; onChange: (value: ConfigValue) => void }) {
  const { t } = useLanguage();
  if (spec.type === "boolean") return (
    <div className="flex min-h-24 items-center justify-between rounded-md border p-4">
      <div className="pr-4"><Label>{spec.label}</Label>{spec.description && <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(spec.description)}</p>}</div>
      <Switch checked={Boolean(value)} onCheckedChange={onChange} />
    </div>
  );
  if (spec.type === "select") return (
    <div className="space-y-2"><Label>{spec.label}</Label>
      <Select value={String(value ?? spec.default)} onValueChange={onChange}><SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{spec.options?.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>{spec.description && <p className="text-xs leading-5 text-muted-foreground">{t(spec.description)}</p>}
    </div>
  );
  return (
    <div className="space-y-2"><Label>{spec.label}</Label>
      <Input type={spec.type === "number" ? "number" : "text"} value={String(value ?? spec.default)} min={spec.min} max={spec.max} step={spec.step} onChange={(event) => onChange(coerce(spec, event.target.value))} />
      {spec.description && <p className="text-xs leading-5 text-muted-foreground">{t(spec.description)}</p>}
    </div>
  );
}

export function TaskConfiguration({ config, onChange, onSave, onTrain, saveState, starting }: {
  config: TrainingConfig;
  onChange: (next: TrainingConfig, persist?: boolean) => void;
  onSave: () => Promise<void>;
  onTrain: () => void;
  saveState: "unsaved" | "saved" | "saving" | "error";
  starting: boolean;
}) {
  const { t } = useLanguage();
  const [catalog, setCatalog] = useState<CVCatalog>(catalogPlaceholder);
  const [catalogStatus, setCatalogStatus] = useState<"loading" | "ready" | "error">("loading");
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [datasetError, setDatasetError] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${API_URL}/api/model-catalog`).then((response) => { if (!response.ok) throw new Error(); return response.json(); }),
      fetch(`${API_URL}/api/datasets`).then((response) => { if (!response.ok) throw new Error(); return response.json(); }),
    ]).then(([nextCatalog, nextDatasets]) => {
      setCatalog(nextCatalog); setDatasets(nextDatasets.datasets ?? []); setCatalogStatus("ready");
    }).catch(() => { setCatalogStatus("error"); setDatasetError("Backend data is unavailable."); });
  }, []);

  const selectedTask = getTask(catalog, config.taskType);
  const selectedModel = getModel(catalog, selectedTask.id, config.modelType);
  const deviceSpec = catalog.common_params.find((spec) => spec.key === "device");
  const deviceOptions = deviceSpec?.options ?? [];

  useEffect(() => {
    if (catalogStatus !== "ready") return;
    if (config.taskType !== selectedTask.id || config.modelType !== selectedModel.id) {
      const defaults = modelDefaults(selectedModel, catalog.common_params);
      onChange({ ...config, taskType: selectedTask.id, modelType: selectedModel.id, modelName: selectedModel.model_name, datasetName: "", params: defaults.params, batchSize: defaults.batchSize, workers: defaults.workers, amp: defaults.amp }, false);
    }
  }, [catalogStatus, selectedModel, selectedTask.id]);

  useEffect(() => {
    if (catalogStatus !== "ready" || deviceOptions.length === 0) return;
    const preferred = String(deviceSpec?.default ?? deviceOptions[0].value);
    const available = deviceOptions.some((option) => option.value === config.device);
    if (!available || (config.deviceSelection === "auto" && config.device === "cpu" && preferred !== "cpu")) {
      onChange({ ...config, device: preferred, deviceSelection: "auto", params: { ...config.params, device: preferred } }, false);
    }
  }, [catalogStatus, deviceOptions.length]);

  const update = <K extends keyof TrainingConfig>(key: K, value: TrainingConfig[K]) => onChange({ ...config, [key]: value });
  const updateParam = (key: string, value: ConfigValue) => onChange({ ...config, params: { ...config.params, [key]: value } });
  const datasetsForModel = useMemo(() => datasets.filter((dataset) => compatible(dataset, selectedModel, selectedTask.id)), [datasets, selectedModel, selectedTask.id]);
  const memory = useMemo(() => memorySafetyForModel(selectedModel, config), [config, selectedModel]);

  // Backend estimate from resource_guard.py. The badges above are the client
  // heuristic; this line shows the numbers the server actually decides with.
  const [vram, setVram] = useState<ResourcePlanPreview | null>(null);
  useEffect(() => {
    if (catalogStatus !== "ready") return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${API_URL}/api/resource-plan/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_type: config.modelType,
          batch_size: config.batchSize,
          params: { ...config.params, device: config.device },
        }),
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => setVram(data))
        .catch(() => undefined);
    }, 400);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [catalogStatus, config.modelType, config.batchSize, config.device, config.params]);

  const chooseTask = (taskId: string) => {
    const task = getTask(catalog, taskId); const model = task.models[0];
    const defaults = modelDefaults(model, catalog.common_params);
    onChange({ ...config, taskType: task.id, modelType: model.id, modelName: model.model_name, datasetName: "", params: defaults.params, batchSize: defaults.batchSize, workers: defaults.workers, amp: defaults.amp });
  };
  const chooseModel = (model: ModelSpec) => {
    const defaults = modelDefaults(model, catalog.common_params);
    onChange({ ...config, modelType: model.id, modelName: model.model_name, datasetName: "", params: { ...defaults.params, device: config.device }, batchSize: defaults.batchSize, workers: defaults.workers, amp: defaults.amp });
  };
  const commonValue = (spec: ParamSpec) => ({ epochs: config.epochs, batch_size: config.batchSize, device: config.device, workers: config.workers, amp: config.amp, seed: config.seed } as Record<string, ConfigValue>)[spec.key] ?? config.params[spec.key] ?? spec.default;
  const updateCommon = (spec: ParamSpec, value: ConfigValue) => {
    const next = { ...config, params: { ...config.params, [spec.key]: value } };
    if (spec.key === "epochs") next.epochs = Number(value);
    if (spec.key === "batch_size") next.batchSize = Number(value);
    if (spec.key === "device") { next.device = String(value); next.deviceSelection = "manual"; }
    if (spec.key === "workers") next.workers = Number(value);
    if (spec.key === "amp") next.amp = Boolean(value);
    if (spec.key === "seed") next.seed = Number(value);
    onChange(next);
  };

  if (catalogStatus !== "ready") return (
    <Card><CardContent className="flex min-h-48 items-center justify-center gap-2 text-muted-foreground">
      {catalogStatus === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <TriangleAlert className="h-5 w-5" />}
      {catalogStatus === "loading" ? "Loading configuration..." : "Model catalog unavailable"}
    </CardContent></Card>
  );

  return <div className="mx-auto max-w-5xl space-y-4">
    <div className="flex justify-end"><StatusBadge tone={saveState === "error" ? "warning" : "neutral"}>{saveState === "unsaved" ? "Unsaved" : saveState === "saving" ? "Saving..." : saveState === "error" ? "Save failed" : "Saved"}</StatusBadge></div>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Task</CardTitle><CardDescription>{t("config.task.description")}</CardDescription></CardHeader>
      <CardContent className="grid gap-2 md:grid-cols-3">{catalog.tasks.map((task) => { const Icon = taskIcons[task.id] ?? Activity; const active = task.id === selectedTask.id; return <button key={task.id} onClick={() => chooseTask(task.id)} className={`rounded-md border p-4 text-left ${active ? "border-foreground bg-foreground text-background" : "hover:bg-accent"}`}><Icon className="mb-3 h-5 w-5" /><p className="font-medium">{task.label}</p><p className={`text-xs ${active ? "text-background/70" : "text-muted-foreground"}`}>{task.models.length} models</p></button>; })}</CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Cpu className="h-5 w-5" />Model</CardTitle><CardDescription>{t(selectedTask.description)}</CardDescription></CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">{selectedTask.models.map((model) => { const active = model.id === selectedModel.id; return <button key={model.id} onClick={() => chooseModel(model)} className={`rounded-md border p-4 text-left ${active ? "border-foreground bg-foreground text-background" : "hover:bg-accent"}`}><div className="flex justify-between"><p className="font-semibold">{model.label}</p>{active && <CheckCircle className="h-5 w-5" />}</div><p className={`mt-2 text-sm leading-6 ${active ? "text-background/80" : "text-muted-foreground"}`}>{t(model.reason)}</p></button>; })}</CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="flex items-center gap-2"><Database className="h-5 w-5" />Dataset</CardTitle><CardDescription>{t("config.dataset.description")}</CardDescription></CardHeader>
      <CardContent className="space-y-2">{datasetError && <p className="text-sm text-destructive">{datasetError}</p>}{datasetsForModel.map((dataset) => { const active = dataset.name === config.datasetName; return <button key={dataset.id} onClick={() => update("datasetName", dataset.name)} className={`w-full rounded-md border p-4 text-left ${active ? "border-foreground bg-accent" : "hover:bg-accent/60"}`}><div className="flex flex-wrap justify-between gap-2"><span className="break-all font-medium">{dataset.name}</span>{active && <StatusBadge tone="success">Selected</StatusBadge>}</div><p className="mt-1 text-xs text-muted-foreground">{dataset.images.toLocaleString()} images - {dataset.canonicalTask ?? dataset.datasetTask ?? "dataset"} - {dataset.canonicalFormat ?? "source"}</p></button>; })}{datasetsForModel.length === 0 && <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{t("tasks.dataset.empty")}</p>}</CardContent>
    </Card>
    <Card><CardHeader><CardTitle>Run Settings</CardTitle><CardDescription>{t("config.run.description")}</CardDescription></CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"><div className="space-y-2"><Label>Project name</Label><Input value={config.projectName} onChange={(event) => update("projectName", event.target.value)} /></div>{catalog.common_params.map((spec) => <ParamInput key={spec.key} spec={spec} value={commonValue(spec)} onChange={(value) => updateCommon(spec, value)} />)}</CardContent>
    </Card>
    <Card><CardHeader><CardTitle>{selectedModel.label} Parameters</CardTitle><CardDescription>{t("config.params.description")}</CardDescription></CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{selectedModel.params.map((spec) => <ParamInput key={spec.key} spec={spec} value={config.params[spec.key] ?? spec.default} onChange={(value) => updateParam(spec.key, value)} />)}</CardContent>
    </Card>
    <Card><CardHeader><div className="flex flex-wrap justify-between gap-3"><div><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Memory Safety</CardTitle><CardDescription>{t("Helps prevent memory errors before training starts.")}</CardDescription></div><StatusBadge tone={memory.ok ? "success" : "warning"}>{memory.label}</StatusBadge></div></CardHeader>
      <CardContent className="space-y-4"><div className="flex flex-wrap gap-2">{memory.summary.map((item) => <Badge key={item} variant="secondary">{item}</Badge>)}</div>
        {vram && (
          <div className={`flex items-start gap-2 rounded-md border p-3 text-sm ${vram.isWithinLimit ? "border-emerald-500/40 bg-emerald-500/10" : "border-amber-500/40 bg-amber-500/10"}`}>
            <span aria-hidden="true">{vram.isWithinLimit ? "✅" : "⚠️"}</span>
            <p className="min-w-0">
              {t("config.vram.estimate")
                .replace("{estimated}", vram.estimatedVramMb.toLocaleString())
                .replace("{limit}", vram.safeLimitMb.toLocaleString())}
              {!vram.isWithinLimit && <span className="ml-1 font-medium">{t("config.vram.over")}</span>}
            </p>
          </div>
        )}{!memory.ok && <div className="rounded-md border border-amber-400/40 bg-amber-500/10 p-3 text-sm"><ul className="list-disc space-y-1 pl-5">{[...memory.issues, ...memory.suggestions].map((item) => <li key={item}>{t(item)}</li>)}</ul></div>}<Button variant="outline" onClick={() => { const next = { ...config, params: { ...config.params } }; for (const [key, value] of safeDefaultEntries(selectedModel)) { next.params[key] = value; if (key === "batch_size") next.batchSize = Number(value); if (key === "workers") next.workers = Number(value); if (key === "amp") next.amp = Boolean(value); } onChange(next); }}>Apply safe settings</Button></CardContent>
    </Card>
    <div className="flex flex-col justify-end gap-2 pb-8 sm:flex-row">
      <Button variant="outline" size="lg" onClick={() => void onSave().catch(() => undefined)} disabled={saveState === "saving" || saveState === "saved"}>
        {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save draft
      </Button>
      <Button size="lg" onClick={onTrain} disabled={starting || saveState !== "saved" || !config.datasetName || !memory.ok}>{starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Train</Button>
    </div>
  </div>;
}
