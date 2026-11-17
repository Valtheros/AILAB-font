"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, ExternalLink, LoaderCircle, Pencil, Plus, RefreshCw, Rocket, Trash2, Square, Check, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { useLanguage } from "@/components/language-provider";
import { appJSON, appRequest, type ModelApp } from "@/lib/model-apps";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { RunSetup } from "./run-setup";

export function AppManager() {
  const { language } = useLanguage(); const thai = language === "th";
  const [apps, setApps] = useState<ModelApp[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const request = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    try { const data = await appRequest<{ apps: ModelApp[] }>('/api/model-apps', thai, { signal: controller.signal }); if (!controller.signal.aborted) { setApps(data.apps); setError(""); } }
    catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Request failed"); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [thai]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- State changes follow the asynchronous server response.
  useEffect(() => { void load(); const refresh = () => { void load(); }; window.addEventListener('focus', refresh); return () => { request.current?.abort(); window.removeEventListener('focus', refresh); }; }, [load]);
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="border-b pb-5"><h1 className="text-2xl font-semibold">Model Apps</h1></header>
    <Tabs defaultValue="apps" className="min-w-0 gap-6">
      <TabsList aria-label={thai ? "การใช้งานโมเดล" : "Model access"}><TabsTrigger value="apps"><Rocket className="h-4 w-4" />Model Apps</TabsTrigger><TabsTrigger value="api"><KeyRound className="h-4 w-4" />API</TabsTrigger></TabsList>
      <TabsContent value="apps" className="min-w-0 space-y-5">
        <Dialog open={creating} onOpenChange={setCreating}>
          <div className="flex items-center justify-between gap-3"><DialogTrigger asChild><Button><Plus className="h-4 w-4" />{thai ? "สร้าง Model App" : "Create Model App"}</Button></DialogTrigger><Button size="icon" variant="outline" aria-label={thai ? "รีเฟรชแอป" : "Refresh apps"} title={thai ? "รีเฟรชแอป" : "Refresh apps"} onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button></div>
          <DialogContent className="max-h-[90dvh] overflow-y-auto" aria-describedby={undefined}><DialogHeader><DialogTitle>{thai ? "สร้าง Model App" : "Create Model App"}</DialogTitle></DialogHeader><RunSetup mode="app" thai={thai} onDone={() => { setCreating(false); void load(); }} /></DialogContent>
        </Dialog>
        {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
        {loading ? <p role="status" className="flex items-center gap-2 text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" />{thai ? "กำลังโหลดแอป" : "Loading apps"}</p> : !error && apps.length === 0 ? <div className="space-y-4 py-12 text-center"><Rocket className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="text-lg font-medium">{thai ? "ยังไม่มี Model App" : "No Model Apps yet"}</h2></div> : <div className="divide-y">{apps.map(app => <AppRow key={app.id} app={app} thai={thai} refresh={load} />)}</div>}
      </TabsContent>
      <TabsContent value="api" className="min-w-0 max-w-3xl"><RunSetup mode="api" thai={thai} onDone={() => {}} /></TabsContent>
    </Tabs>
  </div>;
}

function AppRow({ app, thai, refresh }: { app: ModelApp; thai: boolean; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [editing, setEditing] = useState(false), [copied, setCopied] = useState(false);
  const [name, setName] = useState(app.name), [description, setDescription] = useState(app.description);
  const act = async (method: string, body?: unknown) => {
    setBusy(true); setError("");
    try { await appRequest(`/api/model-apps/${app.id}`, thai, body ? appJSON(method, body) : { method }); setEditing(false); await refresh(); }
    catch (error) { setError(error instanceof Error ? error.message : "Request failed"); }
    finally { setBusy(false); }
  };
  return <section className="space-y-4 py-6 first:pt-0">
    <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 space-y-1"><h2 className="break-words text-lg font-semibold">{app.name}</h2><p className="break-words text-sm text-muted-foreground">{app.description}</p><p className="text-sm">{app.published ? (thai ? `เผยแพร่แล้ว · v${app.activeVersion}` : `Published · v${app.activeVersion}`) : (thai ? "ยังไม่เผยแพร่" : "Unpublished")}</p></div><div className="flex shrink-0 gap-2">
      <Button variant="outline" size="icon" title={thai ? "แก้ไขชื่อและคำอธิบาย" : "Edit name and description"} aria-label={thai ? "แก้ไขชื่อและคำอธิบาย" : "Edit name and description"} disabled={busy} onClick={() => { setName(app.name); setDescription(app.description); setEditing(true); }}><Pencil className="h-4 w-4" /></Button>
      {app.published && <Button variant="outline" disabled={busy} onClick={() => void act('PATCH', { published: false })}><Square className="h-4 w-4" />{thai ? "ปิดเผยแพร่" : "Unpublish"}</Button>}
      {!app.published && <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" size="icon" disabled={busy || !!app.usage?.pending} title={thai ? "ลบแอป" : "Delete app"} aria-label={thai ? "ลบแอป" : "Delete app"}><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{thai ? "ลบแอปนี้?" : "Delete this app?"}</AlertDialogTitle><AlertDialogDescription>{thai ? "ลิงก์แอปจะใช้งานไม่ได้ โมเดลและผล Train ไม่ถูกลบ ผลทำนายเดิมเก็บจนหมดอายุ" : "The app link will stop working. Models and training results are not deleted. Existing predictions remain until expiry."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{thai ? "ยกเลิก" : "Cancel"}</AlertDialogCancel><AlertDialogAction onClick={() => void act('DELETE')}>{thai ? "ลบแอป" : "Delete app"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
    </div></div>
    <div className="flex min-w-0 items-center gap-2"><code className="min-w-0 flex-1 break-all text-xs text-muted-foreground">{app.path}</code><Button size="icon" variant="ghost" disabled={!app.published} aria-label={thai ? "คัดลอกลิงก์" : "Copy link"} title={thai ? "คัดลอกลิงก์" : "Copy link"} onClick={() => void navigator.clipboard.writeText(`${window.location.origin}${app.path}`).then(() => setCopied(true)).catch(() => setError(thai ? "คัดลอกไม่สำเร็จ" : "Could not copy link"))}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button>{app.published && <Button asChild variant="ghost" size="icon" title={thai ? "เปิดแอป" : "Open app"}><Link href={app.path} aria-label={thai ? "เปิดแอป" : "Open app"}><ExternalLink className="h-4 w-4" /></Link></Button>}</div>
    {app.usage && <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm">{[[thai ? 'งานทั้งหมด' : 'Requests', app.usage.requests], [thai ? 'สำเร็จ' : 'Completed', app.usage.completed], [thai ? 'ไม่สำเร็จ' : 'Failed', app.usage.failed], [thai ? 'กำลังรอ/ทำงาน' : 'Pending', app.usage.pending], [thai ? 'เวลารอเฉลี่ย (วินาที)' : 'Average queue (seconds)', app.usage.averageQueueSeconds ?? '-']].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{value}</dd></div>)}</dl>}
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-b text-muted-foreground"><tr><th className="py-2 pr-4 font-medium">{thai ? "เวอร์ชัน" : "Version"}</th><th className="px-2 font-medium">{thai ? "ทดสอบ" : "Preview test"}</th><th className="py-2 pl-2 text-right font-medium">{thai ? "การเผยแพร่" : "Publication"}</th></tr></thead><tbody>{app.releases?.map(release => <tr key={release.version} className="border-b last:border-0"><td className="py-3 pr-4 align-top"><p className="font-medium">v{release.version}{app.activeVersion === release.version && app.published ? (thai ? ' · ปัจจุบัน' : ' · Current') : ''}</p><p className="max-w-52 break-all text-xs text-muted-foreground">{release.runSlug}</p></td><td className="px-2"><Button asChild size="sm" variant="outline"><Link href={`${app.path}?version=${release.version}`}><ExternalLink className="h-4 w-4" />{thai ? "ทดสอบ" : "Preview"}</Link></Button><p className="mt-1 text-xs text-muted-foreground">{release.testedAt ? (thai ? 'ผ่านแล้ว' : 'Passed') : (thai ? 'ยังไม่ทดสอบ' : 'Not tested')}</p></td><td className="py-3 pl-2 text-right"><Button size="sm" disabled={busy || !release.testedAt || (app.published && app.activeVersion === release.version)} onClick={() => void act('PATCH', { published: true, version: release.version })}><Rocket className="h-4 w-4" />{thai ? "ใช้เวอร์ชันนี้" : "Publish version"}</Button></td></tr>)}</tbody></table></div>
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    <Dialog open={editing} onOpenChange={setEditing}><DialogContent aria-describedby={undefined}><DialogHeader><DialogTitle>{thai ? "แก้ไขแอป" : "Edit app"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={event => { event.preventDefault(); void act('PATCH', { name, description }); }}><div className="space-y-2"><label htmlFor={`name-${app.id}`}>{thai ? 'ชื่อแอป' : 'App name'}</label><Input id={`name-${app.id}`} maxLength={100} value={name} onChange={e => setName(e.target.value)} required /></div><div className="space-y-2"><label htmlFor={`description-${app.id}`}>{thai ? 'คำอธิบาย' : 'Description'}</label><textarea id={`description-${app.id}`} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" /></div><Button disabled={busy || !name.trim()} type="submit">{thai ? 'บันทึก' : 'Save'}</Button>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}</form></DialogContent></Dialog>
  </section>;
}
