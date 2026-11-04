"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2, Play, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ExecutionSelector } from "@/components/tasks/execution-selector";
import { useLanguage } from "@/components/language-provider";
import { apiBaseUrl } from "@/lib/api";
import { computeActive, computeMessage, type ComputeJob, type ExecutionSelection } from "@/lib/compute";

const API_URL = apiBaseUrl();
const MAX_BYTES = 1024 ** 3;

type BatchItem = {
  filename: string;
  status: string;
  error?: string;
  result?: {
    top?: { className: string; percent: number };
    count?: number;
    overlayFile?: string;
    segmentation?: { overlayFile?: string };
  };
};
type BatchResult = { total: number; succeeded: number; failed: number; images: BatchItem[] };

export function BatchTest({ runSlug }: { runSlug: string }) {
  const { language } = useLanguage();
  const thai = language === "th";
  const [execution, setExecution] = useState<ExecutionSelection>({ mode: "auto" });
  const [files, setFiles] = useState<File[]>([]);
  const [job, setJob] = useState<ComputeJob | null>(null);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const generation = useRef(0);
  const requestKey = useRef<string | null>(null);
  const executionEdited = useRef(false);
  const jobId = job?.id;

  useEffect(() => {
    const controller = new AbortController();
    const version = generation.current;
    fetch(`${API_URL}/api/compute/jobs?runSlug=${encodeURIComponent(runSlug)}&kind=batch_predict`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!controller.signal.aborted && generation.current === version && data?.job) {
          setJob(data.job);
          if (!executionEdited.current) setExecution(data.job.requestedExecution);
        }
      }).catch(() => undefined);
    return () => { controller.abort(); generation.current += 1; };
  }, [runSlug]);

  useEffect(() => {
    if (!jobId) return;
    const controller = new AbortController();
    const version = generation.current;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let terminal = false;
      try {
        const response = await fetch(`${API_URL}/api/compute/jobs/${jobId}`, { signal: controller.signal });
        const current = await response.json();
        if (!response.ok) {
          terminal = response.status >= 400 && response.status < 500 && response.status !== 429;
          throw new Error(computeMessage(current.code, thai, current.detail));
        }
        if (controller.signal.aborted || generation.current !== version) return;
        setJob(current);
        setError("");
        terminal = !computeActive(current);
        if (current.status === "failed") {
          terminal = true;
          setError(current.errorCode === "COMPUTE_FAILED" && current.error
            ? (thai ? `งานไม่สำเร็จ: ${current.error}` : current.error) : computeMessage(current.errorCode, thai, current.error));
          const output = await fetch(`${API_URL}/api/compute/jobs/${jobId}/batch-result`, { signal: controller.signal }).catch(() => null);
          if (output?.ok) {
            const data = await output.json();
            if (!controller.signal.aborted && generation.current === version) setResult(data);
          } else if (output?.status === 410 && current.expiresAt && Date.parse(current.expiresAt) <= Date.now()) {
            setError(thai ? "ผลทดสอบหมดอายุแล้ว" : "This result has expired.");
          }
        } else if (current.status === "completed") {
          terminal = false;
          const output = await fetch(`${API_URL}/api/compute/jobs/${jobId}/batch-result`, { signal: controller.signal });
          if (output.ok) {
            const data = await output.json();
            if (!controller.signal.aborted && generation.current === version) setResult(data);
            terminal = true;
          } else if (output.status === 410) {
            setError(thai ? "ผลทดสอบหมดอายุแล้ว" : "This result has expired.");
            terminal = true;
          } else {
            terminal = output.status >= 400 && output.status < 500 && output.status !== 429;
            throw new Error(thai ? "โหลดผลทดสอบไม่สำเร็จ" : "Could not load the results.");
          }
        }
      } catch (caught) {
        if (controller.signal.aborted || generation.current !== version) return;
        setError(caught instanceof Error ? caught.message : (thai ? "เชื่อมต่อไม่สำเร็จ" : "Connection failed"));
      }
      if (!controller.signal.aborted && !terminal) timer = setTimeout(poll, 2000);
    };
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [jobId, thai]);

  const choose = (selected: File[]) => {
    const archiveCount = selected.filter((file) => file.name.toLowerCase().endsWith(".zip")).length;
    if (selected.length > 100 || (archiveCount && (selected.length !== 1 || archiveCount !== 1)) || selected.reduce((sum, file) => sum + file.size, 0) > MAX_BYTES) {
      setError(thai ? "เลือกได้สูงสุด 100 ภาพ หรือ ZIP หนึ่งไฟล์ รวมไม่เกิน 1 GiB" : "Select up to 100 images or one ZIP, up to 1 GiB.");
      return;
    }
    generation.current += 1;
    requestKey.current = null;
    setFiles(selected);
    setJob(null);
    setResult(null);
    setError("");
  };

  const submit = async () => {
    if (!files.length) return;
    setSubmitting(true);
    setError("");
    const version = generation.current;
    try {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      form.append("execution", JSON.stringify(execution));
      requestKey.current ??= Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const response = await fetch(`${API_URL}/api/runs/${encodeURIComponent(runSlug)}/predict-batch`, {
        method: "POST", headers: { "Idempotency-Key": requestKey.current }, body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(computeMessage(data.code, thai, data.detail));
      if (generation.current === version) { setJob(data); setResult(null); requestKey.current = null; }
    } catch (caught) {
      if (generation.current === version) setError(caught instanceof TypeError
        ? computeMessage("SUBMISSION_UNCONFIRMED", thai)
        : caught instanceof Error ? caught.message : (thai ? "ส่งงานไม่สำเร็จ" : "Could not submit the batch"));
    } finally {
      if (generation.current === version) setSubmitting(false);
    }
  };

  const active = submitting || computeActive(job);
  const progress = job?.progress;
  return <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
    <ExecutionSelector value={execution} onChange={(next) => { executionEdited.current = true; setExecution(next); requestKey.current = null; }} disabled={active} />
    <label className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed p-6 text-center hover:bg-accent/40 focus-within:ring-2 focus-within:ring-ring">
      <Upload className="h-6 w-6 text-muted-foreground" />
      <span className="font-medium">{thai ? "เลือกภาพหลายภาพหรือ ZIP" : "Select images or a ZIP"}</span>
      <span className="text-xs text-muted-foreground">{thai ? "สูงสุด 100 ภาพ · 10 MiB ต่อภาพ · รวมไม่เกิน 1 GiB" : "Up to 100 images · 10 MiB each · 1 GiB total"}</span>
      <input type="file" multiple accept="image/*,.zip" className="sr-only" disabled={active} onChange={(event) => { choose(Array.from(event.target.files ?? [])); event.currentTarget.value = ""; }} />
    </label>
    {files.length > 0 && <p className="break-words text-sm">{files.length === 1 ? files[0].name : `${files.length} ${thai ? "ไฟล์" : "files"}`}</p>}
    {job && <div className="space-y-2 border-b pb-3 text-sm" role="status">
      <p>{computeMessage(job.status, thai)}{job.assignedGpu && ` · ${job.assignedGpu.name || job.assignedGpu.uuid}`}</p>
      {job.queueReason && <p className="text-muted-foreground">{computeMessage(job.queueReason, thai)}</p>}
      {progress && progress.total > 0 && <><Progress value={progress.current / progress.total * 100} /><p>{progress.current} / {progress.total}</p></>}
      {job.expiresAt && <p className="text-xs text-muted-foreground">{thai ? "ผลหมดอายุ" : "Results expire"}: {new Date(job.expiresAt).toLocaleString(thai ? "th-TH" : "en-US")}</p>}
      {computeActive(job) && <Button variant="outline" size="sm" onClick={async () => {
        try {
          const response = await fetch(`${API_URL}/api/compute/jobs/${job.id}/cancel`, { method: "POST" });
          const data = await response.json();
          if (!response.ok) throw new Error(computeMessage(data.code, thai, data.detail));
          setJob(data);
        } catch (caught) { setError(caught instanceof Error ? caught.message : (thai ? "ยกเลิกไม่สำเร็จ" : "Cancellation failed")); }
      }}><X className="h-4 w-4" />{thai ? "ยกเลิกงาน" : "Cancel job"}</Button>}
    </div>}
    {error && <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
    {result && job && <div className="space-y-3">
      <p className="text-sm font-medium">{thai ? "สำเร็จ" : "Completed"} {result.succeeded} / {result.total} · {thai ? "ไม่สำเร็จ" : "Failed"} {result.failed}</p>
      <div className="flex flex-wrap gap-2">
        {[['results.zip', 'ZIP'], ['results.csv', 'CSV'], ['result.json', 'JSON']].map(([file, label]) => <Button key={file} asChild size="sm" variant="outline"><a href={`${API_URL}/api/compute/jobs/${job.id}/files/${file}`}><Download className="h-4 w-4" />{label}</a></Button>)}
      </div>
      <div className="divide-y rounded-md border">
        {result.images.map((item, index) => {
          const overlay = item.result?.segmentation?.overlayFile || item.result?.overlayFile;
          return <div key={`${index}-${item.filename}`} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
            <div className="min-w-0"><p className="break-all font-medium">{item.filename}</p><p className="break-words text-xs text-muted-foreground">{item.error || (item.result?.top ? `${item.result.top.className} · ${item.result.top.percent}%` : `${item.result?.count ?? 0} ${thai ? "รายการ" : "items"}`)}</p></div>
            {overlay && <a className="text-sm underline" href={`${API_URL}/api/compute/jobs/${job.id}/files/${overlay}`} target="_blank" rel="noreferrer">{thai ? "ดูภาพ" : "View image"}</a>}
          </div>;
        })}
      </div>
    </div>}
    <div className="flex justify-end border-t pt-4"><Button onClick={submit} disabled={!files.length || active}>{submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{thai ? "ทดสอบหลายภาพ" : "Test images"}</Button></div>
  </div>;
}
