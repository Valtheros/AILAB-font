"use client";

import { useEffect, useState } from 'react';
import { apiBaseUrl } from '@/lib/api';
import { ComputeAvailability, initialComputeAvailability } from '@/lib/compute';

export function useComputeAvailability(enabled = true): ComputeAvailability {
  const [availability, setAvailability] = useState<ComputeAvailability>(initialComputeAvailability);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      try {
        const response = await fetch(`${apiBaseUrl()}/api/compute/devices`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (!Array.isArray(data.devices) || typeof data.cpuAvailable !== 'boolean' || typeof data.coordinatorAvailable !== 'boolean') throw new Error();
        if (!controller.signal.aborted) setAvailability({ status: 'ready', devices: data.devices, cpuAvailable: data.cpuAvailable, coordinatorAvailable: data.coordinatorAvailable });
      } catch {
        if (!controller.signal.aborted) setAvailability((current) => ({ ...current, status: 'error' }));
      }
      if (!controller.signal.aborted) timer = setTimeout(load, 5000);
    };
    void load();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [enabled]);
  return availability;
}
