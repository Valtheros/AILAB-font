"use client";

import { FormEvent, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Search,
  Ban,
  KeyRound,
  Trash2,
  LogOut,
  UserCog,
  CheckCircle2,
  XCircle,
  UserRoundSearch,
} from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/workspace/status-badge";
import { cn } from "@/lib/utils";
import {
  removeUserAction,
  deleteUserAndDataAction,
  disableUserAction,
  getUserResourceImpactAction,
  revokeUserSessionsAction,
  setEmailVerifiedAction,
  setUserBanAction,
  setUserPasswordAction,
  setUserRoleAction,
  transferUserResourcesAction,
  type AdminActionResult,
} from "./actions";

export type AdminUserRow = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: "admin" | "user" | string;
  banned: boolean;
  banReason: string | null;
  banExpires: string | null;
  createdAt: string;
  updatedAt: string;
  sessionCount: number;
  workspaceMembershipCount: number;
  projectCount: number;
  datasetCount: number;
  trainingRunCount: number;
};

type AdminUsersClientProps = {
  currentUserId: string;
  initialSearch: string;
  limit: number;
  offset: number;
  total: number;
  users: AdminUserRow[];
};

type ConfirmAction = {
  action: () => Promise<AdminActionResult>;
  confirmLabel?: string;
  description: string;
  destructive?: boolean;
  title: string;
};

type BanDialogState = { user: AdminUserRow; reason: string } | null;
type PasswordDialogState = { user: AdminUserRow; password: string } | null;
type CleanupDialogState = {
  user: AdminUserRow;
  impact: { workspaceMemberships: number; projects: number; datasets: number; runs: number; activeJobs: Array<{ run_slug: string; status: string }>; totalBytes: number };
  targetUserId: string;
} | null;

type UserActionHandlers = {
  isPending: boolean;
  openBanDialog: (user: AdminUserRow) => void;
  openConfirm: (action: ConfirmAction) => void;
  openPasswordDialog: (user: AdminUserRow) => void;
  openCleanupDialog: (user: AdminUserRow) => void;
  runAction: (action: () => Promise<AdminActionResult>, afterSuccess?: () => void) => void;
};

function statusFromResult(result: AdminActionResult) {
  return result.ok ? result.message : result.message || "Admin action failed.";
}

function roleTone(role: string) {
  return role === "admin" ? "success" : undefined;
}

function userDeleteImpactTotal(user: AdminUserRow) {
  return (
    user.workspaceMembershipCount +
    user.projectCount +
    user.datasetCount +
    user.trainingRunCount
  );
}

function userDeleteDescription(user: AdminUserRow) {
  const total = userDeleteImpactTotal(user);
  if (total === 0) {
    return `This permanently deletes ${user.email} from auth users, accounts, and sessions. No linked workspace data was found for this user.`;
  }

  return [
    `${user.email} has existing workspace data linked to this account:`,
    `Workspace memberships: ${user.workspaceMembershipCount}`,
    `Projects: ${user.projectCount}`,
    `Datasets: ${user.datasetCount}`,
    `Training runs: ${user.trainingRunCount}`,
    "",
    "Removing this user deletes only the auth account, account credentials, and sessions.",
    "Existing workspace data will remain, but created_by/user_id may point to a deleted user id.",
  ].join("\n");
}

function UserActionButtons({
  handlers,
  isSelf,
  user,
}: {
  handlers: UserActionHandlers;
  isSelf: boolean;
  user: AdminUserRow;
}) {
  const { isPending, openBanDialog, openConfirm, openPasswordDialog, openCleanupDialog, runAction } = handlers;

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
      <Button
        className="w-full sm:w-auto"
        disabled={isPending || (isSelf && user.role === "admin")}
        onClick={() => {
          const nextRole = user.role === "admin" ? "user" : "admin";
          openConfirm({
            action: () => setUserRoleAction(user.id, nextRole),
            confirmLabel: `Make ${nextRole}`,
            description: `This changes ${user.email} to the ${nextRole} role. Admin users can manage all platform users.`,
            title: `Change role for ${user.email}?`,
          });
        }}
        size="sm"
        variant="outline"
      >
        <UserCog className="h-4 w-4" />
        {user.role === "admin" ? "Make user" : "Make admin"}
      </Button>
      <Button
        className="w-full sm:w-auto"
        disabled={isPending}
        onClick={() => runAction(() => setEmailVerifiedAction(user.id, !user.emailVerified))}
        size="sm"
        variant="outline"
      >
        {user.emailVerified ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
        {user.emailVerified ? "Unverify" : "Verify"}
      </Button>
      <Button
        className="w-full sm:w-auto"
        disabled={isPending || isSelf}
        onClick={() => {
          if (user.banned) {
            runAction(() => setUserBanAction(user.id, false));
            return;
          }
          openBanDialog(user);
        }}
        size="sm"
        variant="outline"
      >
        <Ban className="h-4 w-4" />
        {user.banned ? "Unban" : "Ban"}
      </Button>
      <Button
        className="w-full sm:w-auto"
        disabled={isPending || isSelf}
        onClick={() => {
          openConfirm({
            action: () => revokeUserSessionsAction(user.id),
            confirmLabel: "Revoke sessions",
            description: `${user.email} will be signed out from every active browser session. The account remains available.`,
            title: `Revoke all sessions for ${user.email}?`,
          });
        }}
        size="sm"
        variant="outline"
      >
        <LogOut className="h-4 w-4" />
        Revoke
      </Button>
      <Button
        className="w-full sm:w-auto"
        disabled={isPending}
        onClick={() => openPasswordDialog(user)}
        size="sm"
        variant="outline"
      >
        <KeyRound className="h-4 w-4" />
        Password
      </Button>
      <Button
        className="w-full sm:w-auto"
        disabled={isPending || isSelf || user.role === "admin"}
        onClick={() => {
          openConfirm({
            action: async () => {
              const adminApi = (authClient as unknown as {
                admin?: { impersonateUser?: (input: { userId: string }) => Promise<{ error?: { message?: string } | null }> };
              }).admin;
              if (!adminApi?.impersonateUser) {
                return { ok: false, message: "Better Auth impersonation API is not available." };
              }
              const result = await adminApi.impersonateUser({ userId: user.id });
              if (result.error) {
                return { ok: false, message: result.error.message || "Impersonation failed." };
              }
              return { ok: true, message: "Starting impersonation." };
            },
            confirmLabel: "Impersonate",
            description: `You will temporarily act as ${user.email}. Use the undo button in the navbar to stop impersonating.`,
            title: `Impersonate ${user.email}?`,
          });
        }}
        size="sm"
        variant="outline"
      >
        <UserRoundSearch className="h-4 w-4" />
        Impersonate
      </Button>
      <Button
        className={cn("w-full sm:w-auto", isSelf && "opacity-50")}
        disabled={isPending || isSelf}
        onClick={() => {
          if (userDeleteImpactTotal(user) > 0) openCleanupDialog(user);
          else openConfirm({ action: () => removeUserAction(user.id), confirmLabel: "Remove user", description: userDeleteDescription(user), destructive: true, title: `Remove ${user.email}?` });
        }}
        size="sm"
        variant="destructive"
      >
        <Trash2 className="h-4 w-4" />
        Remove
      </Button>
    </div>
  );
}

export function AdminUsersClient({
  currentUserId,
  initialSearch,
  limit,
  offset,
  total,
  users,
}: AdminUsersClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [message, setMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [banDialog, setBanDialog] = useState<BanDialogState>(null);
  const [passwordDialog, setPasswordDialog] = useState<PasswordDialogState>(null);
  const [cleanupDialog, setCleanupDialog] = useState<CleanupDialogState>(null);
  const [isPending, startTransition] = useTransition();

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const searchHref = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    params.set("offset", "0");
    return `/admin/users?${params.toString()}`;
  }, [search]);

  function runAction(action: () => Promise<AdminActionResult>, afterSuccess?: () => void) {
    setMessage("");
    startTransition(async () => {
      const result = await action();
      setMessage(statusFromResult(result));
      if (result.ok) afterSuccess?.();
      router.refresh();
    });
  }

  function runConfirmAction() {
    if (!confirmAction) return;
    runAction(confirmAction.action, () => setConfirmAction(null));
  }

  function pageHref(nextOffset: number) {
    const params = new URLSearchParams();
    if (initialSearch) params.set("q", initialSearch);
    params.set("offset", String(Math.max(0, nextOffset)));
    return `/admin/users?${params.toString()}`;
  }


  function submitBan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!banDialog) return;
    runAction(() => setUserBanAction(banDialog.user.id, true, banDialog.reason), () => setBanDialog(null));
  }

  function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordDialog) return;
    runAction(() => setUserPasswordAction(passwordDialog.user.id, passwordDialog.password), () => setPasswordDialog(null));
  }

  const actionHandlers: UserActionHandlers = {
    isPending,
    openBanDialog: (user) => setBanDialog({ user, reason: "Banned by admin" }),
    openConfirm: setConfirmAction,
    openPasswordDialog: (user) => setPasswordDialog({ user, password: "" }),
    openCleanupDialog: (user) => {
      setMessage("");
      startTransition(async () => {
        const result = await getUserResourceImpactAction(user.id);
        if (!result.ok) return setMessage(result.message);
        setCleanupDialog({ user, impact: result, targetUserId: "" });
      });
    },
    runAction,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium">User Directory</p>
          <p className="text-xs leading-5 text-muted-foreground">Manage authentication users, roles, verification, sessions, and access state.</p>
        </div>
        <div className="flex w-full gap-2 md:max-w-md">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") router.push(searchHref);
              }}
              placeholder="Search name or email"
              value={search}
            />
          </div>
          <Button asChild variant="outline">
            <Link href={searchHref}>Search</Link>
          </Button>
        </div>
      </div>

      {message && (
        <div className="rounded-md border border-border bg-background px-4 py-3 text-sm text-muted-foreground">
          {message}
        </div>
      )}

      <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-sm">
            <thead className="border-b border-border bg-muted/30 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Access</th>
                <th className="px-4 py-3 font-medium">Sessions</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <tr key={user.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{user.name || "Unnamed user"}</p>
                          {isSelf && <Badge variant="secondary">You</Badge>}
                        </div>
                        <p className="max-w-[260px] truncate font-mono text-xs text-muted-foreground">{user.id}</p>
                        <p className="text-xs text-muted-foreground">Updated {new Date(user.updatedAt).toLocaleString()}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <StatusBadge tone={roleTone(user.role)}>{user.role}</StatusBadge>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <p className="break-all">{user.email}</p>
                        <StatusBadge tone={user.emailVerified ? "success" : "warning"}>
                          {user.emailVerified ? "Verified" : "Unverified"}
                        </StatusBadge>
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2">
                        <StatusBadge tone={user.banned ? "warning" : "success"}>
                          {user.banned ? "Banned" : "Active"}
                        </StatusBadge>
                        {user.banned && user.banReason && (
                          <p className="max-w-[220px] text-xs leading-5 text-muted-foreground">{user.banReason}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">{user.sessionCount}</td>
                    <td className="px-4 py-4 align-top text-muted-foreground">
                      {new Date(user.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <UserActionButtons handlers={actionHandlers} isSelf={isSelf} user={user} />
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-muted-foreground" colSpan={7}>
                    No users match the current search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {users.map((user) => {
          const isSelf = user.id === currentUserId;
          const linkedDataCount = userDeleteImpactTotal(user);
          return (
            <div key={user.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="break-words text-base font-semibold">{user.name || "Unnamed user"}</p>
                    {isSelf && <Badge variant="secondary">You</Badge>}
                  </div>
                  <p className="break-all text-sm text-muted-foreground">{user.email}</p>
                  <p className="break-all font-mono text-xs text-muted-foreground">{user.id}</p>
                </div>
                <StatusBadge tone={roleTone(user.role)}>{user.role}</StatusBadge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <div className="rounded-md border border-border p-3">
                  <p className="uppercase">Email</p>
                  <div className="mt-2">
                    <StatusBadge tone={user.emailVerified ? "success" : "warning"}>
                      {user.emailVerified ? "Verified" : "Unverified"}
                    </StatusBadge>
                  </div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="uppercase">Access</p>
                  <div className="mt-2">
                    <StatusBadge tone={user.banned ? "warning" : "success"}>
                      {user.banned ? "Banned" : "Active"}
                    </StatusBadge>
                  </div>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="uppercase">Sessions</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{user.sessionCount}</p>
                </div>
                <div className="rounded-md border border-border p-3">
                  <p className="uppercase">Linked Data</p>
                  <p className="mt-2 text-sm font-medium text-foreground">{linkedDataCount}</p>
                </div>
              </div>

              {user.banned && user.banReason && (
                <p className="mt-3 rounded-md border border-border bg-background p-3 text-xs leading-5 text-muted-foreground">
                  {user.banReason}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Created {new Date(user.createdAt).toLocaleString()} · Updated {new Date(user.updatedAt).toLocaleString()}
              </p>
              <div className="mt-4">
                <UserActionButtons handlers={actionHandlers} isSelf={isSelf} user={user} />
              </div>
            </div>
          );
        })}
        {users.length === 0 && (
          <div className="rounded-lg border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            No users match the current search.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4" />
          Page {page} of {totalPages}. Showing {users.length} of {total} users.
        </div>
        <div className="flex gap-2">
          <Button asChild disabled={offset <= 0} size="sm" variant="outline">
            <Link aria-disabled={offset <= 0} href={pageHref(Math.max(0, offset - limit))}>Previous</Link>
          </Button>
          <Button asChild disabled={offset + limit >= total} size="sm" variant="outline">
            <Link aria-disabled={offset + limit >= total} href={pageHref(offset + limit)}>Next</Link>
          </Button>
        </div>
      </div>

      <AlertDialog open={Boolean(confirmAction)} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmAction?.title}</AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">{confirmAction?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirmAction?.destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
              disabled={isPending}
              onClick={(event) => {
                event.preventDefault();
                runConfirmAction();
              }}
            >
              {isPending ? "Working..." : confirmAction?.confirmLabel ?? "Continue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={Boolean(banDialog)} onOpenChange={(open) => !open && setBanDialog(null)}>
        <DialogContent>
          <form onSubmit={submitBan}>
            <DialogHeader>
              <DialogTitle>Ban {banDialog?.user.email}</DialogTitle>
              <DialogDescription>
                Banning revokes all current sessions and prevents this user from signing in until unbanned.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium" htmlFor="ban-reason">Ban reason</label>
              <Input
                className="mt-2"
                id="ban-reason"
                onChange={(event) => setBanDialog((state) => state ? { ...state, reason: event.target.value } : state)}
                value={banDialog?.reason ?? ""}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button disabled={isPending} type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button disabled={isPending} type="submit" variant="destructive">
                {isPending ? "Banning..." : "Ban user"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(passwordDialog)} onOpenChange={(open) => !open && setPasswordDialog(null)}>
        <DialogContent>
          <form onSubmit={submitPassword}>
            <DialogHeader>
              <DialogTitle>Set password for {passwordDialog?.user.email}</DialogTitle>
              <DialogDescription>
                This creates or replaces the password credential for the selected user.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <label className="text-sm font-medium" htmlFor="new-password">New password</label>
              <div className="mt-2">
                <PasswordInput
                  id="new-password"
                  minLength={8}
                  onChange={(event) => setPasswordDialog((state) => state ? { ...state, password: event.target.value } : state)}
                  value={passwordDialog?.password ?? ""}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button disabled={isPending} type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button disabled={isPending || (passwordDialog?.password.length ?? 0) < 8} type="submit">
                {isPending ? "Saving..." : "Set password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(cleanupDialog)} onOpenChange={(open) => !open && setCleanupDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage data for {cleanupDialog?.user.email}</DialogTitle>
            <DialogDescription>
              This account owns {cleanupDialog?.impact.datasets ?? 0} dataset(s), {cleanupDialog?.impact.runs ?? 0} run(s), and {((cleanupDialog?.impact.totalBytes ?? 0) / 1024 / 1024).toFixed(1)} MB on disk.
              {` Projects: ${cleanupDialog?.impact.projects ?? 0}. Workspace memberships: ${cleanupDialog?.impact.workspaceMemberships ?? 0}.`}
              {(cleanupDialog?.impact.activeJobs.length ?? 0) > 0 && ` Active jobs: ${cleanupDialog?.impact.activeJobs.map((job) => `${job.run_slug} (${job.status})`).join(", ")}.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button className="w-full justify-start" disabled={isPending} onClick={() => runAction(() => disableUserAction(cleanupDialog!.user.id), () => setCleanupDialog(null))} variant="outline">
              <Ban className="h-4 w-4" /> Disable account and keep data
            </Button>
            <div className="flex gap-2">
              <Input placeholder="Target user ID" value={cleanupDialog?.targetUserId ?? ""} onChange={(event) => setCleanupDialog((state) => state ? { ...state, targetUserId: event.target.value } : state)} />
              <Button disabled={isPending || !cleanupDialog?.targetUserId.trim() || (cleanupDialog?.impact.activeJobs.length ?? 0) > 0} onClick={() => runAction(() => transferUserResourcesAction(cleanupDialog!.user.id, cleanupDialog!.targetUserId.trim()), () => setCleanupDialog(null))} variant="outline">
                Transfer
              </Button>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button disabled={isPending} variant="outline">Cancel</Button></DialogClose>
            <Button disabled={isPending} onClick={() => runAction(() => deleteUserAndDataAction(cleanupDialog!.user.id), () => setCleanupDialog(null))} variant="destructive">
              <Trash2 className="h-4 w-4" /> Delete account and data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
