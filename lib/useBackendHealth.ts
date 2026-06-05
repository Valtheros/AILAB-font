"use client";

import { useEffect, useState } from "react";
import { apiBaseUrl } from "@/lib/api";

const API_URL = apiBaseUrl();
const REQUEST_TIMEOUT_MS = 3000;
const POLL_INTERVAL_MS = 15000;

export type BackendHealth = "checking" | "online" | "offline";

export function useBackendHealth() {
  const [status, setStatus] = useState<BackendHealth>("checking");

  useEffect(() => {
    let disposed = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;

    const checkHealth = async () => {
      const controller = new AbortController();
      const requestTimer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const response = await fetch(`${API_URL}/`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!disposed) setStatus(response.ok ? "online" : "offline");
      } catch {
        if (!disposed) setStatus("offline");
      } finally {
        clearTimeout(requestTimer);
        if (!disposed) pollTimer = setTimeout(checkHealth, POLL_INTERVAL_MS);
      }
    };

    void checkHealth();
    return () => {
      disposed = true;
      clearTimeout(pollTimer);
    };
  }, []);

  return status;
}
