"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, HardDrive, RefreshCw, Save } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingState } from "@/components/workspace/loading-state";
import { apiBaseUrl } from "@/lib/api";
import { computeMessage } from "@/lib/compute";

type UserStorage = { id: string; email: string; state: string; limitBytes: number; usedBytes?: number };

export function StorageAdmin() {
  const { language } = useLanguage();
  const thai = language === "th";
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [data, setData] = useState<{ users: UserStorage[]; total: number } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`${apiBaseUrl()}/api/storage/admin?offset=${page * 50}`, { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(computeMessage(result.code, thai, thai ? "โหลดข้อมูลไม่สำเร็จ" : "Could not load storage"));
        if (!controller.signal.aborted) { setData(result); setError(""); }
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Request failed"); }
    }
    void load();
    return () => controller.abort();
  }, [page, refresh, thai]);
  async function save(user: UserStorage, value: number) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`${apiBaseUrl()}/api/storage/admin/${encodeURIComponent(user.id)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limitGiB: value }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(computeMessage(result.code, thai, thai ? "บันทึกไม่สำเร็จ" : "Could not save quota"));
      setData(current => current && ({ ...current, users: current.users.map(row => row.id === user.id ? { ...row, ...result } : row) }));
    } catch (error) { setError(error instanceof Error ? error.message : "Request failed"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"><h1 className="flex items-center gap-2 text-2xl font-semibold"><HardDrive />{thai ? "พื้นที่ผู้ใช้" : "User storage"}</h1><div className="flex gap-2">
      <Button asChild variant="outline"><Link href="/admin/users">{thai ? "ผู้ใช้" : "Users"}</Link></Button><Button variant="outline" size="icon" disabled={busy} aria-label={thai ? "รีเฟรช" : "Refresh"} onClick={() => setRefresh(value => value + 1)}><RefreshCw className="size-4" /></Button></div></header>
    <p className="text-sm text-muted-foreground">{thai ? "การลดโควตาไม่ลบไฟล์เดิม แต่จะจำกัดการเขียนไฟล์เพิ่มเมื่อพื้นที่เกินกำหนด" : "Lowering a quota does not delete existing files. It limits further writes when usage exceeds the quota."}</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!data && !error && <LoadingState icon={HardDrive} title={thai ? "กำลังโหลดพื้นที่ผู้ใช้" : "Loading user storage"} />}
    {data?.users.map(user => <form key={`${user.id}:${user.limitBytes}`} className="grid items-end gap-3 border-b py-4 sm:grid-cols-[minmax(0,1fr)_8rem_auto]" onSubmit={event => { event.preventDefault(); void save(user, Number(new FormData(event.currentTarget).get("limit"))); }}>
      <div className="min-w-0"><p className="break-all text-sm font-medium">{user.email}</p><p className="mt-1 text-sm text-muted-foreground">{user.usedBytes === undefined ? (thai ? "ยังไม่มีข้อมูลพื้นที่" : "Storage not initialized") : `${(user.usedBytes / 1024 ** 3).toFixed(2)} / ${user.limitBytes / 1024 ** 3} GiB`}</p></div>
      <label className="space-y-1 text-sm">{thai ? "โควตา (GiB)" : "Quota (GiB)"}<Input name="limit" type="number" min={1} max={1048576} step={1} required defaultValue={user.limitBytes / 1024 ** 3} disabled={busy || user.state !== "ready"} /></label>
      <Button type="submit" variant="outline" disabled={busy || user.state !== "ready"}><Save className="size-4" />{thai ? "บันทึก" : "Save"}</Button>
    </form>)}
    {data && data.total > 50 && <nav aria-label={thai ? "หน้าผู้ใช้" : "User pages"} className="flex items-center justify-end gap-3"><Button variant="outline" size="icon" disabled={busy || page === 0} aria-label={thai ? "หน้าก่อน" : "Previous page"} onClick={() => { setData(null); setPage(value => value - 1); }}><ChevronLeft className="size-4" /></Button><span className="text-sm">{page + 1} / {Math.ceil(data.total / 50)}</span><Button variant="outline" size="icon" disabled={busy || (page + 1) * 50 >= data.total} aria-label={thai ? "หน้าถัดไป" : "Next page"} onClick={() => { setData(null); setPage(value => value + 1); }}><ChevronRight className="size-4" /></Button></nav>}
  </div>;
}
