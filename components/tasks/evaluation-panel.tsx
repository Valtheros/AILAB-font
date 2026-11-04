"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw, Target, Trash2, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExecutionSelector } from "@/components/tasks/execution-selector";
import { useLanguage } from "@/components/language-provider";
import { apiBaseUrl } from "@/lib/api";
import type { ExecutionSelection } from "@/lib/compute";

const API = apiBaseUrl();
const ACTIVE = new Set(["awaiting_queue", "queued", "running", "stopping"]);
const COLORS = ["#f87171", "#38bdf8", "#4ade80", "#facc15", "#c084fc", "#fb923c", "#22d3ee"];

type Dataset = { id: string; name: string; collectionName?: string | null; version?: number | null; compatibleModels?: { id: string; ready: boolean }[] };
type ClassMetrics = { name: string; support?: number; pixels?: number; precision?: number | null; recall?: number | null; f1?: number | null; iou?: number | null; dice?: number | null; ap50?: number | null; ap?: number | null };
type Metrics = { accuracy?: number | null; pixelAccuracy?: number | null; meanIoU?: number | null; map?: number | null; map50?: number | null; classes?: ClassMetrics[]; boxes?: Metrics; masks?: Metrics };
type Report = { status: string; metrics?: Metrics | null; evaluated: number; skipped: number; sourceVerified?: boolean; checkpointSha256?: string; datasetContentSha256?: string | null; classMapping?: Record<string, string | number> };
type Evaluation = { id: string; status: string; origin: string; datasetName: string; datasetVersion?: number | null; error?: string | null; report?: Report; createdAt: string };
type ImageSummary = { ordinal: number; filename: string; outcome: string; score?: number | null; fp_count: number; fn_count: number };
type Box = { bbox: number[]; category_id: number; score?: number };
type ImageDetail = { actual?: string | Box[]; predicted?: string; predictions?: Box[]; confidence?: number; width?: number; height?: number; actualMask?: string; predictedMask?: string; error?: string };

function percent(value: number | null | undefined) { return value == null ? "—" : `${(value * 100).toFixed(2)}%`; }
function statusLabel(value: string, thai: boolean) {
  const labels: Record<string, [string, string]> = {
    awaiting_queue: ["Preparing", "กำลังเตรียมเข้าคิว"], queued: ["Queued", "รอในคิว"],
    running: ["Running", "กำลังประเมิน"], stopping: ["Stopping", "กำลังยกเลิก"],
    completed: ["Completed", "สำเร็จ"], partial: ["Partially completed", "สำเร็จบางส่วน"],
    no_test: ["No test split", "ไม่มีชุดทดสอบ"], failed: ["Failed", "ไม่สำเร็จ"], cancelled: ["Cancelled", "ยกเลิกแล้ว"],
    correct: ["Correct", "ทำนายถูก"], incorrect: ["Incorrect", "ทำนายผิด"], error: ["Skipped", "ข้าม"],
  };
  return labels[value]?.[thai ? 1 : 0] ?? value;
}

async function loadEvaluations(runSlug: string, thai: boolean, signal?: AbortSignal): Promise<Evaluation[]> {
  const response = await fetch(`${API}/api/runs/${encodeURIComponent(runSlug)}/evaluations`, { signal });
  if (!response.ok) throw new Error(thai ? "โหลดผลประเมินไม่สำเร็จ" : "Could not load evaluations.");
  const data = await response.json();
  return data.evaluations ?? [];
}

function MetricsTable({ data, title, thai }: { data: Metrics; title: string; thai: boolean }) {
  const fields: [string, number | null | undefined][] = [["Accuracy", data.accuracy], ["Pixel accuracy", data.pixelAccuracy],
    ["Mean IoU", data.meanIoU], ["mAP50", data.map50], ["mAP50–95", data.map]];
  const visible = fields.filter(([, value]) => value !== undefined);
  const columns: [keyof ClassMetrics, string][] = [["support", thai ? "จำนวน" : "Support"], ["pixels", "Pixels"], ["precision", "Precision"],
    ["recall", "Recall"], ["f1", "F1"], ["iou", "IoU"], ["dice", "Dice"], ["ap50", "AP50"], ["ap", "AP50–95"]];
  const displayed = columns.filter(([key]) => data.classes?.some((item) => item[key] !== undefined));
  return <section className="space-y-3 border-t pt-4">
    <h4 className="font-medium">{title}</h4>
    {visible.length > 0 && <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">{visible.map(([label, value]) => <p key={label}><span className="text-muted-foreground">{label}: </span><strong>{percent(value)}</strong></p>)}</div>}
    {data.classes && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2">Class</th>{displayed.map(([key, label]) => <th key={key} className="p-2 font-medium">{label}</th>)}</tr></thead><tbody>{data.classes.map((row) => <tr className="border-b" key={row.name}><th className="p-2 font-medium">{row.name}</th>{displayed.map(([key]) => <td key={key} className="p-2 tabular-nums">{key === "support" || key === "pixels" ? String(row[key] ?? "—") : percent(row[key] as number | null | undefined)}</td>)}</tr>)}</tbody></table></div>}
    {data.map50 !== undefined && <p className="text-xs text-muted-foreground">{thai ? "Precision/Recall ใช้ confidence 0.25 และ IoU 0.5; AP คำนวณจากหลายระดับคะแนน" : "Precision/Recall use confidence 0.25 and IoU 0.5; AP uses multiple score levels."}</p>}
  </section>;
}

function MaskPreview({ source, mask, label }: { source: string; mask: string; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    const load = (url: string) => new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = url; });
    Promise.all([load(source), load(mask)]).then(([image, overlay]) => {
      if (cancelled || !canvas.current) return;
      const scale = Math.min(1, 1024 / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale)), height = Math.max(1, Math.round(image.height * scale));
      const display = canvas.current; display.width = width; display.height = height;
      const context = display.getContext("2d"); if (!context) return;
      context.drawImage(image, 0, 0, width, height);
      const layer = document.createElement("canvas"); layer.width = width; layer.height = height;
      const layerContext = layer.getContext("2d", { willReadFrequently: true }); if (!layerContext) return;
      layerContext.imageSmoothingEnabled = false; layerContext.drawImage(overlay, 0, 0, width, height);
      const pixels = layerContext.getImageData(0, 0, width, height);
      for (let i = 0; i < pixels.data.length; i += 4) {
        const id = pixels.data[i];
        if (id === 0 || id === 255) { pixels.data[i + 3] = 0; continue; }
        const color = COLORS[(id - 1) % COLORS.length];
        pixels.data[i] = parseInt(color.slice(1, 3), 16); pixels.data[i + 1] = parseInt(color.slice(3, 5), 16);
        pixels.data[i + 2] = parseInt(color.slice(5, 7), 16); pixels.data[i + 3] = 140;
      }
      layerContext.putImageData(pixels, 0, 0); context.drawImage(layer, 0, 0);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [source, mask]);
  return <figure className="min-w-0"><figcaption className="mb-1 text-sm font-medium">{label}</figcaption><canvas ref={canvas} className="h-auto max-w-full border" aria-label={label} /></figure>;
}

function ImageReview({ evaluationId, summary, detail, classes, thai }: { evaluationId: string; summary: ImageSummary; detail: ImageDetail; classes: ClassMetrics[]; thai: boolean }) {
  const base = `${API}/api/evaluations/${evaluationId}/images/${summary.ordinal}`;
  const source = `${base}/source`;
  const boxes = (items: Box[], color: string) => items.map((item, index) => <rect key={`${color}-${index}`} x={item.bbox[0]} y={item.bbox[1]} width={item.bbox[2]} height={item.bbox[3]} fill="none" stroke={color} strokeWidth={Math.max((detail.width || 1) / 300, 1)} />);
  return <div className="space-y-3 border-t pt-4">
    <h4 className="break-all font-medium">{summary.filename}</h4>
    {detail.error ? <p className="text-sm text-destructive">{detail.error}</p> : <>
      {typeof detail.actual === "string" && <p className="text-sm">{thai ? "จริง" : "Actual"}: <strong>{detail.actual}</strong> · {thai ? "ทำนาย" : "Predicted"}: <strong>{detail.predicted}</strong> {detail.confidence != null && `(${percent(detail.confidence)})`}</p>}
      {detail.actualMask && detail.predictedMask ? <div className="grid gap-4 sm:grid-cols-2">
        <MaskPreview source={source} mask={`${base}/masks/actual`} label={thai ? "ข้อมูลจริง" : "Ground truth"} />
        <MaskPreview source={source} mask={`${base}/masks/predicted`} label={thai ? "คำทำนาย" : "Prediction"} />
      </div> : <figure className="relative inline-block max-w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={source} alt={summary.filename} className="block max-h-[520px] max-w-full object-contain" />
        {Array.isArray(detail.actual) && detail.width && detail.height && <svg aria-label={thai ? "กรอบจริงสีเขียว กรอบทำนายสีฟ้า" : "Ground truth in green, predictions in blue"} className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${detail.width} ${detail.height}`} preserveAspectRatio="none">{boxes(detail.actual, "#4ade80")}{boxes((detail.predictions || []).filter((item) => (item.score ?? 0) >= .25), "#38bdf8")}</svg>}
      </figure>}
      {detail.actualMask && <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">{classes.map((item, index) => <span key={item.name} className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{item.name}</span>)}</div>}
      {Array.isArray(detail.actual) && <p className="text-xs text-muted-foreground">{thai ? "เขียว: ข้อมูลจริง · ฟ้า: คำทำนาย confidence ≥ 0.25" : "Green: ground truth · Blue: predictions with confidence ≥ 0.25"}</p>}
    </>}
  </div>;
}

export function EvaluationPanel({ runSlug, modelType, taskType }: { runSlug: string; modelType: string; taskType: string }) {
  const { language } = useLanguage(); const thai = language === "th";
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]), [selected, setSelected] = useState("");
  const [current, setCurrent] = useState<Evaluation | null>(null), [datasets, setDatasets] = useState<Dataset[]>([]), [dataset, setDataset] = useState("");
  const [execution, setExecution] = useState<ExecutionSelection>({ mode: "auto" });
  const [filter, setFilter] = useState("all"), [offset, setOffset] = useState(0), [images, setImages] = useState<ImageSummary[]>([]), [total, setTotal] = useState(0);
  const [image, setImage] = useState<ImageSummary | null>(null), [detail, setDetail] = useState<ImageDetail | null>(null);
  const [error, setError] = useState(""), [submitting, setSubmitting] = useState(false);
  const key = useRef<string | null>(null);
  const imageRequest = useRef(0);

  const applyEvaluations = useCallback((data: Evaluation[]) => {
    setEvaluations(data);
    setSelected((previous) => previous || data[0]?.id || "");
  }, []);
  const refresh = useCallback(async () => {
    applyEvaluations(await loadEvaluations(runSlug, thai));
  }, [applyEvaluations, runSlug, thai]);
  useEffect(() => {
    const controller = new AbortController();
    loadEvaluations(runSlug, thai, controller.signal).then((data) => { if (!controller.signal.aborted) applyEvaluations(data); })
      .catch((caught) => { if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : ""); });
    return () => controller.abort();
  }, [applyEvaluations, runSlug, thai]);
  useEffect(() => {
    if (!evaluations.some((item) => ACTIVE.has(item.status))) return;
    let cancelled = false; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === "visible") {
        try { await refresh(); } catch (caught) { if (!cancelled) setError(caught instanceof Error ? caught.message : ""); }
      }
      if (!cancelled) timer = setTimeout(poll, 5000);
    };
    timer = setTimeout(poll, 5000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [evaluations, refresh]);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/datasets`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setDatasets((data.datasets ?? []).filter((item: Dataset) => item.compatibleModels?.some((model) => model.id === modelType && model.ready)))).catch(() => undefined);
    return () => controller.abort();
  }, [modelType]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    fetch(`${API}/api/evaluations/${selected}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()).then(setCurrent).catch(() => { if (!controller.signal.aborted) setError(thai ? "โหลดรายละเอียดไม่สำเร็จ" : "Could not load evaluation details."); });
    return () => controller.abort();
  }, [selected, evaluations, thai]);
  useEffect(() => {
    if (!selected || !["completed", "partial"].includes(current?.status ?? "")) return;
    const controller = new AbortController();
    const query = new URLSearchParams({ outcome: filter, offset: String(offset), limit: "48", sort: taskType === "segmentation" && modelType === "deeplabv3plus" ? "score" : "ordinal" });
    fetch(`${API}/api/evaluations/${selected}/images?${query}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()).then((data) => { setImages(data.images); setTotal(data.total); }).catch(() => { if (!controller.signal.aborted) setError(thai ? "โหลดรายการภาพไม่สำเร็จ" : "Could not load images."); });
    return () => controller.abort();
  }, [selected, current?.status, filter, offset, taskType, modelType, thai]);
  const inspect = async (item: ImageSummary) => {
    const request = ++imageRequest.current;
    setImage(item); setDetail(null);
    try { const response = await fetch(`${API}/api/evaluations/${selected}/images/${item.ordinal}`); if (!response.ok) throw new Error(); const result = await response.json(); if (request === imageRequest.current) setDetail(result); }
    catch { if (request === imageRequest.current) setError(thai ? "โหลดภาพประเมินไม่สำเร็จ" : "Could not load the image result."); }
  };
  const submit = async () => {
    if (!dataset || submitting) return;
    setSubmitting(true); setError("");
    try {
      key.current ??= Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
      const response = await fetch(`${API}/api/runs/${encodeURIComponent(runSlug)}/evaluations`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": key.current }, body: JSON.stringify({ datasetVersionId: dataset, execution }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || (thai ? "ส่งงานไม่สำเร็จ" : "Could not start evaluation."));
      key.current = null; setSelected(data.id); await refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : (thai ? "ส่งงานไม่สำเร็จ" : "Could not start evaluation.")); }
    finally { setSubmitting(false); }
  };
  const currentMetrics = current?.report?.metrics;
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><Target className="h-5 w-5" />{thai ? "ประเมินชุดทดสอบ" : "Test-set evaluation"}</CardTitle></CardHeader><CardContent className="space-y-4">
    <div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><label htmlFor="evaluation-dataset" className="text-sm font-medium">{thai ? "ชุดข้อมูลเวอร์ชันที่ต้องการประเมิน" : "Dataset version"}</label><Select value={dataset} onValueChange={(value) => { setDataset(value); key.current = null; }}><SelectTrigger id="evaluation-dataset"><SelectValue placeholder={thai ? "เลือกชุดข้อมูล" : "Select a dataset"} /></SelectTrigger><SelectContent>{datasets.map((item) => <SelectItem key={item.id} value={item.id}>{item.collectionName || item.name}{item.version ? ` v${item.version}` : ""}</SelectItem>)}</SelectContent></Select></div><ExecutionSelector value={execution} onChange={(value) => { setExecution(value); key.current = null; }} disabled={submitting} /></div>
    <Button onClick={submit} disabled={!dataset || submitting}><Target className="h-4 w-4" />{thai ? "เริ่มประเมิน" : "Evaluate"}</Button>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {evaluations.length > 0 && <div className="space-y-2 border-t pt-4"><label htmlFor="evaluation-select" className="text-sm font-medium">{thai ? "ผลประเมิน" : "Evaluations"}</label><Select value={selected} onValueChange={(value) => { imageRequest.current += 1; setSelected(value); setCurrent(null); setImages([]); setImage(null); setOffset(0); setFilter("all"); }}><SelectTrigger id="evaluation-select"><SelectValue /></SelectTrigger><SelectContent>{evaluations.map((item) => <SelectItem key={item.id} value={item.id}>{item.datasetName}{item.datasetVersion ? ` v${item.datasetVersion}` : ""} · {new Date(item.createdAt).toLocaleString(thai ? "th-TH" : "en-US")} · {statusLabel(item.status, thai)}</SelectItem>)}</SelectContent></Select></div>}
    {current && <div className="space-y-3"><div className="flex flex-wrap items-center gap-3 text-sm"><span role="status">{thai ? "สถานะ" : "Status"}: {statusLabel(current.status, thai)}</span>{ACTIVE.has(current.status) ? <Button variant="outline" size="sm" onClick={async () => { const response = await fetch(`${API}/api/evaluations/${current.id}/cancel`, { method: "POST" }); if (response.ok) await refresh(); else setError(thai ? "ยกเลิกไม่สำเร็จ" : "Could not cancel evaluation."); }}><X className="h-4 w-4" />{thai ? "ยกเลิก" : "Cancel"}</Button> : <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" size="icon" title={thai ? "ลบผลประเมิน" : "Delete evaluation"} aria-label={thai ? "ลบผลประเมิน" : "Delete evaluation"}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{thai ? "ลบผลประเมินนี้?" : "Delete this evaluation?"}</AlertDialogTitle><AlertDialogDescription>{thai ? "ผลประเมินและรายละเอียดภาพจะถูกลบ โดยไม่กระทบโมเดลหรือ dataset" : "The result and image details will be removed. The model and dataset will not be changed."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{thai ? "ยกเลิก" : "Cancel"}</AlertDialogCancel><AlertDialogAction onClick={async () => { try { const response = await fetch(`${API}/api/evaluations/${current.id}`, { method: "DELETE" }); if (!response.ok) throw new Error(); setSelected(""); setCurrent(null); setImage(null); await refresh(); } catch { setError(thai ? "ลบผลประเมินไม่สำเร็จ" : "Could not delete the evaluation."); } }}>{thai ? "ลบ" : "Delete"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div>
      {current.error && <p className="text-sm text-destructive">{current.error}</p>}
      {current.status === "no_test" && <p className="text-sm text-muted-foreground">{thai ? "ไม่มีชุดทดสอบใน dataset เวอร์ชันนี้" : "This dataset version has no test split."}</p>}
      {current.report && <p className="text-sm text-muted-foreground">{thai ? "ประเมิน" : "Evaluated"}: {current.report.evaluated} · {thai ? "ข้าม" : "Skipped"}: {current.report.skipped}{!current.report.sourceVerified && ` · ${thai ? "ไม่ยืนยันเนื้อหาชุดข้อมูลย้อนหลัง" : "Dataset contents were not historically verified"}`}</p>}
      {currentMetrics && <>{currentMetrics.boxes ? <MetricsTable data={currentMetrics.boxes} title="Bounding boxes" thai={thai} /> : <MetricsTable data={currentMetrics} title={thai ? "ผลรวม" : "Results"} thai={thai} />}{currentMetrics.masks && <MetricsTable data={currentMetrics.masks} title="Instance masks" thai={thai} />}</>}
      {["completed", "partial"].includes(current.status) && <section className="space-y-3 border-t pt-4"><div className="flex flex-wrap items-center gap-3"><h4 className="font-medium">{thai ? "ตรวจภาพ" : "Review images"}</h4><Select value={filter} onValueChange={(value) => { setFilter(value); setOffset(0); setImage(null); }}><SelectTrigger className="w-48"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{thai ? "ทั้งหมด" : "All"}</SelectItem><SelectItem value="incorrect">{thai ? "ทำนายผิด" : "Incorrect"}</SelectItem><SelectItem value="error">{thai ? "ข้าม" : "Skipped"}</SelectItem>{(taskType === "object_detection" || modelType === "mask_rcnn") && <><SelectItem value="fp">False positive</SelectItem><SelectItem value="fn">False negative</SelectItem></>}</SelectContent></Select><span className="text-sm text-muted-foreground">{total} {thai ? "ภาพ" : "images"}</span></div>
        <div className="divide-y border-y">{images.map((item) => <button type="button" key={item.ordinal} onClick={() => void inspect(item)} className="flex w-full items-center justify-between gap-3 p-2 text-left text-sm hover:bg-accent"><span className="break-all">{item.filename}</span><span className="shrink-0 text-muted-foreground">{modelType === "deeplabv3plus" && item.score != null ? `IoU ${percent(item.score)}` : statusLabel(item.outcome, thai)}</span></button>)}</div>
        <div className="flex items-center gap-2"><Button variant="outline" size="icon" onClick={() => setOffset(Math.max(0, offset - 48))} disabled={!offset} aria-label={thai ? "หน้าก่อน" : "Previous page"}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">{total ? offset + 1 : 0}–{Math.min(offset + 48, total)} / {total}</span><Button variant="outline" size="icon" onClick={() => setOffset(offset + 48)} disabled={offset + 48 >= total} aria-label={thai ? "หน้าถัดไป" : "Next page"}><ChevronRight className="h-4 w-4" /></Button></div>
        {image && detail && <ImageReview evaluationId={current.id} summary={image} detail={detail} classes={modelType === "deeplabv3plus" ? (currentMetrics?.classes ?? []).slice(1) : currentMetrics?.masks?.classes ?? []} thai={thai} />}
      </section>}
    </div>}
    {!evaluations.length && <p className="text-sm text-muted-foreground">{thai ? "ยังไม่มีผลประเมิน" : "No evaluations yet."}</p>}
    <Button variant="ghost" size="sm" onClick={() => void refresh()}><RefreshCw className="h-4 w-4" />{thai ? "รีเฟรช" : "Refresh"}</Button>
  </CardContent></Card>;
}
