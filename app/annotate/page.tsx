"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, RefreshCw, Upload, X } from "lucide-react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/components/language-provider";
import { apiBaseUrl } from "@/lib/api";

type Account = { activated: boolean; disabled?: boolean; url?: string };
type Operation = { id: string; status: string; processed: number; total: number; error?: string; error_code?: string; error_details?: { imageId?: number }; requestId?: string; result?: {
  datasetName: string; images: number; classes: string[]; accepted: boolean;
  preview: { source_format: string; canonical_format: string; dataset_task: string; conversion_warnings?: string[]; compatible_models?: { id: string; label: string; ready?: boolean }[] };
} };

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const response = await fetch(`${apiBaseUrl()}/api/label-studio${path}`, { method, cache: "no-store", headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Request failed (${response.status})`);
  return data;
}

export default function AnnotationPage() { return <MainLayout><Annotation /></MainLayout>; }

function errorText(message: string, language: string, code?: string, details?: { imageId?: number }) {
  if (code === 'ANNOTATION_UNFINISHED' && details?.imageId) message = `Image ${details.imageId} is unfinished.`;
  if (code === 'CLASSIFICATION_LABEL_REQUIRED') message = 'Classification images require a class or must be excluded.';
  if (code === 'TRAIN_IMAGES_REQUIRED') message = 'At least one submitted training image is required.';
  const unfinished = message.match(/^Image (\d+) is unfinished\./);
  if (unfinished) return language === "th"
    ? `รูป ID ${unfinished[1]} ยังไม่ได้ Submit หรือมี draft ที่ค้างอยู่ กรุณากลับไป Label Studio แล้วกด Submit หากไม่ต้องการใช้รูปนี้ ให้เลือก Exclude from dataset จากนั้นกดลองใหม่`
    : `Image ID ${unfinished[1]} has not been submitted or has an unfinished draft. Return to Label Studio and Submit, or select Exclude from dataset if you do not want to use it. Then retry.`;
  if (message === "Classification images require a class or must be excluded.") return language === "th"
    ? "ยังมีรูป Classification ที่ไม่ได้เลือกคลาส กรุณาเลือกคลาสแล้วกด Submit หรือเลือก Exclude from dataset สำหรับรูปที่ไม่ใช้ แล้วกดลองใหม่"
    : "Some classification images have no class. Choose a class and Submit, or exclude those images, then retry.";
  if (message === "At least one submitted training image is required.") return language === "th"
    ? "ต้องมีรูปในชุด Train ที่กด Submit แล้วอย่างน้อย 1 รูป กรุณาตรวจชุด Train ใน Label Studio และอย่า Exclude ทุกรูป แล้วกดลองใหม่"
    : "At least one non-excluded Train image must be submitted. Check the Train split in Label Studio, submit an image, then retry.";
  if (language === "th" && message.startsWith("Label Studio is unavailable.")) return "ขณะนี้เชื่อมต่อ Label Studio ไม่ได้ งานที่บันทึกไว้ยังอยู่ กรุณาลองใหม่ภายหลัง หากยังไม่ได้ให้ติดต่อผู้ดูแลระบบ";
  if (language === "th" && message.startsWith("Operation failed.")) return "ระบบประมวลผลไม่สำเร็จ กรุณาลองใหม่ หากยังพบปัญหาให้ติดต่อผู้ดูแลระบบพร้อมลิงก์หน้านี้เพื่อเช็ก log";
  return message;
}

function Annotation() {
  const { language } = useLanguage();
  const text = (en: string, th: string) => language === "th" ? th : en;
  const [account, setAccount] = useState<Account>();
  const [operation, setOperation] = useState<Operation>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const update = async (id: string) => {
      try {
        const data = await request<{ operation: Operation }>(`/operations/${id}`);
        if (cancelled) return;
        setOperation(data.operation); setError("");
        if (["queued", "running"].includes(data.operation.status)) timer = setTimeout(() => void update(id), 2000);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); }
    };
    const start = async () => {
      try {
        const next = await request<Account>("/account");
        if (cancelled) return;
        setAccount(next);
        const params = new URLSearchParams(window.location.search);
        const project = params.get("project"), transfer = params.get("transfer");
        if (next.activated && project && transfer) {
          if (!/^\d+$/.test(project) || !/^[0-9a-f-]{36}$/i.test(transfer)) throw new Error("Invalid dataset transfer link.");
          setPreparing(true);
          const result = await request<{ operation: Operation }>(`/transfers/${project}`, "POST", { transfer });
          if (!cancelled) await update(result.operation.id);
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : String(e)); }
      finally { if (!cancelled) setPreparing(false); }
    };
    void start();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [reload]);

  async function perform(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  const pending = preparing || (operation && ["queued", "running"].includes(operation.status));
  const result = operation?.result;
  return <div className="mx-auto max-w-4xl space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
      <h1 className="text-2xl font-semibold">Annotation</h1>
      {account?.activated && account.url && <Button asChild><a href={account.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" />{text("Open Label Studio", "เปิด Label Studio")}</a></Button>}
    </header>
    {error && <div role="alert" className="space-y-3 border-l-2 border-destructive pl-4"><p className="break-words text-destructive">{errorText(error, language)}</p><Button variant="outline" disabled={busy} onClick={() => { setError(""); setReload(v => v + 1); }}><RefreshCw className="size-4" />{text("Retry", "ลองใหม่")}</Button></div>}
    {!account && !error && <p role="status">{text("Loading…", "กำลังโหลด…")}</p>}
    {account && !account.activated && <Button disabled={busy || account.disabled} onClick={() => void perform(async () => { const next = await request<Account>("/account", "POST"); if (next.url) window.location.assign(next.url); })}>{text("Set up Label Studio account", "ตั้งค่าบัญชี Label Studio")}</Button>}
    {pending && <section className="space-y-3 py-6" aria-live="polite"><h2 className="text-lg font-semibold">{text("Preparing import preview", "กำลังตรวจสอบ dataset")}</h2><progress className="h-2 w-full" max={operation?.total || 1} value={operation?.processed || 0} /><p className="text-sm text-muted-foreground">{operation?.processed || 0} / {operation?.total || 0}</p></section>}
    {operation?.status === "failed" && <section className="space-y-3"><p role="alert" className="break-words text-destructive">{errorText(operation.error || "Operation failed.", language, operation.error_code, operation.error_details)}</p><p className="break-all text-xs text-muted-foreground">Request ID: {operation.requestId || operation.id}</p><Button disabled={busy} onClick={() => void perform(async () => { await request(`/operations/${operation.id}/retry`, "POST"); setReload(v => v + 1); })}><RefreshCw className="size-4" />{text("Retry", "ลองใหม่")}</Button></section>}
    {operation?.status === "cancelled" && <p>{text("Transfer cancelled. Your Label Studio project is unchanged.", "ยกเลิกการนำเข้าแล้ว โปรเจกต์ใน Label Studio ยังอยู่เหมือนเดิม")}</p>}
    {operation?.status === "completed" && result?.preview && <section className="space-y-6 py-2">
      <div><h2 className="text-xl font-semibold">Import Preview</h2><p className="mt-2 break-all text-muted-foreground">{result.datasetName}</p></div>
      <dl className="grid gap-5 border-y py-5 sm:grid-cols-3">{[["Source", result.preview.source_format], ["Task", result.preview.dataset_task], ["Format", result.preview.canonical_format]].map(([name, value]) => <div key={name} className="min-w-0"><dt className="text-sm text-muted-foreground">{name}</dt><dd className="mt-1 break-words font-medium">{value.replaceAll("_", " ")}</dd></div>)}</dl>
      <div className="flex flex-wrap gap-6 text-sm"><span>{result.images} {text("images", "รูป")}</span><span>{result.classes.length} {text("classes", "คลาส")}</span></div>
      <div className="flex flex-wrap gap-2">{result.classes.map(name => <span key={name} className="max-w-full break-words rounded border px-2 py-1 text-sm">{name}</span>)}</div>
      <div><h3 className="mb-3 text-sm text-muted-foreground">{text("Compatible models", "โมเดลที่รองรับ")}</h3><div className="flex flex-wrap gap-2">{result.preview.compatible_models?.filter(model => model.ready).map(model => <span className="rounded border px-2 py-1 text-sm" key={model.id}>{model.label}</span>)}</div></div>
      {result.preview.conversion_warnings?.map(warning => <p key={warning} className="text-sm text-amber-600 dark:text-amber-400">{warning}</p>)}
      {result.accepted ? <div className="flex flex-wrap items-center gap-4"><span className="inline-flex items-center gap-2 text-emerald-600 dark:text-emerald-400"><Check className="size-4" />{text("Dataset imported", "นำเข้า dataset แล้ว")}</span><Button asChild variant="outline"><a href="/dataset">{text("Open datasets", "เปิด Dataset")}</a></Button></div> : <div className="flex flex-wrap gap-3">
        <Button disabled={busy} onClick={() => void perform(async () => { const next = await request<NonNullable<Operation["result"]>>(`/operations/${operation.id}/accept`, "POST"); setOperation({ ...operation, result: next }); })}><Upload className="size-4" />{text("Import dataset", "นำเข้า dataset")}</Button>
        <Button variant="outline" disabled={busy} onClick={() => void perform(async () => { const next = await request<NonNullable<Operation["result"]> | { discarded: true }>(`/operations/${operation.id}/discard`, "POST"); setOperation("accepted" in next && next.accepted ? { ...operation, result: next } : { ...operation, status: "cancelled" }); })}><X className="size-4" />{text("Cancel", "ยกเลิก")}</Button>
      </div>}
    </section>}
  </div>;
}
