"use client";

import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectContent, SelectValue, SelectItem } from "@/components/ui/select";
import { appJSON, appRequest, type ModelApp } from "@/lib/model-apps";

export function PublishForm({ runSlug, taskType, thai, onDone }: { runSlug: string; taskType?: string; thai: boolean; onDone: () => void }) {
  const [apps, setApps] = useState<ModelApp[]>([]), [target, setTarget] = useState("new");
  const [name, setName] = useState(""), [slug, setSlug] = useState(""), [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    appRequest<{ apps: ModelApp[] }>('/api/model-apps', thai, { signal: controller.signal }).then(data => setApps(data.apps))
      .catch(error => { if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [thai]);
  return <form className="space-y-4" onSubmit={async event => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await appRequest(target === "new" ? '/api/model-apps' : `/api/model-apps/${target}/releases`, thai,
        appJSON('POST', target === "new" ? { name, slug, description, runSlug } : { runSlug })); onDone();
    } catch (error) { setError(error instanceof Error ? error.message : "Request failed"); }
    finally { setBusy(false); }
  }}>
    <div className="space-y-2"><label id="app-target-label" className="text-sm font-medium">{thai ? "แอป" : "App"}</label><Select value={target} onValueChange={setTarget} disabled={busy || loading}><SelectTrigger aria-labelledby="app-target-label"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">{thai ? "สร้างแอปใหม่" : "New app"}</SelectItem>{apps.filter(app => !taskType || app.taskType === taskType).map(app => <SelectItem key={app.id} value={app.id}>{app.name}</SelectItem>)}</SelectContent></Select></div>
    {target === "new" && <>
      <div className="space-y-2"><label htmlFor="app-name" className="text-sm font-medium">{thai ? "ชื่อแอป" : "App name"}</label><Input id="app-name" value={name} onChange={e => setName(e.target.value)} maxLength={100} required disabled={busy} /></div>
      <div className="space-y-2"><label htmlFor="app-slug" className="text-sm font-medium">{thai ? "ชื่อในลิงก์ (a-z, 0-9, -)" : "URL name (a-z, 0-9, -)"}</label><Input id="app-slug" value={slug} onChange={e => setSlug(e.target.value.toLowerCase())} pattern="[a-z0-9][a-z0-9-]{0,62}" maxLength={63} placeholder="my-model" required disabled={busy} /></div>
      <div className="space-y-2"><label htmlFor="app-description" className="text-sm font-medium">{thai ? "คำอธิบาย" : "Description"}</label><textarea id="app-description" className="min-h-24 w-full rounded-md border bg-background p-3 text-sm" value={description} maxLength={1000} onChange={e => setDescription(e.target.value)} disabled={busy} /></div>
    </>}
    {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
    <Button type="submit" disabled={busy || loading || (target === "new" && (!name.trim() || !slug))}>{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{thai ? "สร้างเวอร์ชันทดสอบ" : "Create preview version"}</Button>
  </form>;
}
