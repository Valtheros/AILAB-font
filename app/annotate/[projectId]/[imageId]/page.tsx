"use client";

import dynamic from "next/dynamic";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  History,
  LoaderCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/workspace/page-header";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiBaseUrl } from "@/lib/api";
import {
  apiError,
  type AnnotationImage,
  type AnnotationProject,
  type AnnotationRevision,
  type AnnotationSplit,
  type StoredAnnotation,
  annotationId,
  taskLabel,
} from "@/lib/annotation";
import { cn } from "@/lib/utils";

const DetectionCanvas = dynamic(() => import("@/components/annotation/annotation-canvas"), {
  ssr: false,
  loading: () => <div className="min-h-[60vh] animate-pulse rounded-md border bg-muted/40" />,
});
const SegmentationCanvas = dynamic(() => import("@/components/annotation/segmentation-canvas"), {
  ssr: false,
  loading: () => <div className="min-h-[60vh] animate-pulse rounded-md border bg-muted/40" />,
});
const API_URL = apiBaseUrl();

type SavePayload = {
  annotations: StoredAnnotation[];
  markedEmpty: boolean;
  excluded: boolean;
};

type Conflict = {
  payload: SavePayload;
  latestRevision: number;
};

export default function AnnotationImagePage() {
  const { language } = useLanguage();
  const params = useParams<{ projectId: string; imageId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { projectId, imageId } = params;
  const [project, setProject] = useState<AnnotationProject | null>(null);
  const [image, setImage] = useState<AnnotationImage | null>(null);
  const [previousId, setPreviousId] = useState<string | null>(null);
  const [nextId, setNextId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [leaveTarget, setLeaveTarget] = useState("");
  const [revisionsOpen, setRevisionsOpen] = useState(false);
  const [revisions, setRevisions] = useState<AnnotationRevision[]>([]);
  const [canvasVersion, setCanvasVersion] = useState(0);
  const revision = useRef(0);
  const pending = useRef<SavePayload | null>(null);
  const saveTimer = useRef<number | null>(null);
  const saveChain = useRef<Promise<boolean>>(Promise.resolve(true));
  const saveNowRef = useRef<(force?: boolean, revisionOverride?: number) => Promise<boolean>>(async () => true);
  const serverImage = useRef<AnnotationImage | null>(null);

  const query = useMemo(() => {
    const next = new URLSearchParams();
    for (const key of ["split", "status", "search", "sort"]) {
      const value = searchParams.get(key);
      if (value) next.set(key, value);
    }
    return next;
  }, [searchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/annotation-projects/${projectId}/images/${imageId}?${query}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await apiError(response));
      const body = await response.json() as {
        project: AnnotationProject;
        image: AnnotationImage;
        previousId: string | null;
        nextId: string | null;
      };
      setProject(body.project);
      setImage(body.image);
      serverImage.current = body.image;
      setPreviousId(body.previousId);
      setNextId(body.nextId);
      revision.current = body.image.revision;
      pending.current = null;
      setSaveState("saved");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load annotation image");
    } finally {
      setLoading(false);
    }
  }, [imageId, projectId, query]);

  useEffect(() => { void load(); }, [load]);

  const updateProjectCounts = useCallback((before: AnnotationImage | null, after: AnnotationImage) => {
    if (!before) return;
    const beforeComplete = before.is_labeled || before.is_excluded;
    const afterComplete = after.is_labeled || after.is_excluded;
    setProject((current) => current ? {
      ...current,
      status: "draft",
      labeled_count: current.labeled_count + Number(after.is_labeled) - Number(before.is_labeled),
      excluded_count: current.excluded_count + Number(after.is_excluded) - Number(before.is_excluded),
      completed_count: current.completed_count + Number(afterComplete) - Number(beforeComplete),
    } : current);
  }, []);

  const persist = useCallback((
    payload: SavePayload,
    force = false,
    revisionOverride?: number,
  ) => {
    saveChain.current = saveChain.current.catch(() => false).then(async () => {
      setSaveState("saving");
      const response = await fetch(`${API_URL}/api/annotation-projects/${projectId}/images/${imageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          revision: revisionOverride ?? revision.current,
          annotations: payload.annotations,
          markedEmpty: payload.markedEmpty,
          excluded: payload.excluded,
          force,
        }),
      });
      if (response.status === 409) {
        const body = await response.json() as { detail?: { latestRevision?: number } };
        const latestRevision = Number(body.detail?.latestRevision);
        const localPayload = pending.current ?? payload;
        pending.current = null;
        setConflict({
          payload: localPayload,
          latestRevision: Number.isFinite(latestRevision) ? latestRevision : revision.current,
        });
        setSaveState("error");
        return false;
      }
      if (!response.ok) {
        pending.current ??= payload;
        throw new Error(await apiError(response));
      }
      const body = await response.json() as { image: AnnotationImage };
      revision.current = body.image.revision;
      updateProjectCounts(serverImage.current, body.image);
      serverImage.current = body.image;
      setImage(body.image);
      setError("");
      setSaveState(pending.current ? "saving" : "saved");
      return true;
    }).catch((cause) => {
      pending.current ??= payload;
      setSaveState("error");
      setError(cause instanceof Error ? cause.message : "Autosave failed");
      return false;
    });
    return saveChain.current;
  }, [imageId, projectId, updateProjectCounts]);

  const saveNow = useCallback(async (force = false, revisionOverride?: number) => {
    if (saveTimer.current !== null) {
      window.clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const payload = pending.current;
    if (!payload) return saveChain.current;
    pending.current = null;
    return persist(payload, force, revisionOverride);
  }, [persist]);
  saveNowRef.current = saveNow;

  const scheduleSave = useCallback((payload: SavePayload) => {
    pending.current = payload;
    setSaveState("saving");
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => void saveNowRef.current(), 600);
  }, []);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!pending.current && saveState === "saved" && !conflict) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [conflict, saveState]);
  useEffect(() => () => {
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
  }, []);

  const canvasChanged = useCallback((annotations: StoredAnnotation[]) => {
    const current = image;
    if (!current) return;
    scheduleSave({
      annotations,
      markedEmpty: false,
      excluded: pending.current?.excluded ?? current.is_excluded,
    });
  }, [image, scheduleSave]);

  const markEmpty = useCallback(() => {
    if (!image) return;
    setImage({ ...image, annotations: [], marked_empty: true });
    scheduleSave({
      annotations: [],
      markedEmpty: true,
      excluded: pending.current?.excluded ?? image.is_excluded,
    });
  }, [image, scheduleSave]);

  const navigate = async (href: string) => {
    if (conflict || saveState === "error") {
      setLeaveTarget(href);
      return;
    }
    const saved = await saveNow();
    if (saved) router.push(href);
    else setLeaveTarget(href);
  };

  const imageHref = (targetId: string) => `/annotate/${projectId}/${targetId}?${query}`;

  const setSplit = async (split: AnnotationSplit) => {
    if (!image) return;
    try {
      if (!await saveNow()) return;
      const response = await fetch(`${API_URL}/api/annotation-projects/${projectId}/images/${image.id}/split`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ split }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const body = await response.json() as { image: AnnotationImage };
      setImage((current) => current ? { ...current, split: body.image.split, split_source: body.image.split_source } : current);
      if (serverImage.current) {
        serverImage.current = { ...serverImage.current, split: body.image.split, split_source: body.image.split_source };
      }
      setProject((current) => current ? { ...current, status: "draft" } : current);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update split");
    }
  };

  const toggleExcluded = (excluded: boolean) => {
    if (!image) return;
    const local = pending.current ?? {
      annotations: image.annotations,
      markedEmpty: image.marked_empty,
      excluded: image.is_excluded,
    };
    setImage({ ...image, is_excluded: excluded, status: excluded ? "excluded" : image.is_labeled ? (image.marked_empty ? "empty" : "labeled") : "unlabeled" });
    scheduleSave({ ...local, excluded });
  };

  const reloadServer = async () => {
    setConflict(null);
    pending.current = null;
    setCanvasVersion((value) => value + 1);
    await load();
  };

  const keepLocal = async () => {
    if (!conflict) return;
    pending.current = conflict.payload;
    const latestRevision = conflict.latestRevision;
    setConflict(null);
    await saveNow(true, latestRevision);
  };

  const openRevisions = async () => {
    if (!image) return;
    try {
      const response = await fetch(`${API_URL}/api/annotation-projects/${projectId}/images/${image.id}/revisions`, { cache: "no-store" });
      if (!response.ok) throw new Error(await apiError(response));
      const body = await response.json() as { revisions: AnnotationRevision[] };
      setRevisions(body.revisions);
      setRevisionsOpen(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load revision history");
    }
  };

  const restoreRevision = async (revisionId: string) => {
    if (!image) return;
    const response = await fetch(`${API_URL}/api/annotation-projects/${projectId}/images/${image.id}/revisions/${revisionId}/restore`, { method: "POST" });
    if (!response.ok) {
      setError(await apiError(response));
      return;
    }
    const body = await response.json() as { image: AnnotationImage };
    revision.current = body.image.revision;
    updateProjectCounts(serverImage.current, body.image);
    serverImage.current = body.image;
    setImage(body.image);
    setCanvasVersion((value) => value + 1);
    setRevisionsOpen(false);
    setSaveState("saved");
  };

  useEffect(() => {
    const interceptNavigation = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (!pending.current && saveState === "saved" && !conflict) return;
      event.preventDefault();
      void navigate(`${anchor.pathname}${anchor.search}${anchor.hash}`);
    };
    document.addEventListener("click", interceptNavigation, true);
    return () => document.removeEventListener("click", interceptNavigation, true);
  });

  const selectedClass = image?.annotations[0]?.classId;
  const description = project
    ? `${project.name} · ${taskLabel(project.task_type)}`
    : "Loading image...";
  const editorKey = `${imageId}-${canvasVersion}`;

  return (
    <MainLayout>
      <div className="mx-auto max-w-[100rem] space-y-4">
        <PageHeader
          title={image?.file_name ?? "Label image"}
          description={description}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void navigate(`/annotate/${projectId}`)}><ArrowLeft />All images</Button>
              <Button variant="outline" onClick={openRevisions} disabled={!image}><History />History</Button>
            </div>
          }
        />

        {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
        {image && (
          <div className="flex flex-col gap-3 border-y py-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={image.is_labeled ? "default" : "outline"} className="capitalize">{image.status}</Badge>
              <span className="text-sm text-muted-foreground">{image.width} × {image.height}</span>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={image.is_excluded} onCheckedChange={toggleExcluded} />
                Excluded
              </label>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="space-y-1"><p className="text-xs font-medium text-muted-foreground">Dataset split</p><Select value={image.split} onValueChange={(value) => void setSplit(value as AnnotationSplit)}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="train">Train</SelectItem><SelectItem value="val">Validation</SelectItem><SelectItem value="test">Test</SelectItem></SelectContent></Select></div>
              <div className="flex h-10 min-w-24 items-center gap-2 px-2 text-sm">
                {saveState === "saving" ? <><LoaderCircle className="size-4 animate-spin" />Saving...</> : saveState === "error" ? <span className="text-destructive">Save failed</span> : <><Check className="size-4 text-emerald-500" />Saved</>}
              </div>
              <Button variant="outline" size="icon" disabled={!previousId} onClick={() => previousId && void navigate(imageHref(previousId))} title="Previous image"><ChevronLeft /></Button>
              <Button variant="outline" size="icon" disabled={!nextId} onClick={() => nextId && void navigate(imageHref(nextId))} title="Next image"><ChevronRight /></Button>
            </div>
          </div>
        )}

        {loading ? <div className="min-h-[60vh] animate-pulse rounded-md border bg-muted/40" /> : !image || !project ? (
          <div className="flex min-h-72 flex-col items-center justify-center border-y text-center"><Database className="mb-3 size-8 text-muted-foreground" /><p className="font-medium">Image could not be loaded</p></div>
        ) : project.task_type === "image_classification" ? (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-h-[60vh] items-center justify-center overflow-auto rounded-md border bg-black p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${API_URL}/api/annotation-projects/${project.id}/images/${image.id}/content`} alt={image.file_name} className="max-h-[72vh] max-w-full object-contain" />
            </div>
            <aside className="space-y-3 border-l-0 p-1 lg:border-l lg:pl-4">
              <p className="font-semibold">Choose one class</p>
              {project.classes.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    const annotation: StoredAnnotation = { id: image.annotations[0]?.id ?? annotationId(), type: "classification", classId: item.id };
                    setImage({ ...image, annotations: [annotation], marked_empty: false });
                    scheduleSave({ annotations: [annotation], markedEmpty: false, excluded: image.is_excluded });
                  }}
                  className={cn("flex min-h-11 w-full items-center gap-3 rounded-md border px-3 text-left", selectedClass === item.id && "border-foreground bg-accent")}
                >
                  <span className="size-3 rounded-sm" style={{ backgroundColor: item.color }} />{item.name}
                </button>
              ))}
            </aside>
          </div>
        ) : project.task_type === "object_detection" ? (
          <DetectionCanvas
            key={editorKey}
            image={image}
            imageUrl={`${API_URL}/api/annotation-projects/${project.id}/images/${image.id}/content`}
            classes={project.classes}
            onChange={canvasChanged}
            onMarkEmpty={markEmpty}
          />
        ) : (
          <SegmentationCanvas
            key={editorKey}
            image={image}
            imageUrl={`${API_URL}/api/annotation-projects/${project.id}/images/${image.id}/content`}
            classes={project.classes}
            instanceMode={project.task_type === "instance_segmentation"}
            onChange={canvasChanged}
            onMarkEmpty={markEmpty}
          />
        )}
      </div>

      <AlertDialog open={Boolean(conflict)} onOpenChange={() => undefined}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annotation changed in another tab</AlertDialogTitle>
            <AlertDialogDescription>{language === "th" ? "งานในหน้านี้ยังไม่หาย เลือกโหลดข้อมูลจากเซิร์ฟเวอร์ หรือบันทึกงานในหน้านี้ทับ revision ล่าสุด" : "Your local work is still available. Reload the server copy, or overwrite the latest revision with this local copy."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => void reloadServer()}>Reload server</AlertDialogCancel>
            <AlertDialogAction onClick={() => void keepLocal()}>Keep local work</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(leaveTarget)} onOpenChange={(open) => !open && setLeaveTarget("")}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave with unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>{language === "th" ? "การบันทึกล่าสุดไม่สำเร็จ หากออกตอนนี้ การแก้ไขที่ยังไม่บันทึกจะหายไป" : "The latest save did not complete. Leaving now discards unsaved changes."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay</AlertDialogCancel>
            <AlertDialogAction onClick={() => router.push(leaveTarget)}>Discard and leave</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={revisionsOpen} onOpenChange={setRevisionsOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Revision history</DialogTitle><DialogDescription>At most 20 checkpoints are retained for this image.</DialogDescription></DialogHeader>
          <div className="max-h-[55dvh] space-y-2 overflow-y-auto">
            {revisions.length ? revisions.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div><p className="font-medium">Revision {item.revision}</p><p className="text-sm text-muted-foreground">{new Date(item.created_at).toLocaleString()}</p></div>
                <Button variant="outline" onClick={() => void restoreRevision(item.id)}>Restore</Button>
              </div>
            )) : <p className="py-8 text-center text-sm text-muted-foreground">No checkpoints yet</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setRevisionsOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
