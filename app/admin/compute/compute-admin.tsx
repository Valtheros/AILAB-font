"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { Cpu, RefreshCw, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { apiBaseUrl } from '@/lib/api';
import { ComputeDevice } from '@/lib/compute';
import { useLanguage } from '@/components/language-provider';

type Inventory = { devices: ComputeDevice[]; nodes: { id: string; ram_total_mb: number; ram_available_mb: number; ram_budget_percent: number; cpu_worker_heartbeat?: string; cpu_health_error?: string }[]; quotas: { owner_user_id: string; max_gpu_jobs: number; email: string }[] };

export function ComputeAdmin() {
  const { language } = useLanguage();
  const thai = language === 'th';
  const [data, setData] = useState<Inventory | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const loadSequence = useRef(0);
  const load = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++loadSequence.current;
    try {
      const response = await fetch(`${apiBaseUrl()}/api/compute/admin`, { signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Inventory unavailable');
      if (!signal?.aborted && sequence === loadSequence.current) { setData(data); setError(''); }
    } catch (e) { if (!signal?.aborted && sequence === loadSequence.current) setError(e instanceof Error ? e.message : 'Request failed'); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const timer = setInterval(() => void load(controller.signal), 5000);
    return () => { controller.abort(); clearInterval(timer); };
  }, [load]);
  const update = async (path: string, method: string, body: object) => {
    setBusy(true);
    try {
      const response = await fetch(`${apiBaseUrl()}/api/compute/admin/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Update failed');
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : 'Update failed'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-6">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b pb-4"><h1 className="flex items-center gap-2 text-2xl font-semibold"><Cpu />Compute</h1><div className="flex gap-2"><Button asChild variant="outline"><a href="/admin/users">{thai ? 'ผู้ใช้' : 'Users'}</a></Button><Button variant="outline" size="icon" aria-label="Refresh" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button></div></header>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <section className="space-y-3"><h2 className="text-lg font-semibold">GPU / Worker</h2>{data?.devices.map((d) => <div key={d.uuid} className="grid gap-3 rounded-md border p-4 md:grid-cols-[1fr_auto]">
      <div className="min-w-0"><p className="font-semibold">{d.name} · {d.status}</p><p className="break-all text-xs text-muted-foreground">{d.uuid}</p><p className="mt-2 text-sm">{(d.freeMb / 1024).toFixed(1)} / {(d.totalMb / 1024).toFixed(1)} GB · {d.utilization ?? '—'}% · {d.temperature ?? '—'} °C</p>{d.error && <p className="break-words text-sm text-destructive">{d.error}</p>}</div>
      <label className="flex items-center gap-3 text-sm">Drain<Switch checked={d.draining} disabled={busy} onCheckedChange={(draining) => void update(`devices/${encodeURIComponent(d.uuid)}`, 'PATCH', { draining })} /></label>
    </div>)}</section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">CPU / RAM</h2>{data?.nodes.map((n) => <div key={n.id} className="space-y-2 border-b py-3"><p>{n.id} · {(n.ram_available_mb / 1024).toFixed(1)} / {(n.ram_total_mb / 1024).toFixed(1)} GB {thai ? 'ว่าง / ทั้งหมด' : 'available / total'}</p><p className="text-sm">CPU worker: {n.cpu_health_error || (n.cpu_worker_heartbeat ? new Date(n.cpu_worker_heartbeat).toLocaleString(thai ? 'th-TH' : 'en-GB') : 'Offline')}</p><form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); const form = new FormData(e.currentTarget); void update(`nodes/${encodeURIComponent(n.id)}`, 'PATCH', { ramBudgetPercent: Number(form.get('budget')) }); }}><label className="space-y-1 text-sm">{thai ? 'งบ RAM สำหรับ compute (%)' : 'Compute RAM budget (%)'}<Input name="budget" type="number" min={10} max={90} defaultValue={n.ram_budget_percent} className="w-28" required /></label><Button disabled={busy} variant="outline"><Save className="h-4 w-4" />{thai ? 'บันทึก' : 'Save'}</Button></form></div>)}</section>
    <section className="space-y-3"><h2 className="text-lg font-semibold">{thai ? 'โควตางาน GPU ต่อผู้ใช้' : 'GPU jobs per user'}</h2>{data?.quotas.map((q) => <form key={q.owner_user_id} className="flex flex-wrap items-center gap-3 border-b py-3" onSubmit={(e) => { e.preventDefault(); void update(`quotas/${encodeURIComponent(q.owner_user_id)}`, 'PUT', { maxGpuJobs: Number(new FormData(e.currentTarget).get('quota')) }); }}><span className="min-w-0 flex-1 break-all text-sm">{q.email}</span><Input name="quota" type="number" min={1} max={32} defaultValue={q.max_gpu_jobs} aria-label={`GPU quota ${q.email}`} className="w-20" required /><Button disabled={busy} variant="outline"><Save className="h-4 w-4" />Save</Button></form>)}</section>
  </div>;
}
