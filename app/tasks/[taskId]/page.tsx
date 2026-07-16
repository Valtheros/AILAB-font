"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, TriangleAlert } from "lucide-react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/workspace/empty-state";
import { PageHeader } from "@/components/workspace/page-header";
import { TaskConfiguration } from "@/components/tasks/task-configuration";
import { TaskRun } from "@/components/tasks/task-run";
import { apiBaseUrl } from "@/lib/api";
import { defaultConfig, taskConfig, taskDraftPayload, type TrainingConfig, type TrainingTask } from "@/lib/trainingConfig";
import { useLanguage } from "@/components/language-provider";

const API_URL = apiBaseUrl();

export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const { t } = useLanguage();
  const [task, setTask] = useState<TrainingTask | null>(null);
  const [config, setConfig] = useState<TrainingConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saveState, setSaveState] = useState<"unsaved" | "saved" | "saving" | "error">(
    taskId === "new" ? "unsaved" : "saved",
  );
  const [starting, setStarting] = useState(false);
  const latestConfig = useRef<TrainingConfig | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const persistedTaskId = useRef<string | null>(taskId === "new" ? null : taskId);

  const load = useCallback(async () => {
    const id = persistedTaskId.current ?? taskId;
    if (id === "new") {
      const next = { ...defaultConfig, params: { ...defaultConfig.params } };
      latestConfig.current = next;
      setConfig(next);
      setTask(null);
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/api/tasks/${encodeURIComponent(id)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Task not found");
      setTask(data);
      if (data.status === "draft") {
        const next = taskConfig(data);
        latestConfig.current = next;
        setConfig(next);
      }
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load task");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (taskId !== "new") persistedTaskId.current = taskId;
  }, [taskId]);
  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const save = useCallback((next: TrainingConfig) => {
    setSaveState("saving");
    const request = async () => {
      let id = persistedTaskId.current;
      if (!id) {
        const createResponse = await fetch(`${API_URL}/api/tasks`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ display_name: next.projectName.trim() || "cv_run" }),
        });
        const created = await createResponse.json().catch(() => ({}));
        if (!createResponse.ok) throw new Error(created.detail || "Could not create task");
        if (typeof created.id !== "string" || !created.id) throw new Error("Task service returned an invalid task ID");
        id = created.id;
        persistedTaskId.current = id;
      }
      if (!id) throw new Error("Could not create task");
      const response = await fetch(`${API_URL}/api/tasks/${encodeURIComponent(id)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskDraftPayload(next)),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not save task");
      setTask(data);
      setSaveState("saved");
      if (taskId === "new") window.history.replaceState(window.history.state, "", `/tasks/${id}`);
    };
    saveChain.current = saveChain.current.catch(() => undefined).then(request).catch((caught) => {
      setSaveState("error");
      setError(caught instanceof Error ? caught.message : "Could not save task");
      throw caught;
    });
    return saveChain.current;
  }, [taskId]);

  const changeConfig = (next: TrainingConfig, persist = true) => {
    setConfig(next); latestConfig.current = next; setError("");
    if (!persist) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { saveTimer.current = null; void save(next).catch(() => undefined); }, 500);
  };

  const train = async () => {
    const current = latestConfig.current;
    if (!current) return;
    setStarting(true); setError("");
    try {
      if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; }
      await save(current);
      const id = persistedTaskId.current;
      if (!id) throw new Error("Could not create task");
      const response = await fetch(`${API_URL}/api/tasks/${encodeURIComponent(id)}/start`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || "Could not start training");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not start training");
    } finally {
      setStarting(false);
    }
  };

  return <MainLayout><div className="space-y-6">
    <PageHeader title={task?.displayName || (taskId === "new" ? "New Training Task" : "Training Task")} description={t(!task || task.status === "draft" ? "tasks.draft.description" : "tasks.run.description")} actions={<Button asChild variant="outline" size="sm"><Link href="/tasks"><ArrowLeft className="h-4 w-4" />Tasks</Link></Button>} />
    {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
    {loading ? <EmptyState icon={Loader2} title="Loading task" description="Reading the latest task state." />
      : taskId !== "new" && !task ? <EmptyState icon={TriangleAlert} title="Task unavailable" description="This task does not exist or belongs to another user." />
      : (!task || task.status === "draft") && config ? <TaskConfiguration config={config} onChange={changeConfig} onTrain={train} saveState={saveState} starting={starting} />
      : task ? <TaskRun task={task} onRefresh={load} /> : null}
  </div></MainLayout>;
}
