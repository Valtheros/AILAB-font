"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Images, LoaderCircle, RefreshCw, Search, TriangleAlert } from "lucide-react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/workspace/loading-state";
import { useLanguage } from "@/components/language-provider";
import { apiBaseUrl } from "@/lib/api";

const API = apiBaseUrl();
const COLORS = ["#f87171", "#38bdf8", "#4ade80", "#facc15", "#c084fc", "#fb923c", "#22d3ee"];
type ClassStat = { images: number; objects: number; pixels: number };
type SplitStat = { images: number; pixels: number; classes: Record<string, ClassStat> };
type Details = { id: string; name: string; version?: number | null; contentSha256?: string | null; index: { status: string; total: number; processed: number; skipped: number; ready: boolean; error?: string | null; stats: Record<string, SplitStat> } };
type Summary = { ordinal: number; filename: string; split: string; classes: string[]; hasObjects: boolean };
type ObjectLabel = { className: string; bbox: number[]; segmentation?: number[][] | object | null };
type ImageInfo = { ordinal: number; filename: string; split: string; width: number; height: number; annotations: { kind: string; className?: string; objects?: ObjectLabel[]; mask?: boolean; maskUnavailable?: boolean; classes?: { id: number; name: string }[] } };
type Duplicate = { hash: string; count: number; images: { filename: string; split: string; ordinal: number }[] };

function Preview({ base, image, thai }: { base: string; image: ImageInfo; thai: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!image.annotations.mask) return;
    let cancelled = false;
    const load = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => { const element = new Image(); element.onload = () => resolve(element); element.onerror = reject; element.src = src; });
    Promise.all([load(`${base}/source`), load(`${base}/mask`)]).then(([source, mask]) => {
      if (cancelled || !canvas.current) return;
      const scale = Math.min(1, 1024 / Math.max(source.width, source.height));
      const width = Math.max(1, Math.round(source.width * scale)), height = Math.max(1, Math.round(source.height * scale));
      const display = canvas.current; display.width = width; display.height = height;
      const context = display.getContext("2d"); if (!context) return;
      context.drawImage(source, 0, 0, width, height);
      const layer = document.createElement("canvas"); layer.width = width; layer.height = height;
      const paint = layer.getContext("2d", { willReadFrequently: true }); if (!paint) return;
      paint.imageSmoothingEnabled = false; paint.drawImage(mask, 0, 0, width, height);
      const pixels = paint.getImageData(0, 0, width, height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const id = pixels.data[index];
        if (id === 0 || id === 255) { pixels.data[index + 3] = 0; continue; }
        const color = COLORS[(id - 1) % COLORS.length];
        pixels.data[index] = parseInt(color.slice(1, 3), 16); pixels.data[index + 1] = parseInt(color.slice(3, 5), 16);
        pixels.data[index + 2] = parseInt(color.slice(5, 7), 16); pixels.data[index + 3] = 130;
      }
      paint.putImageData(pixels, 0, 0); context.drawImage(layer, 0, 0);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [base, image.annotations.mask]);
  return <div className="space-y-3"><div className="relative inline-block max-w-full">
    {image.annotations.mask ? <canvas ref={canvas} className="block h-auto max-h-[55vh] max-w-full" aria-label={thai ? "ภาพพร้อม mask" : "Image with mask"} /> : <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/source`} alt={image.filename} className="block max-h-[55vh] max-w-full object-contain" />
    </>}
    {image.annotations.objects && <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${image.width} ${image.height}`} preserveAspectRatio="none" aria-label={thai ? "กรอบ label" : "Label boxes"}>{image.annotations.objects.map((object, index) => <rect key={index} x={object.bbox[0]} y={object.bbox[1]} width={object.bbox[2]} height={object.bbox[3]} fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth={Math.max(image.width / 300, 1)} />)}</svg>}
  </div>
  {image.annotations.className && <p className="text-sm">Class: <strong>{image.annotations.className}</strong></p>}
  {image.annotations.maskUnavailable && <p className="text-sm text-amber-600 dark:text-amber-400">{thai ? "บางวัตถุไม่มี mask ที่ใช้แสดงได้" : "A mask is unavailable for one or more objects."}</p>}
  {image.annotations.classes && <div className="flex flex-wrap gap-3 text-xs">{image.annotations.classes.filter((item) => item.id > 0).map((item) => <span key={item.id} className="flex items-center gap-1"><span className="h-2.5 w-2.5" style={{ backgroundColor: COLORS[(item.id - 1) % COLORS.length] }} />{item.name}</span>)}</div>}
  {image.annotations.objects && <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">{image.annotations.objects.map((object, index) => <li key={index} className="flex items-center gap-2"><span className="h-2.5 w-2.5" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{object.className}</li>)}</ul>}
  </div>;
}

export default function DatasetDetailsPage() {
  const { datasetId } = useParams<{ datasetId: string }>();
  const { language } = useLanguage(); const thai = language === "th";
  const [details, setDetails] = useState<Details | null>(null), [error, setError] = useState("");
  const [split, setSplit] = useState("all"), [status, setStatus] = useState("all"), [className, setClassName] = useState("__all__"), [sort, setSort] = useState("name");
  const [query, setQuery] = useState(""), [search, setSearch] = useState(""), [offset, setOffset] = useState(0);
  const [listing, setListing] = useState<{ key: string; images: Summary[]; total: number }>({ key: "", images: [], total: 0 });
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [duplicateOffset, setDuplicateOffset] = useState(0), [duplicateTotal, setDuplicateTotal] = useState(0);
  const [expandedHash, setExpandedHash] = useState(""), [duplicateImageOffset, setDuplicateImageOffset] = useState(0);
  const [duplicateImages, setDuplicateImages] = useState<Duplicate["images"]>([]), [duplicateImageTotal, setDuplicateImageTotal] = useState(0);
  const [selected, setSelected] = useState<Summary | null>(null), [image, setImage] = useState<ImageInfo | null>(null);
  const [imageError, setImageError] = useState("");
  const [loadingIndex, setLoadingIndex] = useState(false);
  const base = `${API}/api/dataset-versions/${encodeURIComponent(datasetId)}`;
  const listingKey = JSON.stringify([base, split, status, className, search, sort, offset]);
  const loadingImages = Boolean(details?.index.ready && (listing.key !== listingKey || query !== search));
  const images = loadingImages ? [] : listing.images;
  const total = loadingImages ? 0 : listing.total;

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(base, { signal, cache: "no-store" });
    if (!response.ok) throw new Error(thai ? "โหลดข้อมูล dataset ไม่สำเร็จ" : "Could not load the dataset.");
    const data = await response.json(); if (!signal?.aborted) setDetails(data); return data as Details;
  }, [base, thai]);
  const start = useCallback(async (signal?: AbortSignal) => {
    setLoadingIndex(true); setError("");
    try { const response = await fetch(`${base}/index`, { method: "POST", signal }); if (!response.ok) throw new Error(); await refresh(signal); }
    catch { if (!signal?.aborted) setError(thai ? "เริ่มเตรียมข้อมูลไม่สำเร็จ" : "Could not prepare dataset details."); }
    finally { if (!signal?.aborted) setLoadingIndex(false); }
  }, [base, refresh, thai]);
  const retryLoading = async () => {
    setError("");
    try { const data = await refresh(); if (['not_started', 'failed'].includes(data.index.status)) await start(); }
    catch { setError(thai ? "โหลดข้อมูล dataset ไม่สำเร็จ" : "Could not load the dataset."); }
  };
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try { const data = await refresh(controller.signal); if (data.index.status === "not_started") await start(controller.signal); }
      catch { if (!controller.signal.aborted) setError(thai ? "โหลดข้อมูล dataset ไม่สำเร็จ" : "Could not load the dataset."); }
    };
    void load(); return () => { controller.abort(); };
  }, [refresh, start, thai]);
  useEffect(() => {
    if (!details || !['queued', 'running'].includes(details.index.status)) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (document.visibilityState === "visible") {
        try { await refresh(controller.signal); } catch { if (!controller.signal.aborted) setError(thai ? "โหลดข้อมูล dataset ไม่สำเร็จ" : "Could not load the dataset."); }
      }
      if (!controller.signal.aborted) timer = setTimeout(poll, 5000);
    };
    timer = setTimeout(poll, 5000);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [details, refresh, thai]);
  useEffect(() => { const timer = setTimeout(() => setSearch(query), 350); return () => clearTimeout(timer); }, [query]);
  useEffect(() => {
    if (!details?.index.ready) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ split, status, search, sort, offset: String(offset), limit: "48" });
    if (className !== "__all__") params.set("className", className.slice(6));
    fetch(`${base}/images?${params}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()).then((data) => { if (!controller.signal.aborted) setListing({ key: listingKey, images: data.images, total: data.total }); }).catch(() => { if (!controller.signal.aborted) { setListing({ key: listingKey, images: [], total: 0 }); setError(thai ? "โหลดภาพไม่สำเร็จ" : "Could not load images."); } });
    return () => controller.abort();
  }, [base, details?.index.ready, split, status, className, search, sort, offset, thai, listingKey]);
  useEffect(() => {
    if (!details?.index.ready) return;
    const controller = new AbortController();
    fetch(`${base}/duplicates?offset=${duplicateOffset}&limit=20`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()).then((data) => { setDuplicates(data.groups ?? []); setDuplicateTotal(data.total ?? 0); }).catch(() => undefined);
    return () => controller.abort();
  }, [base, details?.index.ready, duplicateOffset]);
  useEffect(() => {
    if (!expandedHash) return;
    const controller = new AbortController();
    fetch(`${base}/duplicates/${expandedHash}?offset=${duplicateImageOffset}&limit=48`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { setDuplicateImages(data.images ?? []); setDuplicateImageTotal(data.total ?? 0); })
      .catch(() => { if (!controller.signal.aborted) setError(thai ? "โหลดรายการภาพซ้ำไม่สำเร็จ" : "Could not load duplicate images."); });
    return () => controller.abort();
  }, [base, expandedHash, duplicateImageOffset, thai]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    fetch(`${base}/images/${selected.ordinal}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()).then((data) => { if (!controller.signal.aborted) setImage(data); }).catch(() => { if (!controller.signal.aborted) setImageError(thai ? "โหลดรายละเอียดภาพไม่สำเร็จ" : "Could not load image details."); });
    return () => controller.abort();
  }, [base, selected, thai]);

  const stats: Record<string, ClassStat> = {};
  let totalPixels = 0;
  for (const [name, value] of Object.entries(details?.index.stats ?? {})) {
    if (split !== "all" && name !== split) continue;
    totalPixels += value.pixels;
    for (const [classKey, count] of Object.entries(value.classes)) {
      stats[classKey] ??= { images: 0, objects: 0, pixels: 0 };
      stats[classKey].images += count.images; stats[classKey].objects += count.objects; stats[classKey].pixels += count.pixels;
    }
  }
  const allClasses = Array.from(new Set(Object.values(details?.index.stats ?? {}).flatMap((value) => Object.keys(value.classes)))).sort();
  const change = (callback: () => void) => { callback(); setOffset(0); setSelected(null); setImage(null); };
  const openImage = (item: Summary) => { setSelected(item); setImage(null); setImageError(""); };
  return <MainLayout><div className="space-y-6">
    <Button asChild variant="ghost"><Link href="/dataset"><ArrowLeft className="h-4 w-4" />{thai ? "กลับไป Dataset" : "Back to datasets"}</Link></Button>
    <header className="border-b pb-4"><h1 className="break-words text-2xl font-semibold">{details?.name || (thai ? "รายละเอียด Dataset" : "Dataset details")}{details?.version ? ` · v${details.version}` : ""}</h1>{details?.contentSha256 ? <p className="mt-1 break-all text-xs text-muted-foreground">SHA-256: {details.contentSha256}</p> : details && <p className="mt-1 text-xs text-muted-foreground">{thai ? "ไม่ยืนยันเนื้อหาชุดข้อมูลย้อนหลัง" : "Historical dataset contents are not verified."}</p>}</header>
    {error && <div className="space-y-3"><p role="alert" className="text-sm text-destructive">{error}</p>{!details?.index.ready && <Button variant="outline" onClick={() => void retryLoading()}><RefreshCw className="h-4 w-4" />{thai ? "ลองใหม่" : "Retry"}</Button>}</div>}
    {!details && !error && <LoadingState icon={Images} title={thai ? "กำลังโหลดรายละเอียดชุดข้อมูล" : "Loading dataset details"} />}
    {details && !details.index.ready && !error && (details.index.status === "failed" ? <section className="flex min-h-64 flex-col items-center justify-center gap-4 px-4 py-10 text-center">
      <div role="alert" className="space-y-2"><TriangleAlert className="mx-auto h-6 w-6 text-destructive" /><p className="font-semibold">{thai ? "เตรียมข้อมูลไม่สำเร็จ" : "Could not prepare dataset details"}</p>{details.index.error && <p className="max-w-md break-words text-sm text-destructive">{details.index.error}</p>}</div>
      <Button variant="outline" disabled={loadingIndex} onClick={() => void start()}><RefreshCw className="h-4 w-4" />{thai ? "ลองใหม่" : "Retry"}</Button>
    </section> : <LoadingState icon={Images} title={thai ? "กำลังเตรียมรูปภาพ" : "Preparing images"}
      description={details.index.status === "queued" || details.index.status === "not_started"
        ? (thai ? "กำลังรอเริ่มประมวลผล" : "Waiting to start")
        : (thai ? "กำลังเตรียมรูปตัวอย่างและรายละเอียดภาพ" : "Preparing thumbnails and image details")}
      progress={{ current: details.index.processed, total: details.index.total, unit: thai ? "ภาพ" : "images", skipped: details.index.skipped, skippedLabel: thai ? "ข้าม" : "Skipped" }} />)}
    {details?.index.ready && <>
      <Tabs value={split} onValueChange={(value) => change(() => setSplit(value))}><TabsList className="h-auto flex-wrap">{[['all', thai ? 'ทั้งหมด' : 'All'], ['train', 'Train'], ['val', 'Validation'], ['test', 'Test']].map(([value, label]) => <TabsTrigger key={value} value={value}>{label} ({value === 'all' ? Object.values(details.index.stats).reduce((sum, item) => sum + item.images, 0) : details.index.stats[value]?.images ?? 0})</TabsTrigger>)}</TabsList></Tabs>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => change(() => setQuery(event.target.value))} className="pl-9" placeholder={thai ? "ค้นหาชื่อไฟล์" : "Search filename"} aria-label={thai ? "ค้นหาชื่อไฟล์" : "Search filename"} /></div>
        <Select value={className} onValueChange={(value) => change(() => setClassName(value))}><SelectTrigger aria-label={thai ? "กรอง class" : "Filter class"}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__all__">{thai ? "ทุก class" : "All classes"}</SelectItem>{allClasses.map((name) => <SelectItem key={name} value={`class:${name}`}>{name}</SelectItem>)}</SelectContent></Select>
        <Select value={status} onValueChange={(value) => change(() => setStatus(value))}><SelectTrigger aria-label={thai ? "กรองภาพ" : "Filter images"}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{thai ? "ทุกภาพ" : "All images"}</SelectItem><SelectItem value="empty">{thai ? "ไม่มีวัตถุ" : "No objects"}</SelectItem></SelectContent></Select>
        <Select value={sort} onValueChange={(value) => change(() => setSort(value))}><SelectTrigger aria-label={thai ? "เรียงลำดับ" : "Sort"}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="name">{thai ? "ชื่อไฟล์" : "Filename"}</SelectItem><SelectItem value="split">Split</SelectItem></SelectContent></Select>
      </div>
      <section className="space-y-3"><div className="flex justify-between text-sm"><h2 className="font-semibold">{thai ? "ภาพ" : "Images"}</h2><span className="text-muted-foreground">{loadingImages ? (thai ? "กำลังโหลด" : "Loading") : `${total} ${thai ? "ภาพ" : "images"}`}</span></div>{loadingImages && <div role="status" className="space-y-3"><p className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />{thai ? "กำลังโหลดภาพ" : "Loading images"}</p><div aria-hidden="true" className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">{Array.from({ length: 6 }, (_, index) => <div key={index} className="aspect-square rounded-md bg-muted motion-safe:animate-pulse" />)}</div></div>}<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">{images.map((item) => <button type="button" key={item.ordinal} className="min-w-0 overflow-hidden rounded-md border text-left hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring" onClick={() => openImage(item)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`${base}/images/${item.ordinal}/thumbnail`} alt="" loading="lazy" className="aspect-square w-full bg-muted object-contain" /><span className="block truncate px-2 pt-2 text-sm" title={item.filename}>{item.filename}</span><span className="block px-2 pb-2 text-xs text-muted-foreground">{item.split}</span></button>)}</div>
        <div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={loadingImages || !offset} onClick={() => setOffset(Math.max(0, offset - 48))} aria-label={thai ? "หน้าก่อน" : "Previous page"}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">{loadingImages ? (thai ? "กำลังโหลด" : "Loading") : `${total ? offset + 1 : 0}–${Math.min(offset + 48, total)} / ${total}`}</span><Button variant="outline" size="icon" disabled={loadingImages || offset + 48 >= total} onClick={() => setOffset(offset + 48)} aria-label={thai ? "หน้าถัดไป" : "Next page"}><ChevronRight className="h-4 w-4" /></Button></div>
      </section>
      <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">{thai ? "สถิติแยก class" : "Class statistics"}</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="p-2">Class</th><th className="p-2">{thai ? "ภาพ" : "Images"}</th><th className="p-2">{thai ? "วัตถุ" : "Objects"}</th><th className="p-2">Pixels</th><th className="p-2">% pixels</th></tr></thead><tbody>{Object.entries(stats).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => <tr key={name} className="border-b"><th className="p-2 font-medium">{name}</th><td className="p-2">{value.images.toLocaleString()}</td><td className="p-2">{value.objects.toLocaleString()}</td><td className="p-2">{value.pixels.toLocaleString()}</td><td className="p-2">{totalPixels ? `${(value.pixels / totalPixels * 100).toFixed(2)}%` : "—"}</td></tr>)}</tbody></table></div></section>
      {duplicateTotal > 0 && <section className="space-y-3 border-t pt-5"><h2 className="font-semibold">{thai ? "ภาพที่มี pixels ตรงกันข้าม split" : "Identical pixels across splits"}</h2><ul className="space-y-2 text-sm">{duplicates.map((group) => <li key={group.hash} className="break-words"><span className="font-medium">{group.count} {thai ? "ภาพ" : "images"}: </span>{group.images.slice(0, 3).map((item) => `${item.split}/${item.filename}`).join(", ")}{group.count > 3 && " …"} <Button variant="link" size="sm" onClick={() => { setExpandedHash(group.hash); setDuplicateImageOffset(0); }}>{thai ? "ดูทั้งหมด" : "View all"}</Button></li>)}</ul><div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={!duplicateOffset} onClick={() => { setExpandedHash(""); setDuplicateOffset(Math.max(0, duplicateOffset - 20)); }} aria-label={thai ? "กลุ่มก่อน" : "Previous duplicate groups"}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">{duplicateOffset + 1}–{Math.min(duplicateOffset + 20, duplicateTotal)} / {duplicateTotal}</span><Button variant="outline" size="icon" disabled={duplicateOffset + 20 >= duplicateTotal} onClick={() => { setExpandedHash(""); setDuplicateOffset(duplicateOffset + 20); }} aria-label={thai ? "กลุ่มถัดไป" : "Next duplicate groups"}><ChevronRight className="h-4 w-4" /></Button></div>
        {expandedHash && <div className="space-y-2 border-t pt-3"><ul className="space-y-1 text-sm">{duplicateImages.map((item) => <li key={item.ordinal}><button type="button" className="break-all text-left underline" onClick={() => openImage({ ...item, classes: [], hasObjects: true })}>{item.split}/{item.filename}</button></li>)}</ul><div className="flex items-center gap-2"><Button variant="outline" size="icon" disabled={!duplicateImageOffset} onClick={() => setDuplicateImageOffset(Math.max(0, duplicateImageOffset - 48))} aria-label={thai ? "ภาพก่อน" : "Previous duplicate images"}><ChevronLeft className="h-4 w-4" /></Button><span className="text-sm">{duplicateImageTotal ? duplicateImageOffset + 1 : 0}–{Math.min(duplicateImageOffset + 48, duplicateImageTotal)} / {duplicateImageTotal}</span><Button variant="outline" size="icon" disabled={duplicateImageOffset + 48 >= duplicateImageTotal} onClick={() => setDuplicateImageOffset(duplicateImageOffset + 48)} aria-label={thai ? "ภาพถัดไป" : "Next duplicate images"}><ChevronRight className="h-4 w-4" /></Button></div></div>}
      </section>}
      {details.index.skipped > 0 && <p className="text-sm text-amber-600 dark:text-amber-400">{thai ? "ภาพที่เปิดไม่ได้ถูกข้าม" : "Unreadable images were skipped"}: {details.index.skipped}</p>}
    </>}
    <Dialog open={selected !== null} onOpenChange={(open) => { if (!open) { setSelected(null); setImage(null); setImageError(""); } }}><DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto"><DialogHeader><DialogTitle className="break-all">{selected?.filename}</DialogTitle><DialogDescription>{selected?.split}</DialogDescription></DialogHeader>{selected && image && <Preview base={`${base}/images/${selected.ordinal}`} image={image} thai={thai} />}{selected && !image && !imageError && <LoadingState compact icon={Images} title={thai ? "กำลังโหลดรายละเอียดภาพ" : "Loading image details"} />}{selected && imageError && <p role="alert" className="text-sm text-destructive">{imageError}</p>}</DialogContent></Dialog>
  </div></MainLayout>;
}
