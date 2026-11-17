"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Building2, Link2, Loader2, Unlink } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/components/language-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/workspace/status-badge";

export function LoginMethods({ microsoftEnabled, microsoftAccountId, hasPassword }: {
  microsoftEnabled: boolean; microsoftAccountId: string | null; hasPassword: boolean;
}) {
  const { t } = useLanguage(); const router = useRouter();
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [refreshing, startTransition] = useTransition();
  const microsoftLinked = Boolean(microsoftAccountId);
  if (!microsoftEnabled && !microsoftLinked && hasPassword) return null;
  async function connect() {
    setBusy(true); setError("");
    try {
      const result = await authClient.linkSocial({ provider: "microsoft", callbackURL: "/account", errorCallbackURL: "/auth-error?callbackURL=%2Faccount" });
      if (result.error) setError(t("auth.microsoft.linkFailed"));
    } catch { setError(t("auth.microsoft.linkFailed")); }
    finally { setBusy(false); }
  }
  async function disconnect() {
    if (!microsoftAccountId) return;
    setBusy(true); setError("");
    try {
      const result = await authClient.unlinkAccount({ accountId: microsoftAccountId });
      if (result.error) { setError(t("auth.microsoft.unlinkFailed")); return; }
      startTransition(() => router.refresh());
    } catch { setError(t("auth.microsoft.unlinkFailed")); }
    finally { setBusy(false); }
  }
  return <Card><CardHeader><CardTitle>{t("auth.methods.title")}</CardTitle></CardHeader><CardContent className="space-y-4">
    {(microsoftEnabled || microsoftLinked) && <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3"><Building2 className="h-5 w-5 shrink-0" /><span className="text-sm font-medium">{t("auth.microsoft.name")}</span>{microsoftLinked && <StatusBadge tone="success">{t("auth.microsoft.linked")}</StatusBadge>}</div>
      {!microsoftLinked && microsoftEnabled && <Button className="min-h-11" variant="outline" disabled={busy || refreshing} onClick={() => void connect()}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}{t("auth.microsoft.link")}</Button>}
      {microsoftLinked && hasPassword && <AlertDialog><AlertDialogTrigger asChild><Button className="min-h-11" variant="outline" disabled={busy || refreshing}><Unlink className="h-4 w-4" />{t("auth.microsoft.unlink")}</Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t("auth.microsoft.unlinkTitle")}</AlertDialogTitle><AlertDialogDescription>{t("auth.microsoft.unlinkDescription")}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("auth.microsoft.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => void disconnect()}>{t("auth.microsoft.unlink")}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>}
    </div>}
    {microsoftEnabled && !microsoftLinked && <p className="text-sm text-muted-foreground">{t("auth.microsoft.linkDescription")}</p>}
    {!hasPassword && <p className="text-sm text-muted-foreground">{t("auth.methods.noPassword")} <Link href="/forgot-password" className="underline underline-offset-4">{t("auth.methods.setPassword")}</Link></p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </CardContent></Card>;
}
