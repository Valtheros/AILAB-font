"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, LoaderCircle, Plus, ShieldOff, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/components/language-provider";
import { apiBaseUrl } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

const API = apiBaseUrl();
type Endpoint = { id: string; enabled: boolean; checkpointSha256: string };
type Key = { id: string; label: string; created_at: string; expires_at: string; revoked_at: string | null };

export function ModelApiPanel({ runSlug }: { runSlug: string }) {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  return userId ? <ModelApiPanelContent key={`${userId}:${runSlug}`} runSlug={runSlug} /> : null;
}

function ModelApiPanelContent({ runSlug }: { runSlug: string }) {
  const { language } = useLanguage(); const thai = language === "th";
  const [endpoint, setEndpoint] = useState<Endpoint | null>(null), [keys, setKeys] = useState<Key[]>([]);
  const [secret, setSecret] = useState(""), [label, setLabel] = useState(""), [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [connected, setConnected] = useState(false), [unavailable, setUnavailable] = useState(false), [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/api/model-endpoints?runSlug=${encodeURIComponent(runSlug)}`, { signal: controller.signal }).then(async (response) => {
      if (response.status === 503) { setUnavailable(true); return; }
      if (!response.ok) throw new Error();
      const data = await response.json(); setEndpoint(data.endpoints?.[0] ?? null); setConnected(true);
    }).catch(() => { if (!controller.signal.aborted) setError(thai ? "โหลด Model API ไม่สำเร็จ" : "Could not load Model API."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [runSlug, thai]);

  useEffect(() => {
    if (!endpoint) return;
    const controller = new AbortController();
    fetch(`${API}/api/model-endpoints/${endpoint.id}/keys`, { signal: controller.signal }).then((response) => response.ok ? response.json() : Promise.reject()).then((data) => setKeys(data.keys ?? [])).catch(() => { if (!controller.signal.aborted) setError(thai ? "โหลดรายการ key ไม่สำเร็จ" : "Could not load API keys."); });
    return () => controller.abort();
  }, [endpoint, thai]);

  const call = async (path: string, method: string, body?: unknown) => {
    const response = await fetch(`${API}${path}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    if (!response.ok) throw new Error(data.detail || (thai ? "ดำเนินการไม่สำเร็จ" : "Request failed."));
    return data;
  };
  const act = async (action: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await action(); } catch (caught) { setError(caught instanceof Error ? caught.message : (thai ? "ดำเนินการไม่สำเร็จ" : "Request failed.")); }
    finally { setBusy(false); }
  };
  const base = typeof window === "undefined" ? "" : window.location.origin;
  const example = endpoint ? `curl -X POST '${base}/api/v1/models/${endpoint.id}/predict' -H "Authorization: Bearer $AILAB_API_KEY" -H 'Idempotency-Key: example-request-1' -F 'file=@image.jpg' -F 'execution={"mode":"auto"}'` : "";
  return <Card><CardHeader><CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />{thai ? "ใช้งานผ่าน API" : "Use through API"}</CardTitle></CardHeader><CardContent className="space-y-4">
    {loading ? <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />{thai ? "กำลังโหลด" : "Loading"}</p> : unavailable ? <p className="text-sm text-muted-foreground">{thai ? "Model API ยังไม่พร้อมใช้งาน" : "Model API is not available yet."}</p> : <>
      {connected && !endpoint && <Button disabled={busy} onClick={() => void act(async () => { const data = await call('/api/model-endpoints', 'POST', { runSlug }); setEndpoint(data); })}><Plus className="h-4 w-4" />{thai ? "เปิด Model API" : "Enable Model API"}</Button>}
      {endpoint && <>
        <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">{endpoint.enabled ? (thai ? "เปิดรับงาน" : "Accepting jobs") : (thai ? "ปิดรับงาน" : "Not accepting jobs")}</p><p className="text-xs text-muted-foreground">{thai ? "ปิดรับงานใหม่ได้โดยงานเดิมยังทำต่อ" : "Turning off the endpoint does not stop existing jobs."}</p></div><Switch checked={endpoint.enabled} disabled={busy} aria-label={thai ? "เปิดรับงาน API" : "Accept API jobs"} onCheckedChange={(enabled) => void act(async () => { setEndpoint(await call(`/api/model-endpoints/${endpoint.id}`, 'PATCH', { enabled })); })} /></div>
        <p className="break-all text-xs text-muted-foreground">SHA-256: {endpoint.checkpointSha256}</p>
        <p className="break-all text-xs text-muted-foreground">Model ID: {endpoint.id}</p>
        {!endpoint.enabled && <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" size="sm" disabled={busy}><Trash2 className="h-4 w-4" />{thai ? "ลบ endpoint" : "Delete endpoint"}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{thai ? "ลบ endpoint นี้?" : "Delete this endpoint?"}</AlertDialogTitle><AlertDialogDescription>{thai ? "ต้องรอให้งานเดิมจบก่อน key ทั้งหมดจะใช้ไม่ได้ แต่โมเดลจะยังอยู่" : "Existing jobs must finish first. All keys will stop working, but the model will remain."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{thai ? "ยกเลิก" : "Cancel"}</AlertDialogCancel><AlertDialogAction onClick={() => void act(async () => { await call(`/api/model-endpoints/${endpoint.id}`, 'DELETE'); setEndpoint(null); setKeys([]); setSecret(""); })}>{thai ? "ลบ" : "Delete"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
        <div className="flex flex-wrap items-end gap-2 border-t pt-4"><div className="min-w-40 flex-1 space-y-1"><label className="text-sm font-medium" htmlFor="model-api-key-label">{thai ? "ชื่อ key" : "Key name"}</label><Input id="model-api-key-label" value={label} maxLength={100} onChange={(event) => setLabel(event.target.value)} /></div><Button disabled={busy} onClick={() => void act(async () => { const data = await call(`/api/model-endpoints/${endpoint.id}/keys`, 'POST', { label }); setSecret(data.secret); setCopied(false); setLabel(""); setKeys((previous) => [data.key, ...previous]); })}><Plus className="h-4 w-4" />{thai ? "สร้าง key" : "Create key"}</Button></div>
        {secret && <div className="space-y-2 border-l-2 border-amber-500 pl-3" role="status"><p className="text-sm font-medium">{thai ? "key นี้แสดงเพียงครั้งเดียว" : "This key is shown only once."}</p><div className="flex items-start gap-2"><code className="min-w-0 flex-1 break-all rounded border p-2 text-xs">{secret}</code><Button size="icon" variant="outline" aria-label={thai ? "คัดลอก key" : "Copy key"} title={thai ? "คัดลอก key" : "Copy key"} onClick={() => void navigator.clipboard.writeText(secret).then(() => setCopied(true)).catch(() => setError(thai ? "คัดลอกไม่สำเร็จ" : "Could not copy the key."))}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</Button></div><Button variant="ghost" size="sm" onClick={() => setSecret("")}>{thai ? "ปิด" : "Close"}</Button></div>}
        {keys.length > 0 && <div className="divide-y border-y">{keys.map((key) => <div key={key.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><div className="min-w-0"><p className="break-all font-medium">{key.label || key.id}</p><p className="text-xs text-muted-foreground">{key.revoked_at ? (thai ? "เพิกถอนแล้ว" : "Revoked") : `${thai ? "หมดอายุ" : "Expires"}: ${new Date(key.expires_at).toLocaleDateString(thai ? "th-TH" : "en-US")}`}</p></div>{!key.revoked_at && <AlertDialog><AlertDialogTrigger asChild><Button size="icon" variant="outline" disabled={busy} aria-label={thai ? "เพิกถอน key" : "Revoke key"} title={thai ? "เพิกถอน key" : "Revoke key"}><ShieldOff className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{thai ? "เพิกถอน key นี้?" : "Revoke this key?"}</AlertDialogTitle><AlertDialogDescription>{thai ? "key นี้จะส่งงานหรืออ่านผลผ่าน API ไม่ได้อีก" : "This key will no longer submit jobs or read results."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{thai ? "ยกเลิก" : "Cancel"}</AlertDialogCancel><AlertDialogAction onClick={() => void act(async () => { await call(`/api/model-endpoints/${endpoint.id}/keys/${key.id}/revoke`, 'POST'); setKeys((previous) => previous.map((item) => item.id === key.id ? { ...item, revoked_at: new Date().toISOString() } : item)); })}>{thai ? "เพิกถอน" : "Revoke"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}</div>)}</div>}
        <div className="space-y-2 border-t pt-4"><p className="text-sm font-medium">{thai ? "ตัวอย่างส่งภาพ" : "Example request"}</p><pre className="overflow-x-auto rounded border bg-muted p-3 text-xs"><code>{example}</code></pre><p className="text-xs text-muted-foreground">{thai ? "งานเข้าคิวและคืน job ID สำหรับติดตามผล ไม่ใช่คำตอบทันที" : "Requests are queued and return a job ID, not an immediate prediction."}</p></div>
      </>}
    </>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </CardContent></Card>;
}
