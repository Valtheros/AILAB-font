"use client";

import { useEffect } from "react";
import { Cpu } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useLanguage } from "@/components/language-provider";
import { ComputeAvailability, ExecutionSelection, executionReadiness } from "@/lib/compute";
import { useComputeAvailability } from '@/lib/use-compute-availability';

export function ExecutionSelector({ value, onChange, disabled = false, onAvailabilityChange }: { value: ExecutionSelection; onChange: (value: ExecutionSelection) => void; disabled?: boolean; onAvailabilityChange?: (availability: ComputeAvailability) => void }) {
  const { language, t } = useLanguage();
  const thai = language === "th";
  const availability = useComputeAvailability();
  useEffect(() => { onAvailabilityChange?.(availability); }, [availability, onAvailabilityChange]);
  const devices = availability.devices;
  const readiness = executionReadiness(value, availability);
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
    <p role="status" className={`text-xs leading-5 ${readiness === 'offline' || readiness === 'unavailable' ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
      {t(`config.device.${readiness}`)}
    </p>
  </div>;
}
