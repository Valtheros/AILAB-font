"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, ImageUp, LoaderCircle, Play, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/components/language-provider";
import { apiBaseUrl } from "@/lib/api";
import { computeActive } from "@/lib/compute";
import { appMessage, appRequest, AppRequestError, type AppJob, type ModelApp } from "@/lib/model-apps";
import type { PredictResponse } from "@/components/tasks/model-test-dialog";

type AppResult = Omit<PredictResponse, 'model'> & { version: number };
const API = apiBaseUrl();

export function AppViewer({ owner, slug }: { owner: string; slug: string }) {
  const search = useSearchParams(); const version = search.get('version');
  const { language } = useLanguage(); const thai = language === "th";
  return <AppContent key={`${owner}:${slug}:${version}:${language}`} owner={owner} slug={slug} version={version} initialJob={search.get('job')} thai={thai} />;
}

function AppContent({ owner, slug, version, initialJob, thai }: { owner: string; slug: string; version: string | null; initialJob: string | null; thai: boolean }) {
  const query = new URLSearchParams();
  if (version) query.set('version', version);
  if (initialJob) query.set('job', initialJob);
  const endpoint = `/api/apps/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}?${query}`;
  const [app, setApp] = useState<ModelApp | null>(null), [error, setError] = useState(""), [reload, setReload] = useState(0);
  const [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState(""), [busy, setBusy] = useState(false);
  const [jobId, setJobId] = useState(initialJob), [threshold, setThreshold] = useState(25);
  const requestKey = useRef<string | null>(null), submitting = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { const controller = new AbortController(); appRequest<ModelApp>(endpoint, thai, { signal: controller.signal }).then(data => { setApp(data); setError(""); }).catch(error => { if (!controller.signal.aborted) setError(error.message); }); return () => controller.abort(); }, [endpoint, thai, reload]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const selectJob = (id: string | null) => {
    setJobId(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('job', id); else url.searchParams.delete('job');
    window.history.replaceState(null, '', url);
  };
  const submit = async () => {
    if (!file || !app || submitting.current) return;
    submitting.current = true; setBusy(true); setError("");
    requestKey.current ??= crypto.randomUUID();
    const form = new FormData(); form.append('file', file); form.append('threshold', String(threshold / 100));
    try {
      const job = await appRequest<AppJob>(`/api/apps/${encodeURIComponent(owner)}/${encodeURIComponent(slug)}/predict${version ? `?version=${encodeURIComponent(version)}` : ''}`, thai,
        { method: 'POST', headers: { 'Idempotency-Key': requestKey.current }, body: form });
      if (mounted.current) { selectJob(job.id); setFile(null); setPreview(""); requestKey.current = null; setReload(value => value + 1); }
    } catch (error) { if (mounted.current) setError(error instanceof Error ? error.message : appMessage('SUBMISSION_UNCONFIRMED', thai)); }
    finally { submitting.current = false; if (mounted.current) setBusy(false); }
  };
  if (!app) return <div className="mx-auto max-w-5xl py-8">{error ? <div className="space-y-4"><p role="alert" className="text-destructive">{error}</p><Button variant="outline" onClick={() => setReload(value => value + 1)}><RefreshCw className="h-4 w-4" />{thai ? 'ลองใหม่' : 'Retry'}</Button></div> : <p role="status" className="flex items-center gap-2"><LoaderCircle className="h-5 w-5 animate-spin" />{thai ? 'กำลังโหลดแอป' : 'Loading app'}</p>}</div>;
  return <div className="mx-auto max-w-5xl space-y-6">
    <header className="space-y-3 border-b pb-5">{app.isOwner && <Link href="/apps" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" />Model Apps</Link>}<div className="flex flex-wrap items-baseline justify-between gap-2"><h1 className="min-w-0 break-words text-2xl font-semibold">{app.name}</h1><span className="text-sm text-muted-foreground">{version ? (thai ? 'ทดสอบก่อนเผยแพร่' : 'Preview') : (thai ? 'เวอร์ชัน' : 'Version')} {app.version}</span></div>{app.description && <p className="break-words text-muted-foreground">{app.description}</p>}<p className="text-xs text-muted-foreground">{thai ? 'งานเข้าคิวร่วมกับการฝึกโมเดล ผลและรูปที่ส่งมองเห็นได้เฉพาะคุณ และเก็บไว้ 24 ชั่วโมงหลังงานจบ' : 'Predictions share the training queue. Only you can access your uploads and results; they expire 24 hours after completion.'}</p></header>
    {(app.published || (app.isOwner && version)) && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
      <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed p-5 text-center focus-within:ring-2 focus-within:ring-ring"><ImageUp className="h-6 w-6 text-muted-foreground" /><span className="break-all text-sm font-medium">{file?.name || (thai ? 'เลือกรูปภาพ' : 'Choose image')}</span><span className="text-xs text-muted-foreground">JPG, PNG, WebP, BMP, TIFF · 10 MiB · 25 MP</span><input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp,image/bmp,image/tiff" disabled={busy} onChange={event => {
        const selected = event.target.files?.[0]; event.target.value = ''; if (!selected) return;
        if (selected.size > 10 * 1024 * 1024) { setError(appMessage('IMAGE_TOO_LARGE', thai)); return; }
        if (!['image/jpeg','image/png','image/webp','image/bmp','image/tiff'].includes(selected.type)) { setError(appMessage('INVALID_IMAGE', thai)); return; }
        setFile(selected); setPreview(URL.createObjectURL(selected)); setError(""); selectJob(null); requestKey.current = null;
      }} /></label>
      {preview && <div className="flex justify-center border-y py-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- Local uploads do not use the public image optimizer. */}
        <img src={preview} alt={thai ? 'รูปที่เลือก' : 'Selected image'} className="max-h-80 max-w-full object-contain" />
      </div>}
      <div className="flex flex-wrap items-end justify-between gap-5">{app.taskType !== 'image_classification' && app.taskType !== 'semantic_segmentation' && <div className="w-64 max-w-full space-y-3"><label htmlFor="confidence" className="text-sm">{thai ? 'คะแนนขั้นต่ำ' : 'Minimum confidence'}: {threshold}%</label><input id="confidence" type="range" className="block min-h-6 w-full accent-foreground" min={0} max={100} step={1} value={threshold} disabled={busy} onChange={event => { setThreshold(Number(event.target.value)); requestKey.current = null; }} /></div>}<Button type="submit" disabled={!file || busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}{thai ? 'ส่งทำนาย' : 'Predict'}</Button></div>
    </form>}
    {!app.published && !version && <p className="text-sm text-muted-foreground">{thai ? 'แอปนี้ปิดรับงานใหม่ ผลของงานเดิมยังเปิดได้จนหมดอายุ' : 'This app is not accepting new predictions. Existing results remain available until expiry.'}</p>}
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    {jobId && <PredictionJob key={jobId} jobId={jobId} appId={app.id} thai={thai} />}
    {!!app.jobs?.length && <section className="space-y-3 border-t pt-5"><h2 className="font-medium">{thai ? 'งานล่าสุดของคุณ' : 'Your recent predictions'}</h2><ul className="divide-y">{app.jobs.map(job => <li key={job.id}><button type="button" className="flex w-full flex-wrap items-center justify-between gap-2 py-3 text-left text-sm hover:bg-accent disabled:opacity-50" disabled={busy} onClick={() => selectJob(job.id)}><span className="min-w-0 break-all">{job.inputName} · v{job.version}</span><span className="text-xs text-muted-foreground">{new Date(job.createdAt).toLocaleString(thai ? 'th-TH' : 'en-US')}</span></button></li>)}</ul></section>}
  </div>;
}

function PredictionJob({ jobId, appId, thai }: { jobId: string; appId: string; thai: boolean }) {
  const [job, setJob] = useState<AppJob | null>(null), [result, setResult] = useState<AppResult | null>(null), [error, setError] = useState("");
  const [reload, setReload] = useState(0), [cancelling, setCancelling] = useState(false);
  useEffect(() => {
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      let again = true;
      try {
        const next = await appRequest<AppJob>(`/api/apps/jobs/${jobId}`, thai, { signal: controller.signal });
        if (next.appId !== appId) { again = false; throw new Error(appMessage('NOT_FOUND', thai)); }
        if (controller.signal.aborted) return;
        setJob(next); setError(""); again = computeActive(next);
        if (next.status === 'completed') {
          const data = await appRequest<AppResult>(`/api/apps/jobs/${jobId}/result`, thai, { signal: controller.signal });
          if (!controller.signal.aborted) setResult(data);
        }
      } catch (error) {
        if (error instanceof AppRequestError && [400, 401, 403, 404, 410, 422].includes(error.status)) again = false;
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : appMessage('CONNECTION_INTERRUPTED', thai));
      }
      if (again && !controller.signal.aborted) timer = setTimeout(poll, 5000);
    };
    void poll(); return () => { controller.abort(); clearTimeout(timer); };
  }, [jobId, appId, thai, reload]);
  const active = computeActive(job);
  return <section className="space-y-4 border-t pt-5" aria-label={thai ? 'ผลทำนาย' : 'Prediction result'}>
    <div className="flex flex-wrap items-start justify-between gap-3"><div role="status" className="space-y-1"><p className="flex items-center gap-2 font-medium">{((!job && !error) || active) && <LoaderCircle className="h-4 w-4 animate-spin" />}{job ? `${appMessage(job.status, thai)} · v${job.version}` : error ? (thai ? 'เปิดงานทำนายไม่ได้' : 'Prediction unavailable') : (thai ? 'กำลังโหลดงาน' : 'Loading prediction')}</p>{job?.queueReason && <p className="text-sm text-muted-foreground">{appMessage(job.queueReason, thai)}</p>}{job?.status === 'queued' && !job.queueReason && <p className="text-sm text-muted-foreground">{thai ? 'รอเครื่องประมวลผลว่าง งาน Train ที่เริ่มแล้วจะทำต่อจนจบ' : 'Waiting for compute capacity. Training already in progress continues until it finishes.'}</p>}</div>{active && <Button size="sm" variant="outline" disabled={cancelling || job?.status === 'stopping'} onClick={async () => { setCancelling(true); try { setJob(await appRequest(`/api/apps/jobs/${jobId}/cancel`, thai, { method: 'POST' })); } catch (error) { setError(error instanceof Error ? error.message : 'Request failed'); } finally { setCancelling(false); } }}><X className="h-4 w-4" />{thai ? 'ยกเลิกงาน' : 'Cancel prediction'}</Button>}</div>
    {job?.status === 'failed' && <p role="alert" className="text-sm text-destructive">{appMessage(job.errorCode || 'COMPUTE_FAILED', thai)}</p>}
    {error && <div className="space-y-2"><p role="alert" className="break-words text-sm text-destructive">{error}</p><Button size="sm" variant="outline" onClick={() => setReload(value => value + 1)}><RefreshCw className="h-4 w-4" />{thai ? 'ลองใหม่' : 'Retry'}</Button></div>}
    {result && <PredictionResult key={jobId} result={result} jobId={jobId} thai={thai} />}
    {job?.expiresAt && <p className="text-xs text-muted-foreground">{thai ? 'ผลหมดอายุ' : 'Expires'}: {new Date(job.expiresAt).toLocaleString(thai ? 'th-TH' : 'en-US')}</p>}
  </section>;
}

function PredictionResult({ result, jobId, thai }: { result: AppResult; jobId: string; thai: boolean }) {
  const [show, setShow] = useState(true), [opacity, setOpacity] = useState(80);
  const predictions = result.predictions ?? [];
  const detection = result.taskType === 'object_detection';
  const segmentation = result.segmentation;
  const download = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = `prediction-${jobId}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">{(detection || segmentation) && <label className="flex items-center gap-2 text-sm"><Switch checked={show} onCheckedChange={setShow} />{thai ? 'แสดงผลบนภาพ' : 'Show predictions'}</label>}<div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={download}><Download className="h-4 w-4" />JSON</Button>{segmentation?.overlay && <Button asChild variant="outline" size="sm"><a href={`${API}/api/apps/jobs/${jobId}/files/overlay`} download={`prediction-${jobId}.png`}><Download className="h-4 w-4" />{thai ? 'ภาพผลลัพธ์' : 'Result image'}</a></Button>}</div></div>
    {segmentation && <div className="max-w-xs space-y-3"><label htmlFor="mask-opacity" className="text-sm">{thai ? 'ความทึบของผลบนภาพ' : 'Overlay opacity'}: {opacity}%</label><input id="mask-opacity" type="range" className="block min-h-6 w-full accent-foreground" min={0} max={100} step={1} value={opacity} onChange={event => setOpacity(Number(event.target.value))} /></div>}
    <div className="flex justify-center border-y bg-muted/20 py-3"><div className="relative max-w-full" style={{ width: Math.min(result.image?.width || 640, 900), aspectRatio: `${result.image?.width || 1}/${result.image?.height || 1}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Authenticated image endpoints must not use the public image optimizer. */}
      <img src={`${API}/api/apps/jobs/${jobId}/files/input`} alt={thai ? 'รูปที่ส่งทำนาย' : 'Prediction input'} className="absolute inset-0 h-full w-full object-contain" />
      {show && segmentation?.overlay && <>
        {/* eslint-disable-next-line @next/next/no-img-element -- Session-protected model output. */}
        <img src={`${API}${segmentation.overlay}`} alt={thai ? 'ผลแบ่งส่วนภาพ' : 'Segmentation result'} className="absolute inset-0 h-full w-full object-contain" style={{ opacity: opacity / 100 }} />
      </>}
      {show && detection && result.image && <svg viewBox={`0 0 ${result.image.width} ${result.image.height}`} className="absolute inset-0 h-full w-full" aria-label={thai ? 'กรอบวัตถุ' : 'Detected objects'}>{predictions.map((prediction, index) => prediction.box && <rect key={index} x={prediction.box[0]} y={prediction.box[1]} width={prediction.box[2] - prediction.box[0]} height={prediction.box[3] - prediction.box[1]} fill="none" stroke={['#f43f5e','#22c55e','#38bdf8','#fbbf24'][Math.max(0, result.classes.indexOf(prediction.className)) % 4]} strokeWidth={2} vectorEffect="non-scaling-stroke"><title>{prediction.className} {prediction.percent}%</title></rect>)}</svg>}
    </div></div>
    {result.top && <p className="break-words text-lg font-semibold">{result.top.className} <span className="text-sm font-normal text-muted-foreground">{result.top.percent}%</span></p>}
    {detection && <p className="text-sm">{thai ? 'จำนวนวัตถุ' : 'Objects'}: {result.count ?? predictions.length}</p>}
    <ul className="max-h-72 divide-y overflow-y-auto text-sm">{predictions.map((prediction, index) => <li key={index} className="flex items-baseline justify-between gap-3 py-2"><span className="min-w-0 break-words">{prediction.className}</span><span className="shrink-0 tabular-nums">{prediction.percent}%</span></li>)}{segmentation?.legend?.map(entry => <li key={entry.name} className="flex items-center justify-between gap-3 py-2"><span className="flex min-w-0 items-center gap-2"><span className="h-3 w-3 shrink-0" style={{ backgroundColor: entry.color }} /><span className="break-words">{entry.name}</span></span><span className="shrink-0">{entry.percent}% {thai ? 'ของภาพ' : 'of image'}</span></li>)}{segmentation?.instances?.map((instance, index) => <li key={index} className="flex items-center justify-between gap-3 py-2"><span className="flex min-w-0 items-center gap-2"><span className="h-3 w-3 shrink-0" style={{ backgroundColor: instance.color }} /><span className="break-words">{instance.className}</span></span><span className="shrink-0">{instance.percent}%</span></li>)}</ul>
    {result.timingMs && <dl className="flex flex-wrap gap-5 border-t pt-3 text-xs text-muted-foreground">{[[thai ? 'โหลดโมเดล' : 'Model load', result.timingMs.modelLoad], [thai ? 'ทำนาย' : 'Inference', result.timingMs.inference], [thai ? 'รวม (ไม่รวมคิว)' : 'Total (excluding queue)', result.timingMs.total]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value} ms</dd></div>)}</dl>}
  </div>;
}
