"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, LoaderCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { appRequest } from "@/lib/model-apps";
import type { TrainingTask } from "@/lib/trainingConfig";
import { ModelApiPanel } from "./model-api-panel";
import { PublishForm } from "./publish-dialog";

const SEARCH_DELAY_MS = 250;

export function RunSetup({ mode, thai, onDone }: { mode: "app" | "api"; thai: boolean; onDone: () => void }) {
  const [tasks, setTasks] = useState<TrainingTask[]>([]);
  const [selected, setSelected] = useState(""), [search, setSearch] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
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

  const query = search.trim().toLocaleLowerCase();
  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query), SEARCH_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  const task = tasks.find(item => item.id === selected);
  const searching = query !== debouncedQuery;
  const matches = useMemo(() => debouncedQuery ? tasks.filter(item => (
    `${item.displayName} ${item.modelName || item.modelType} ${item.runSlug}`.toLocaleLowerCase().includes(debouncedQuery)
  )) : tasks, [tasks, debouncedQuery]);
  const noMatches = thai ? "ไม่พบโมเดลที่ตรงกับคำค้น" : "No matching models";
  const taskType = task?.modelType === "mask_rcnn" ? "instance_segmentation" : task?.modelType === "deeplabv3plus" ? "semantic_segmentation" : task?.taskType;

  if (loading) return <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 motion-safe:animate-spin" />{thai ? "กำลังโหลดโมเดล" : "Loading models"}</p>;
  if (error) return <div className="space-y-3"><p role="alert" className="break-words text-sm text-destructive">{error}</p><Button variant="outline" onClick={() => { setError(""); setLoading(true); setAttempt(value => value + 1); }}><RefreshCw className="h-4 w-4" />{thai ? "ลองใหม่" : "Retry"}</Button></div>;
  if (!tasks.length) return <p className="py-6 text-sm text-muted-foreground">{thai ? "ยังไม่มีงานที่เทรนสำเร็จ" : "No completed training runs yet."}</p>;
  return <div className="min-w-0 space-y-5">
    <div className="space-y-2">
      <label htmlFor={`${mode}-run-search`} className="text-sm font-medium">{thai ? "ค้นหาโมเดล" : "Search models"}</label>
      <Input id={`${mode}-run-search`} type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder={thai ? "ชื่องานหรือโมเดล" : "Run or model name"} />
      <h3 id={`${mode}-run-label`} className="pt-2 text-sm font-medium">{thai ? "งานที่เทรนสำเร็จ" : "Completed runs"}</h3>
      <div role="status" className="sr-only">
        {!searching && debouncedQuery && (matches.length ? (thai ? `พบ ${matches.length} งาน` : `${matches.length} matching runs`) : noMatches)}
      </div>
      <div aria-busy={searching} className="overflow-hidden rounded-md border">
        {matches.length ? (
          <ul aria-labelledby={`${mode}-run-label`} className="max-h-48 divide-y overflow-y-auto">
            {matches.map(item => (
              <li key={item.id}>
                <Button type="button" variant="ghost" aria-pressed={item.id === selected} disabled={searching} onClick={() => setSelected(item.id)} className="h-auto min-h-11 w-full justify-between gap-3 rounded-none px-3 py-2 text-start whitespace-normal focus-visible:ring-inset aria-pressed:bg-accent">
                  <span className="min-w-0 space-y-0.5">
                    <span className="block wrap-anywhere">{item.displayName}</span>
                    <span className="block text-xs font-normal text-muted-foreground wrap-anywhere">{item.modelName || item.modelType} · {item.runSlug}</span>
                  </span>
                  {item.id === selected && <Check aria-hidden="true" />}
                </Button>
              </li>
            ))}
          </ul>
        ) : <p className="px-3 py-3 text-sm text-muted-foreground">{searching ? (thai ? "กำลังค้นหา…" : "Searching…") : noMatches}</p>}
      </div>
    </div>
    {task?.runSlug && <div className="min-w-0 space-y-4 border-t pt-5">
      <p className="break-all text-xs text-muted-foreground">{task.runSlug}</p>
      {mode === "api" ? <ModelApiPanel runSlug={task.runSlug} /> : <PublishForm key={task.runSlug} runSlug={task.runSlug} taskType={taskType} thai={thai} onDone={onDone} />}
    </div>}
  </div>;
}
