"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/components/language-provider";
import { apiBaseUrl } from "@/lib/api";
import { authClient } from "@/lib/auth-client";

const API = apiBaseUrl();
type Notification = { id: string; kind: string; status: string; targetPath: string; createdAt: string; readAt: string | null };

function text(item: Notification, thai: boolean) {
  const names: Record<string, [string, string]> = {
    train: ["Training", "การฝึก"], evaluate: ["Evaluation", "การประเมิน"], predict: ["Prediction", "การทำนาย"],
    batch_predict: ["Batch prediction", "การทำนายหลายภาพ"], import: ["Dataset import", "การนำเข้า dataset"],
    preview: ["Import preview", "การตรวจ dataset ก่อนนำเข้า"],
  };
  const statuses: Record<string, [string, string]> = {
    completed: ["completed", "สำเร็จ"], failed: ["failed", "ไม่สำเร็จ"], partial: ["completed with skipped images", "สำเร็จโดยมีภาพที่ข้าม"],
    no_test: ["has no test split", "ไม่มีชุดทดสอบ"],
  };
  const index = thai ? 1 : 0;
  return `${names[item.kind]?.[index] ?? item.kind} ${statuses[item.status]?.[index] ?? item.status}`;
}

export function NotificationBell() {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;
  return userId ? <NotificationInbox key={userId} /> : null;
}

function NotificationInbox() {
  const { language } = useLanguage(); const thai = language === "th";
  const [items, setItems] = useState<Notification[]>([]), [unread, setUnread] = useState(0), [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(`${API}/api/notifications`, { signal, cache: "no-store" });
    if (!response.ok) throw new Error("Notifications unavailable");
    const data = await response.json();
    if (!signal?.aborted) { setItems(data.notifications ?? []); setUnread(data.unreadCount ?? 0); setError(false); }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const check = () => { if (document.visibilityState === "visible") void refresh(controller.signal).catch(() => { if (!controller.signal.aborted) setError(true); }); };
    check();
    const timer = setInterval(check, 30000);
    document.addEventListener("visibilitychange", check); window.addEventListener("focus", check);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", check); window.removeEventListener("focus", check); };
  }, [refresh]);

  const mark = async (item: Notification) => {
    if (item.readAt) return;
    try {
      const response = await fetch(`${API}/api/notifications/${item.id}/read`, { method: "POST", keepalive: true });
      if (!response.ok) throw new Error();
      setItems((previous) => previous.map((row) => row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row));
      setUnread((previous) => Math.max(0, previous - 1));
    } catch { setError(true); }
  };
  return <><Button variant="outline" size="icon" className="relative" onClick={() => { setOpen(true); void refresh().catch(() => setError(true)); }} aria-label={`${thai ? "การแจ้งเตือน" : "Notifications"}${unread ? ` (${unread})` : ""}`}>
      <Bell className="h-4 w-4" />{unread > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-white">{unread > 99 ? "99+" : unread}</span>}
    </Button>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent aria-describedby={undefined} className="gap-0 p-0">
      <div className="flex items-center justify-between gap-2 border-b p-4 pr-12"><DialogTitle>{thai ? "การแจ้งเตือน" : "Notifications"}</DialogTitle><Button variant="ghost" size="sm" disabled={!unread} onClick={async () => {
        try { const response = await fetch(`${API}/api/notifications/read-all`, { method: "POST" }); if (!response.ok) throw new Error(); await refresh(); } catch { setError(true); }
      }}><CheckCheck className="h-4 w-4" />{thai ? "อ่านทั้งหมด" : "Mark all read"}</Button></div>
      {error && <p role="alert" className="p-3 text-sm text-destructive">{thai ? "โหลดการแจ้งเตือนไม่สำเร็จ" : "Could not load notifications."}</p>}
      <div className="max-h-[min(60vh,28rem)] overflow-y-auto">{items.length ? items.map((item) => <Link key={item.id} href={item.targetPath} onClick={() => { void mark(item); setOpen(false); }} className={`block border-b p-3 text-sm hover:bg-accent ${item.readAt ? "text-muted-foreground" : "font-medium"}`}>
        <span>{text(item, thai)}</span><span className="mt-1 block text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString(thai ? "th-TH" : "en-US")}</span>
      </Link>) : <p className="p-4 text-sm text-muted-foreground">{thai ? "ไม่มีการแจ้งเตือน" : "No notifications yet."}</p>}</div>
    </DialogContent></Dialog>
  </>;
}
