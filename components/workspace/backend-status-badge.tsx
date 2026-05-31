"use client";

import { StatusBadge } from "@/components/workspace/status-badge";
import { useBackendHealth } from "@/lib/useBackendHealth";

const statusConfig = {
  checking: {
    label: "Checking backend",
    tone: "neutral",
    dot: "bg-muted-foreground",
  },
  online: {
    label: "Backend online",
    tone: "success",
    dot: "bg-emerald-500",
  },
  offline: {
    label: "Backend offline",
    tone: "danger",
    dot: "bg-red-500",
  },
} as const;

export function BackendStatusBadge() {
  const status = useBackendHealth();
  const config = statusConfig[status];

  return (
    <StatusBadge tone={config.tone}>
      <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </StatusBadge>
  );
}
