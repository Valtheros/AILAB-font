"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, ImagePlus, LoaderCircle, Plus, RotateCcw, Square, Trash2, X } from "lucide-react";
import { MainLayout } from "@/components/MainLayout";
import { useLanguage } from "@/components/language-provider";
import { EmptyState } from "@/components/workspace/empty-state";
import { PageHeader } from "@/components/workspace/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiBaseUrl } from "@/lib/api";
import {
  apiError,
  CLASS_COLORS,
  type AnnotationClass,
  type AnnotationOperation,
  type AnnotationProject,
  type AnnotationTaskType,
  TASK_OPTIONS,
  taskLabel,
} from "@/lib/annotation";

const API_URL = apiBaseUrl();

function newClass(index: number): AnnotationClass {
  return {
    id: `${Date.now()}-${index}-${Math.random()}`,
    name: "",
    color: CLASS_COLORS[index % CLASS_COLORS.length],
  };
}

function uploadProject(data: FormData, onProgress: (value: number) => void) {
  return new Promise<{ project: AnnotationProject; operation: AnnotationOperation }>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_URL}/api/annotation-projects`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded * 100 / event.total));
    };
    request.onerror = () => reject(new Error("Upload connection failed"));
    request.onload = () => {
      let body: { project?: AnnotationProject; operation?: AnnotationOperation; detail?: unknown } = {};
      try { body = JSON.parse(request.responseText); } catch { /* handled below */ }
      if (request.status >= 200 && request.status < 300 && body.project && body.operation) {
        resolve({ project: body.project, operation: body.operation });
      } else {
        reject(new Error(typeof body.detail === "string" ? body.detail : `Request failed (${request.status})`));
      }
    };
    request.send(data);
  });
}

export default function AnnotatePage() {
  const { t } = useLanguage();
  const [projects, setProjects] = useState<AnnotationProject[]>([]);
  const [operations, setOperations] = useState<AnnotationOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [name, setName] = useState("");
  const [taskType, setTaskType] = useState<AnnotationTaskType>("object_detection");
  const [classes, setClasses] = useState<AnnotationClass[]>([newClass(0), newClass(1)]);
  const [ratios, setRatios] = useState({ train: 80, val: 10, test: 10 });
  const [file, setFile] = useState<File | null>(null);
  const [deleteProject, setDeleteProject] = useState<AnnotationProject | null>(null);

  const loadProjects = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/annotation-projects`, { cache: "no-store" });
      if (!response.ok) throw new Error(await apiError(response));
      const body = await response.json() as {
        projects: AnnotationProject[];
        operations: AnnotationOperation[];
      };
      setProjects(body.projects ?? []);
      setOperations(body.operations ?? []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load annotation projects");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => { void loadProjects(); }, [loadProjects]);
  useEffect(() => {
    if (!operations.some((item) => item.status === "queued" || item.status === "running")) return;
    const timer = window.setInterval(() => void loadProjects(true), 1500);
    return () => window.clearInterval(timer);
  }, [loadProjects, operations]);

  const ratioTotal = ratios.train + ratios.val + ratios.test;
  const validClasses = classes.filter((item) => item.name.trim());
  const canCreate = Boolean(
    name.trim() && file && ratioTotal === 100
    && validClasses.length === classes.length
    && (taskType !== "image_classification" || classes.length >= 2)
  );

  const resetForm = () => {
    setName("");
    setTaskType("object_detection");
    setClasses([newClass(0), newClass(1)]);
    setRatios({ train: 80, val: 10, test: 10 });
    setFile(null);
    setUploadProgress(0);
    setError("");
  };

  const createProject = async () => {
    if (!canCreate || !file) return;
    setSubmitting(true);
    setUploadProgress(0);
    setError("");
    const data = new FormData();
    data.append("file", file);
    data.append("name", name.trim());
    data.append("taskType", taskType);
    data.append("classes", JSON.stringify(classes.map((item) => ({ ...item, name: item.name.trim() }))));
    data.append("trainRatio", String(ratios.train));
    data.append("valRatio", String(ratios.val));
    data.append("testRatio", String(ratios.test));
    try {
      const body = await uploadProject(data, setUploadProgress);
      setProjects((current) => [body.project, ...current]);
      setOperations((current) => [body.operation, ...current]);
      setCreateOpen(false);
      resetForm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not create annotation project");
    } finally {
      setSubmitting(false);
    }
  };

  const operate = async (operation: AnnotationOperation, action: "retry" | "cancel") => {
    try {
      const response = await fetch(
        `${API_URL}/api/annotation-operations/${operation.id}/${action}`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(await apiError(response));
      const body = await response.json() as { operation: AnnotationOperation };
      setOperations((items) => items.map((item) => item.id === operation.id ? body.operation : item));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not ${action} operation`);
    }
  };

  const removeProject = async () => {
    if (!deleteProject) return;
    try {
      const response = await fetch(`${API_URL}/api/annotation-projects/${deleteProject.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await apiError(response));
      setProjects((current) => current.filter((project) => project.id !== deleteProject.id));
      setDeleteProject(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete annotation project");
    }
  };

  const taskDetail = useMemo(
    () => TASK_OPTIONS.find((item) => item.id === taskType)?.detail ?? "",
    [taskType],
  );

  return (
    <MainLayout>
      <div className="mx-auto max-w-7xl space-y-6">
        <PageHeader
          title="Annotate"
          description={t("Turn raw images into train-ready AILAB datasets without leaving your account.")}
          actions={<Button onClick={() => { resetForm(); setCreateOpen(true); }}><Plus />New project</Button>}
        />

        {error && !createOpen && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-56 animate-pulse rounded-lg border bg-muted/40" />)}
          </div>
        ) : projects.length === 0 ? (
          <EmptyState
            icon={ImagePlus}
            title="No annotation projects"
            description={t("Upload a ZIP of raw images, define classes, and start labeling.")}
            actions={<Button onClick={() => setCreateOpen(true)}><Plus />New project</Button>}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => {
              const operation = operations.find((item) => item.project_id === project.id);
              const progress = project.image_count
                ? project.completed_count / project.image_count * 100
                : operation?.progress ?? 0;
              const busy = operation?.status === "queued" || operation?.status === "running";
              return (
                <Card key={project.id} className="overflow-hidden">
                  <CardHeader className="gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate">{project.name}</CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">{taskLabel(project.task_type)}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={operation?.status === "failed" ? "border-destructive/50 text-destructive" : undefined}
                      >
                        {operation?.status ?? project.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="mb-2 flex justify-between gap-3 text-sm">
                        <span>
                          {busy
                            ? `${operation.kind === "import" ? "Importing" : "Publishing"} ${operation.processed_count}/${operation.total_count || "?"}`
                            : `${project.completed_count} of ${project.image_count} ready`}
                        </span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} />
                    </div>
                    {operation?.error_detail && (
                      <p className="line-clamp-2 text-sm text-destructive">{operation.error_detail}</p>
                    )}
                    {operation?.result.skipped ? (
                      <p className="text-sm text-muted-foreground">
                        Imported {operation.result.imported}; skipped {operation.result.skipped}.
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-1.5">
                      {project.classes.slice(0, 4).map((item) => (
                        <Badge key={item.id} variant="secondary">
                          <span className="mr-1.5 size-2 rounded-sm" style={{ backgroundColor: item.color }} />
                          {item.name}
                        </Badge>
                      ))}
                      {project.classes.length > 4 && <Badge variant="secondary">+{project.classes.length - 4}</Badge>}
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t pt-4">
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        aria-label={`Delete ${project.name}`}
                        onClick={() => setDeleteProject(project)}
                      >
                        <Trash2 />
                      </Button>
                      <div className="flex gap-2">
                        {operation?.status === "failed" || operation?.status === "cancelled" ? (
                          <Button variant="outline" onClick={() => void operate(operation, "retry")}><RotateCcw />Retry</Button>
                        ) : busy ? (
                          <Button variant="outline" onClick={() => void operate(operation, "cancel")}><Square />Cancel</Button>
                        ) : null}
                        <Button asChild disabled={project.image_count === 0}>
                          <Link
                            href={project.image_count ? `/annotate/${project.id}` : "#"}
                            aria-disabled={project.image_count === 0}
                          >
                            Open <ArrowRight />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={(open) => !submitting && setCreateOpen(open)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New annotation project</DialogTitle>
            <DialogDescription>{t("Upload raw images only. Labels created here will become a versioned AILAB dataset.")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 py-2">
            <div className="grid gap-2">
              <Label htmlFor="project-name">Project name</Label>
              <Input id="project-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Road damage labels" />
            </div>
            <div className="grid gap-2">
              <Label>Task</Label>
              <Select value={taskType} onValueChange={(value) => setTaskType(value as AnnotationTaskType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_OPTIONS.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">{t(taskDetail)}</p>
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Classes</Label>
                <Button variant="outline" size="sm" onClick={() => setClasses((current) => [...current, newClass(current.length)])}><Plus />Add class</Button>
              </div>
              {classes.map((item, index) => (
                <div key={item.id} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={item.color}
                    onChange={(event) => setClasses((current) => current.map((entry) => entry.id === item.id ? { ...entry, color: event.target.value as AnnotationClass["color"] } : entry))}
                    className="h-9 w-10 rounded border bg-transparent p-1"
                    aria-label={`Color for class ${index + 1}`}
                  />
                  <Input
                    value={item.name}
                    onChange={(event) => setClasses((current) => current.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry))}
                    placeholder={`Class ${index + 1}`}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={classes.length <= 1 || (taskType === "image_classification" && classes.length <= 2)}
                    onClick={() => setClasses((current) => current.filter((entry) => entry.id !== item.id))}
                    aria-label="Remove class"
                  >
                    <X />
                  </Button>
                </div>
              ))}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="image-zip">Image ZIP</Label>
              <Input id="image-zip" type="file" accept=".zip,application/zip" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
              <p className="text-sm text-muted-foreground">{t("JPEG, PNG, and WebP files are detected recursively. Maximum ZIP size follows the existing 2 GB upload limit.")}</p>
            </div>
            <div className="grid gap-3">
              <Label>Dataset split</Label>
              <div className="grid grid-cols-3 gap-3">
                {(["train", "val", "test"] as const).map((key) => (
                  <div key={key}>
                    <Label htmlFor={`ratio-${key}`} className="capitalize text-xs text-muted-foreground">{key} %</Label>
                    <Input
                      id={`ratio-${key}`}
                      type="number"
                      min={key === "train" ? 1 : 0}
                      max="100"
                      value={ratios[key]}
                      onChange={(event) => setRatios((current) => ({ ...current, [key]: Number(event.target.value) }))}
                    />
                  </div>
                ))}
              </div>
              <p className={ratioTotal === 100 ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>Total: {ratioTotal}%</p>
            </div>
            {submitting && (
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2"><LoaderCircle className="size-4 animate-spin" />Uploading ZIP</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}
            {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={createProject} disabled={!canCreate || submitting}>
              {submitting ? "Uploading..." : "Create project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteProject)} onOpenChange={(open) => !open && setDeleteProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete annotation project?</DialogTitle>
            <DialogDescription>{t("This removes the raw project and draft labels. Dataset versions already published remain available.")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProject(null)}>Cancel</Button>
            <Button variant="destructive" onClick={removeProject}>Delete project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
