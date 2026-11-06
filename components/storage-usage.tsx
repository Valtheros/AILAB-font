"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HardDrive, RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/workspace/loading-state";
import { apiBaseUrl } from "@/lib/api";
import { computeMessage } from "@/lib/compute";
import { authClient } from "@/lib/auth-client";

type Usage = { usedBytes: number; limitBytes: number; reservedBytes: number; warning: string | null;
  breakdown: Record<string, number>; reconciledAt: string | null };
const gib = (bytes: number) => (bytes / 1024 ** 3).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function StorageUsage() {
  const { data: session } = authClient.useSession();
  return session?.user ? <OwnedStorageUsage key={session.user.id} /> : null;
}

function OwnedStorageUsage() {
  const { language } = useLanguage();
  const thai = language === "th";
  const [usage, setUsage] = useState<Usage | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const response = await fetch(`${apiBaseUrl()}/api/storage`, { signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(computeMessage(data.code, thai, thai ? "โหลดข้อมูลพื้นที่ไม่สำเร็จ" : "Storage information is unavailable"));
      if (!signal.aborted) { setUsage(data); setError(""); }
    } catch (error) {
      if (!signal.aborted) setError(error instanceof Error ? error.message : "Storage unavailable");
    }
  }, [thai]);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    const update = () => {
      if (!document.hidden && !pending) {
        pending = true;
        void load(controller.signal).finally(() => { pending = false; });
      }
    };
    update();
    const timer = setInterval(update, 30000);
    document.addEventListener("visibilitychange", update);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", update); };
  }, [load, refresh]);
  const categories: [string, string, string][] = [["datasets", "Datasets", "ชุดข้อมูล"], ["annotation", "Annotation images", "ภาพสำหรับ label"],
    ["runs", "Models and training files", "โมเดลและไฟล์เทรน"], ["evaluations", "Evaluations", "ผลประเมิน"],
    ["cache", "Thumbnails and caches", "ภาพย่อและแคช"], ["temporary", "Temporary files", "ไฟล์ชั่วคราว"]];
  return <section aria-labelledby="storage-heading" className="space-y-4 border-t py-6">
    <div className="flex items-center justify-between gap-3"><h2 id="storage-heading" className="flex items-center gap-2 text-lg font-semibold"><HardDrive className="size-5" />{thai ? "พื้นที่จัดเก็บ" : "Storage"}</h2>
      <Button variant="ghost" size="icon" aria-label={thai ? "รีเฟรชพื้นที่" : "Refresh storage"} onClick={() => setRefresh(value => value + 1)}><RefreshCw className="size-4" /></Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!usage && !error && <LoadingState icon={HardDrive} title={thai ? "กำลังตรวจพื้นที่" : "Checking storage"} />}
    {usage && <>
      <p className="text-sm"><span className="font-semibold">{gib(usage.usedBytes)}</span> / {gib(usage.limitBytes)} GiB</p>
      <div role="meter" aria-label={thai ? "พื้นที่ที่ใช้" : "Storage used"} aria-valuenow={Math.min(usage.usedBytes, usage.limitBytes)} aria-valuemin={0} aria-valuemax={usage.limitBytes} className="h-2 overflow-hidden rounded bg-muted">
        <div className={`h-full ${usage.warning === "full" || usage.warning === "critical" ? "bg-destructive" : "bg-primary"}`} style={{ width: `${Math.min(100, usage.usedBytes / usage.limitBytes * 100)}%` }} /></div>
      {usage.warning && <p role="status" className="text-sm text-destructive">{usage.warning === "full"
        ? (thai ? "พื้นที่เต็มแล้ว ยังอ่าน ดาวน์โหลด และลบข้อมูลได้ แต่ต้องเพิ่มพื้นที่ว่างก่อนเริ่มงานใหม่" : "Storage is full. Reading, downloading and deleting remain available; free space before starting new work.")
        : (thai ? "พื้นที่ใกล้เต็มแล้ว ลบข้อมูลที่ไม่ใช้หรือติดต่อผู้ดูแลเพื่อเพิ่มโควตา" : "Storage is nearly full. Remove unused data or ask an administrator to raise your quota.")}</p>}
      {usage.reservedBytes > 0 && <p className="text-sm text-muted-foreground">{thai ? "จองไว้สำหรับงานที่ยังเขียนไฟล์" : "Reserved for active writers"}: {gib(usage.reservedBytes)} GiB</p>}
      {usage.reconciledAt && <><dl className="divide-y">{categories.map(([key, en, th]) => <div key={key} className="flex justify-between gap-4 py-2 text-sm"><dt>{thai ? th : en}</dt><dd className="shrink-0 tabular-nums">{gib(usage.breakdown[key] || 0)} GiB</dd></div>)}</dl>
        <p className="text-xs text-muted-foreground">{thai ? "รายละเอียดแยกประเภท ณ" : "Category snapshot at"} {new Date(usage.reconciledAt).toLocaleString(thai ? "th-TH" : "en-GB")}</p></>}
      <div className="flex flex-wrap gap-4 text-sm"><Link href="/dataset" className="underline underline-offset-4">{thai ? "จัดการชุดข้อมูล" : "Manage datasets"}</Link><Link href="/tasks" className="underline underline-offset-4">{thai ? "จัดการงานเทรน" : "Manage runs"}</Link></div>
    </>}
  </section>;
}
