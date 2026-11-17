"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { appRequest } from "@/lib/model-apps";
import type { TrainingTask } from "@/lib/trainingConfig";
import { ModelApiPanel } from "./model-api-panel";
import { PublishForm } from "./publish-dialog";

export function RunSetup({ mode, thai, onDone }: { mode: "app" | "api"; thai: boolean; onDone: () => void }) {
  const [tasks, setTasks] = useState<TrainingTask[]>([]);
  const [selected, setSelected] = useState(""), [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    appRequest<{ tasks: TrainingTask[] }>("/api/tasks", thai, { signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) setTasks(data.tasks.filter(task => task.status === "completed" && task.runSlug));
      })
      .catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Request failed"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [thai, attempt]);

  const task = tasks.find(item => item.id === selected);
  const query = search.trim().toLocaleLowerCase();
  const matches = tasks.filter(item => item.id === selected || `${item.displayName} ${item.modelName} ${item.runSlug}`.toLocaleLowerCase().includes(query));
  const taskType = task?.modelType === "mask_rcnn" ? "instance_segmentation" : task?.modelType === "deeplabv3plus" ? "semantic_segmentation" : task?.taskType;

  if (loading) return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 motion-safe:animate-spin" />{thai ? "กำลังโหลดโมเดล" : "Loading models"}</p>;
  if (error) return <div className="space-y-3"><p role="alert" className="break-words text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => { setError(""); setLoading(true); setAttempt(value => value + 1); }}><RefreshCw className="h-4 w-4" />{thai ? "ลองใหม่" : "Retry"}</Button></div>;
  if (!tasks.length) return <p className="py-6 text-sm text-muted-foreground">{thai ? "ยังไม่มีงานที่เทรนสำเร็จ" : "No completed training runs yet."}</p>;
  return <div className="min-w-0 space-y-5">
    <div className="space-y-2">
      <label htmlFor={`${mode}-run-search`} className="text-sm font-medium">{thai ? "ค้นหาโมเดล" : "Search models"}</label>
      <Input id={`${mode}-run-search`} value={search} onChange={event => setSearch(event.target.value)} placeholder={thai ? "ชื่องานหรือโมเดล" : "Run or model name"} />
      <label id={`${mode}-run-label`} className="block pt-2 text-sm font-medium">{thai ? "งานที่เทรนสำเร็จ" : "Completed run"}</label>
      <Select value={selected} onValueChange={setSelected}>
        <SelectTrigger aria-labelledby={`${mode}-run-label`} className="w-full min-w-0 [&>span]:min-w-0 [&>span]:truncate [&>svg]:shrink-0"><SelectValue placeholder={thai ? "เลือกโมเดล" : "Select a model"} /></SelectTrigger>
        <SelectContent className="max-w-[calc(100vw-3rem)]">
          {matches.map(item => <SelectItem key={item.id} value={item.id} className="[&>span:last-child]:min-w-0 [&>span:last-child]:truncate">{item.displayName} · {item.modelName || item.modelType} · {item.runSlug}</SelectItem>)}
          {!matches.length && <p className="p-3 text-sm text-muted-foreground">{thai ? "ไม่พบโมเดล" : "No matching models"}</p>}
        </SelectContent>
      </Select>
    </div>
    {task?.runSlug && <div className="min-w-0 space-y-4 border-t pt-5">
      <p className="break-all text-xs text-muted-foreground">{task.runSlug}</p>
      {mode === "api" ? <ModelApiPanel runSlug={task.runSlug} /> : <PublishForm key={task.runSlug} runSlug={task.runSlug} taskType={taskType} thai={thai} onDone={onDone} />}
    </div>}
  </div>;
}
