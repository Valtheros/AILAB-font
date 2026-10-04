"use client";

import { useEffect, useState } from "react";
import { Cpu } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/language-provider";
import { apiBaseUrl } from "@/lib/api";
import { ComputeDevice, ExecutionSelection } from "@/lib/compute";

export function ExecutionSelector({ value, onChange, disabled = false }: { value: ExecutionSelection; onChange: (value: ExecutionSelection) => void; disabled?: boolean }) {
  const { language } = useLanguage();
  const thai = language === "th";
  const [devices, setDevices] = useState<ComputeDevice[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const response = await fetch(`${apiBaseUrl()}/api/compute/devices`, { signal: controller.signal, cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!controller.signal.aborted) { setDevices(data.devices); setError(false); }
      } catch { if (!controller.signal.aborted) setError(true); }
      if (!controller.signal.aborted) timer = setTimeout(load, 5000);
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);
  const selected = value.mode === "gpu" ? value.gpuUuid || "missing" : value.mode;
  return <div className="min-w-0 space-y-2">
    <Label className="flex items-center gap-2"><Cpu className="h-4 w-4" />{thai ? "อุปกรณ์ประมวลผล" : "Execution device"}</Label>
    <Select value={selected} disabled={disabled} onValueChange={(v) => onChange(v === "auto" || v === "cpu" ? { mode: v, gpuUuid: null } : { mode: "gpu", gpuUuid: v })}>
      <SelectTrigger className="min-h-11 w-full min-w-0"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="auto">Auto GPU</SelectItem>
        {devices.map((d) => <SelectItem key={d.uuid} value={d.uuid}><span className="whitespace-normal break-words">{d.name} · {(d.totalMb / 1024).toFixed(1)} GB · {d.status} · {(d.freeMb / 1024).toFixed(1)} GB {thai ? "ว่าง" : "free"}</span></SelectItem>)}
        {value.mode === "gpu" && !devices.some((d) => d.uuid === selected) && <SelectItem value={selected}>{thai ? "การ์ดไม่พร้อม กรุณาเลือกใหม่" : "Unavailable GPU; select again"}</SelectItem>}
        <SelectItem value="cpu">CPU</SelectItem>
      </SelectContent>
    </Select>
    {error && <p role="status" className="text-xs text-amber-600 dark:text-amber-400">{thai ? "โหลดสถานะอุปกรณ์ไม่ได้ กำลังลองใหม่" : "Device status unavailable. Retrying."}</p>}
  </div>;
}
