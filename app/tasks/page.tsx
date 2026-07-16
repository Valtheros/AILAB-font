"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronDown, Clock3, Cpu, Database, Loader2, Plus, Trash2 } from "lucide-react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/workspace/empty-state";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge, type StatusTone } from "@/components/workspace/status-badge";
import { apiBaseUrl } from "@/lib/api";
import type { TrainingTask } from "@/lib/trainingConfig";
import { useLanguage } from "@/components/language-provider";

const API_URL = apiBaseUrl();
const ACTIVE = new Set(["queued", "running", "started", "stopping", "recovery_pending"]);

function tone(status: string): StatusTone {
  if (["completed", "exited"].includes(status)) return "success";
  if (ACTIVE.has(status)) return "warning";
  if (status === "failed") return "danger";
  return "neutral";
}

function TaskCard({ task, onDelete, compact = false }: { task: TrainingTask; onDelete: () => void; compact?: boolean }) {
  const router = useRouter();
  const updated = task.updatedAt ? new Date(task.updatedAt).toLocaleString() : "-";
  return (
    <Card className="min-w-0 cursor-pointer overflow-hidden transition-colors hover:border-foreground/40 hover:bg-accent/30" onClick={() => router.push(`/tasks/${task.id}`)}>
      <CardHeader className={compact ? "gap-2 p-4" : "gap-4"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="break-words text-lg">{task.displayName}</CardTitle>
            <CardDescription className="mt-1 capitalize">{task.taskType.replaceAll("_", " ")}</CardDescription>
          </div>
          <StatusBadge className="shrink-0" tone={tone(task.status)}>{task.status}</StatusBadge>
        </div>
      </CardHeader>
      <CardContent className={compact ? "space-y-3 p-4 pt-0" : "space-y-4"}>
        <div className={`grid ${compact ? "grid-cols-2 gap-2" : "gap-3 sm:grid-cols-2"}`}>
          <div className="min-w-0 rounded-md border bg-background/70 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Cpu className="h-3.5 w-3.5" />Model</div>
            <p className="mt-1 break-all text-sm font-semibold">{task.modelName || task.modelType}</p>
          </div>
          <div className="min-w-0 rounded-md border bg-background/70 p-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Database className="h-3.5 w-3.5" />Dataset</div>
            <p className="mt-1 truncate text-sm font-semibold" title={task.datasetName || "No dataset selected"}>{task.datasetName || "Not selected"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-4">
            <span>{task.epochs} epochs</span>
            <span className="flex items-center gap-1.5"><CalendarClock className="h-3.5 w-3.5" />{updated}</span>
          </div>
          {!ACTIVE.has(task.status) && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${task.displayName}`}
            onClick={(event) => { event.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function TasksPage() {
  const { t } = useLanguage();
  const router = useRouter();
  const [tasks, setTasks] = useState<TrainingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTask, setDeleteTask] = useState<TrainingTask | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/tasks`, { cache: "no-store" });
      if (!response.ok) throw new Error("Task service is unavailable");
      const data = await response.json();
      setTasks(data.tasks ?? []);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load tasks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const groups = useMemo(() => ({
    Drafts: tasks.filter((task) => task.status === "draft"),
    Active: tasks.filter((task) => ACTIVE.has(task.status)),
    History: tasks.filter((task) => task.status !== "draft" && !ACTIVE.has(task.status)),
  }), [tasks]);

  const confirmDelete = async () => {
    if (!deleteTask) return;
    const response = await fetch(`${API_URL}/api/tasks/${deleteTask.id}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.detail || "Could not delete task");
    } else {
      setTasks((current) => current.filter((task) => task.id !== deleteTask.id));
    }
    setDeleteTask(null);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader title="Tasks" description={t("tasks.header.description")} actions={
          <Button onClick={() => router.push("/tasks/new")}>
            <Plus className="h-4 w-4" />
            Add Task
          </Button>
        } />
        {error && <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}
        {loading ? (
          <EmptyState icon={Loader2} title="Loading tasks" description={t("tasks.loading.description")} />
        ) : tasks.length === 0 ? (
          <EmptyState icon={Clock3} title="No tasks yet" description={t("tasks.empty.description")} />
        ) : <>
          {Object.entries({ Drafts: groups.Drafts, Active: groups.Active }).map(([label, items]) => items.length > 0 && (
          <section key={label} className="space-y-3">
            <h2 className="text-lg font-semibold">{label}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {items.map((task) => <TaskCard key={task.id} task={task} onDelete={() => setDeleteTask(task)} />)}
            </div>
          </section>
          ))}
          {groups.History.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-1">
                <h2 className="text-lg font-semibold">History ({groups.History.length})</h2>
                {groups.History.length > 3 && <Button className="h-8 w-8" variant="ghost" size="icon" aria-label="View all history" title="View all history" onClick={() => setShowHistory(true)}><ChevronDown className="h-5 w-5" /></Button>}
              </div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groups.History.slice(0, 3).map((task) => <TaskCard key={task.id} task={task} onDelete={() => setDeleteTask(task)} />)}
              </div>
            </section>
          )}
        </>}
      </div>
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="bottom-0 left-0 right-0 top-auto flex max-h-[92dvh] w-full max-w-none translate-x-0 translate-y-0 flex-col rounded-b-none p-4 sm:bottom-auto sm:left-1/2 sm:right-auto sm:top-1/2 sm:w-[calc(100%-2rem)] sm:max-w-5xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-lg sm:p-6">
          <DialogHeader className="shrink-0 text-left">
            <DialogTitle>Task History</DialogTitle>
            <DialogDescription>{groups.History.length} completed or failed tasks</DialogDescription>
          </DialogHeader>
          <div className="grid min-h-0 min-w-0 flex-1 auto-rows-max content-start gap-3 overflow-x-hidden overflow-y-auto pr-1 md:grid-cols-2">
            {groups.History.map((task) => <TaskCard compact key={task.id} task={task} onDelete={() => { setShowHistory(false); setDeleteTask(task); }} />)}
          </div>
        </DialogContent>
      </Dialog>
      <AlertDialog open={Boolean(deleteTask)} onOpenChange={(open) => !open && setDeleteTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete task?</AlertDialogTitle>
            <AlertDialogDescription>This removes {deleteTask?.displayName} and its stored results. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
