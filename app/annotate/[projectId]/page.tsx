"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  ImageIcon,
  LoaderCircle,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { MainLayout } from "@/components/MainLayout";
import { useLanguage } from "@/components/language-provider";
import { PageHeader } from "@/components/workspace/page-header";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiBaseUrl } from "@/lib/api";
import {
  apiError,
  CLASS_COLORS,
  type AnnotationClass,
  type AnnotationImageStatus,
  type AnnotationImageSummary,
  type AnnotationOperation,
  type AnnotationProject,
  type AnnotationSplit,
  taskLabel,
} from "@/lib/annotation";
import { cn } from "@/lib/utils";

const API_URL = apiBaseUrl();
const PAGE_SIZE = 48;
type SplitFilter = "all" | AnnotationSplit;
type StatusFilter = "all" | AnnotationImageStatus;
type Sort = "original" | "name_asc" | "name_desc" | "updated_desc";
type SplitCounts = Record<SplitFilter, number>;

function newClass(index: number): AnnotationClass {
  return {
    id: `${Date.now()}-${index}-${Math.random()}`,
    name: "",
    color: CLASS_COLORS[index % CLASS_COLORS.length],
  };
}

function uploadImport(projectId: string, file: File, onProgress: (value: number) => void) {
  return new Promise<AnnotationOperation>((resolve, reject) => {
    const request = new XMLHttpRequest();
    const data = new FormData();
    data.append("file", file);
    request.open("POST", `${API_URL}/api/annotation-projects/${projectId}/imports`);
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round(event.loaded * 100 / event.total));
    };
    request.onerror = () => reject(new Error("Upload connection failed"));
    request.onload = () => {
      let body: { operation?: AnnotationOperation; detail?: unknown } = {};
      try { body = JSON.parse(request.responseText); } catch { /* handled below */ }
      if (request.status >= 200 && request.status < 300 && body.operation) resolve(body.operation);
      else reject(new Error(typeof body.detail === "string" ? body.detail : `Request failed (${request.status})`));
    };
    request.send(data);
  });
}

export default function AnnotationDataManagerPage() {
  const { t } = useLanguage();
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const projectId = params.projectId;
  const [project, setProject] = useState<AnnotationProject | null>(null);
  const [images, setImages] = useState<AnnotationImageSummary[]>([]);
  const [splitCounts, setSplitCounts] = useState<SplitCounts>({ all: 0, train: 0, val: 0, test: 0 });
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [split, setSplit] = useState<SplitFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<Sort>("original");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [operation, setOperation] = useState<AnnotationOperation | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState("");
  const [settingsClasses, setSettingsClasses] = useState<AnnotationClass[]>([]);
  const [ratios, setRatios] = useState({ train: 80, val: 10, test: 10 });
  const [savingSettings, setSavingSettings] = useState(false);
  const [rebalanceOpen, setRebalanceOpen] = useState(false);

  const loadImages = useCallback(async (
    nextOffset = offset,
    nextSplit = split,
    nextStatus = status,
    nextSearch = search,
    nextSort = sort,
    quiet = false,
  ) => {
    if (!quiet) setLoading(true);
    const query = new URLSearchParams({
      split: nextSplit,
      status: nextStatus,
      search: nextSearch,
      sort: nextSort,
      offset: String(nextOffset),
      limit: String(PAGE_SIZE),
    });
    try {
      const response = await fetch(
        `${API_URL}/api/annotation-projects/${projectId}/images?${query}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error(await apiError(response));
      const body = await response.json() as {
        project: AnnotationProject;
        images: AnnotationImageSummary[];
        total: number;
        splitCounts: SplitCounts;
        operation?: AnnotationOperation | null;
      };
      setProject(body.project);
      setImages(body.images);
      setTotal(body.total);
      setSplitCounts(body.splitCounts);
      if (body.operation) setOperation(body.operation);
      setOffset(nextOffset);
      setSelected(new Set());
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load annotation project");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [offset, projectId, search, sort, split, status]);

  useEffect(() => { void loadImages(0, "all", "all", "", "original"); }, [projectId]);

  useEffect(() => {
    if (!operation || !["queued", "running"].includes(operation.status)) return;
    const timer = window.setInterval(async () => {
      const response = await fetch(`${API_URL}/api/annotation-operations/${operation.id}`, { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json() as { operation: AnnotationOperation };
      setOperation(body.operation);
      if (body.operation.status === "completed") {
        if (body.operation.kind === "publish" && body.operation.result.datasetName) {
          router.push(`/dataset?published=${encodeURIComponent(body.operation.result.datasetName)}`);
        } else {
          void loadImages(0, split, status, search, sort, true);
        }
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [loadImages, operation, router, search, sort, split, status]);

  const changeView = (next: Partial<{ split: SplitFilter; status: StatusFilter; sort: Sort }>) => {
    const nextSplit = next.split ?? split;
    const nextStatus = next.status ?? status;
    const nextSort = next.sort ?? sort;
    setSplit(nextSplit);
    setStatus(nextStatus);
    setSort(nextSort);
    void loadImages(0, nextSplit, nextStatus, search, nextSort);
  };

  const submitSearch = () => {
    const value = searchInput.trim();
    setSearch(value);
    void loadImages(0, split, status, value, sort);
  };

  const editorHref = (imageId: string) => {
    const query = new URLSearchParams({ split, status, search, sort });
    return `/annotate/${projectId}/${imageId}?${query}`;
  };

  const bulkUpdate = async (payload: { split?: AnnotationSplit; excluded?: boolean; automatic?: boolean }) => {
    if (!selected.size) return;
    try {
      const response = await fetch(`${API_URL}/api/annotation-projects/${projectId}/images/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageIds: [...selected], ...payload }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      await loadImages(offset, split, status, search, sort);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update selected images");
    }
  };

  const beginSettings = () => {
    if (!project) return;
    setSettingsName(project.name);
    setSettingsClasses(project.classes.map((item) => ({ ...item })));
    setRatios({ train: project.train_ratio, val: project.val_ratio, test: project.test_ratio });
    setSettingsOpen(true);
  };

  const saveSettings = async () => {
    if (!project) return;
    setSavingSettings(true);
    try {
      const response = await fetch(`${API_URL}/api/annotation-projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settingsName.trim(),
          classes: settingsClasses.map((item) => ({ ...item, name: item.name.trim() })),
          trainRatio: ratios.train,
          valRatio: ratios.val,
          testRatio: ratios.test,
        }),
      });
      if (!response.ok) throw new Error(await apiError(response));
      const body = await response.json() as { project: AnnotationProject };
      setProject(body.project);
      setSettingsOpen(false);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save project settings");
    } finally {
      setSavingSettings(false);
    }
  };

  const rebalance = async () => {
    try {
      const response = await fetch(`${API_URL}/api/annotation-projects/${projectId}/rebalance`, { method: "POST" });
      if (!response.ok) throw new Error(await apiError(response));
      setRebalanceOpen(false);
      await loadImages(0, split, status, search, sort);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not rebalance dataset split");
    }
  };

  const importImages = async () => {
    if (!importFile) return;
    setUploadProgress(0);
    setError("");
    try {
      const next = await uploadImport(projectId, importFile, setUploadProgress);
      setOperation(next);
      setImportOpen(false);
      setImportFile(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not upload images");
    }
  };

  const publish = async () => {
    try {
      const response = await fetch(`${API_URL}/api/annotation-projects/${projectId}/publish`, { method: "POST" });
      if (!response.ok) throw new Error(await apiError(response));
      const body = await response.json() as { operation: AnnotationOperation };
      setOperation(body.operation);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not publish dataset");
    }
  };

  const operate = async (action: "retry" | "cancel") => {
    if (!operation) return;
    try {
      const response = await fetch(
        `${API_URL}/api/annotation-operations/${operation.id}/${action}`,
        { method: "POST" },
      );
      if (!response.ok) throw new Error(await apiError(response));
      const body = await response.json() as { operation: AnnotationOperation };
      setOperation(body.operation);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `Could not ${action} operation`);
    }
  };

  const operationBusy = operation?.status === "queued" || operation?.status === "running";
  const ratioTotal = ratios.train + ratios.val + ratios.test;
  const validSettings = Boolean(
    settingsName.trim()
    && settingsClasses.length
    && settingsClasses.every((item) => item.name.trim())
    && ratioTotal === 100,
  );
  const progress = project?.image_count
    ? project.completed_count / project.image_count * 100
    : 0;
  const splitOptions: { id: SplitFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "train", label: "Train" },
    { id: "val", label: "Validation" },
    { id: "test", label: "Test" },
  ];
  const allPageSelected = Boolean(images.length) && images.every((image) => selected.has(image.id));

  return (
    <MainLayout>
      <div className="mx-auto max-w-[100rem] space-y-5">
        <PageHeader
          title={project?.name ?? "Annotation project"}
          description={project
            ? `${taskLabel(project.task_type)} · ${project.completed_count} of ${project.image_count} ready`
            : "Loading project..."}
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline"><Link href="/annotate"><ArrowLeft />Projects</Link></Button>
              <Button variant="outline" onClick={beginSettings} disabled={!project || operationBusy}><Settings2 />Settings</Button>
              <Button variant="outline" onClick={() => setImportOpen(true)} disabled={!project || operationBusy}><Plus />Add images</Button>
              <Button onClick={publish} disabled={!project || project.completed_count !== project.image_count || !project.image_count || operationBusy}>
                {operationBusy && operation?.kind === "publish" ? <LoaderCircle className="animate-spin" /> : <Upload />}
                Publish
              </Button>
            </div>
          }
        />

        {project && (
          <div className="grid gap-3 border-y py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div>
              <div className="mb-2 flex justify-between gap-3 text-sm">
                <span>{Math.round(progress)}% ready</span>
                <span>{project.completed_count}/{project.image_count}</span>
              </div>
              <Progress value={progress} />
            </div>
            <p className="text-sm text-muted-foreground">{t("Open an image to label it. Empty and excluded images are tracked separately.")}</p>
          </div>
        )}

        {operation && (
          <div className={cn(
            "space-y-2 rounded-md border px-4 py-3",
            operation.status === "failed" && "border-destructive/40 bg-destructive/10",
          )}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="flex items-center gap-2 font-medium">
                {operationBusy && <LoaderCircle className="size-4 animate-spin" />}
                {operation.kind === "import" ? "Image import" : "Dataset publish"}: {operation.status}
              </span>
              <span>{operation.processed_count}/{operation.total_count || "?"}</span>
            </div>
            {operationBusy && <Progress value={operation.progress} />}
            {operation.error_detail && <p className="text-sm text-destructive">{operation.error_detail}</p>}
            <div className="flex gap-2">
              {operationBusy && <Button size="sm" variant="outline" onClick={() => void operate("cancel")}>Cancel operation</Button>}
              {(operation.status === "failed" || operation.status === "cancelled") && (
                <Button size="sm" variant="outline" onClick={() => void operate("retry")}><RotateCcw />Retry</Button>
              )}
            </div>
            {operation.result.skippedFiles?.length ? (
              <details className="text-sm text-muted-foreground">
                <summary>{operation.result.skipped} skipped files</summary>
                <ul className="mt-2 max-h-36 overflow-auto">
                  {operation.result.skippedFiles.map((item) => <li key={item.file}>{item.file}: {item.reason}</li>)}
                </ul>
              </details>
            ) : null}
          </div>
        )}
        {error && <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}

        <section>
          <div className="space-y-3 border-b pb-4">
            <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Dataset split">
              {splitOptions.map((option) => (
                <Button
                  key={option.id}
                  type="button"
                  variant={split === option.id ? "secondary" : "ghost"}
                  className="shrink-0"
                  onClick={() => changeView({ split: option.id })}
                  role="tab"
                  aria-selected={split === option.id}
                >
                  {option.label}<Badge variant="outline" className="ml-1.5">{splitCounts[option.id]}</Badge>
                </Button>
              ))}
            </div>
            <div className="grid gap-2 sm:grid-cols-[minmax(12rem,1fr)_11rem_11rem_auto]">
              <div className="flex">
                <Input
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && submitSearch()}
                  placeholder="Search file name"
                  className="rounded-r-none"
                />
                <Button type="button" variant="outline" size="icon" className="rounded-l-none border-l-0" onClick={submitSearch} title="Search">
                  <Search />
                </Button>
              </div>
              <Select value={status} onValueChange={(value) => changeView({ status: value as StatusFilter })}>
                <SelectTrigger aria-label="Filter annotation status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  <SelectItem value="unlabeled">Unlabeled</SelectItem>
                  <SelectItem value="labeled">Labeled</SelectItem>
                  <SelectItem value="empty">Empty</SelectItem>
                  <SelectItem value="excluded">Excluded</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sort} onValueChange={(value) => changeView({ sort: value as Sort })}>
                <SelectTrigger aria-label="Sort images"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="original">Import order</SelectItem>
                  <SelectItem value="name_asc">Name A-Z</SelectItem>
                  <SelectItem value="name_desc">Name Z-A</SelectItem>
                  <SelectItem value="updated_desc">Recently edited</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => setRebalanceOpen(true)} disabled={!project?.image_count}><RotateCcw />Rebalance</Button>
            </div>
          </div>

          {images.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b py-3">
              <Button
                variant="outline"
                onClick={() => setSelected(allPageSelected ? new Set() : new Set(images.map((image) => image.id)))}
              >
                {allPageSelected ? "Clear page" : "Select page"}
              </Button>
              <span className="mr-2 text-sm text-muted-foreground">{selected.size} selected</span>
              <Button size="sm" variant="outline" disabled={!selected.size} onClick={() => void bulkUpdate({ split: "train" })}>Train</Button>
              <Button size="sm" variant="outline" disabled={!selected.size} onClick={() => void bulkUpdate({ split: "val" })}>Validation</Button>
              <Button size="sm" variant="outline" disabled={!selected.size} onClick={() => void bulkUpdate({ split: "test" })}>Test</Button>
              <Button size="sm" variant="outline" disabled={!selected.size} onClick={() => void bulkUpdate({ automatic: true })}>Automatic split</Button>
              <Button size="sm" variant="outline" disabled={!selected.size} onClick={() => void bulkUpdate({ excluded: true })}>Exclude</Button>
              <Button size="sm" variant="outline" disabled={!selected.size} onClick={() => void bulkUpdate({ excluded: false })}>Include</Button>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {Array.from({ length: 12 }).map((_, index) => <div key={index} className="aspect-[4/3] animate-pulse rounded-md bg-muted" />)}
            </div>
          ) : images.length ? (
            <div className="grid grid-cols-2 gap-3 py-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {images.map((image) => (
                <article key={image.id} className={cn("group min-w-0 overflow-hidden rounded-md border bg-card", selected.has(image.id) && "border-foreground ring-1 ring-foreground")}>
                  <div className="relative">
                    <Link href={editorHref(image.id)} className="block aspect-[4/3] overflow-hidden bg-muted" aria-label={`Label ${image.file_name}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`${API_URL}/api/annotation-projects/${projectId}/images/${image.id}/thumbnail`}
                        alt={image.file_name}
                        loading="lazy"
                        className={cn("size-full object-cover transition-transform duration-200 group-hover:scale-[1.02]", image.is_excluded && "opacity-45 grayscale")}
                      />
                    </Link>
                    <button
                      type="button"
                      className={cn("absolute left-2 top-2 size-6 rounded border bg-background/90", selected.has(image.id) && "bg-foreground text-background")}
                      onClick={() => setSelected((current) => {
                        const next = new Set(current);
                        if (next.has(image.id)) next.delete(image.id); else next.add(image.id);
                        return next;
                      })}
                      aria-label={selected.has(image.id) ? `Deselect ${image.file_name}` : `Select ${image.file_name}`}
                    >
                      {selected.has(image.id) && <CheckCircle2 className="m-auto size-4" />}
                    </button>
                    <span className="absolute right-2 top-2 rounded border bg-background/90 px-1.5 py-0.5 text-[11px] font-medium capitalize">{image.status}</span>
                  </div>
                  <div className="space-y-2 p-3">
                    <Link href={editorHref(image.id)} className="block truncate text-sm font-medium hover:underline" title={image.file_name}>{image.file_name}</Link>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{image.split === "val" ? "Validation" : image.split}</span>
                      <span>{image.split_source === "manual" ? "Manual" : "Auto"}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex min-h-72 flex-col items-center justify-center py-8 text-center">
              <ImageIcon className="mb-3 size-8 text-muted-foreground" />
              <p className="font-medium">No images in this view</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("Try another split, status, or search term.")}</p>
            </div>
          )}

          {total > PAGE_SIZE && (
            <div className="flex items-center justify-between border-t py-4">
              <p className="text-sm text-muted-foreground">{offset + 1}-{Math.min(offset + images.length, total)} of {total}</p>
              <div className="flex gap-2">
                <Button variant="outline" disabled={!offset || loading} onClick={() => void loadImages(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
                <Button variant="outline" disabled={offset + images.length >= total || loading} onClick={() => void loadImages(offset + PAGE_SIZE)}>Next</Button>
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add images</DialogTitle>
            <DialogDescription>{t("Images are imported in the background. Duplicate and unreadable files are skipped and reported.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="annotation-import">Image ZIP</Label>
            <Input id="annotation-import" type="file" accept=".zip,application/zip" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} />
            {uploadProgress > 0 && uploadProgress < 100 && <Progress value={uploadProgress} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancel</Button>
            <Button onClick={importImages} disabled={!importFile}><Upload />Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Project settings</DialogTitle>
            <DialogDescription>{t("Ratio changes affect automatic splits only. Use Rebalance to replace manual split choices.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <div className="grid gap-2"><Label htmlFor="settings-name">Project name</Label><Input id="settings-name" value={settingsName} onChange={(event) => setSettingsName(event.target.value)} /></div>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><Label>Classes</Label><Button variant="outline" size="sm" onClick={() => setSettingsClasses((items) => [...items, newClass(items.length)])}><Plus />Add class</Button></div>
              {settingsClasses.map((item, index) => (
                <div key={item.id} className="grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-2">
                  <Input
                    type="color"
                    value={item.color}
                    aria-label={`Color for class ${index + 1}`}
                    onChange={(event) => setSettingsClasses((items) => items.map((entry) => entry.id === item.id ? { ...entry, color: event.target.value as AnnotationClass["color"] } : entry))}
                  />
                  <Input
                    value={item.name}
                    placeholder={`Class ${index + 1}`}
                    onChange={(event) => setSettingsClasses((items) => items.map((entry) => entry.id === item.id ? { ...entry, name: event.target.value } : entry))}
                  />
                  <Button variant="outline" size="icon" disabled={settingsClasses.length === 1} onClick={() => setSettingsClasses((items) => items.filter((entry) => entry.id !== item.id))} title="Remove class"><Circle className="size-3" /></Button>
                </div>
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {(["train", "val", "test"] as const).map((key) => (
                <div key={key} className="grid gap-1.5">
                  <Label htmlFor={`settings-${key}`} className="capitalize">{key === "val" ? "Validation" : key} %</Label>
                  <Input id={`settings-${key}`} type="number" min={key === "train" ? 1 : 0} max="100" value={ratios[key]} onChange={(event) => setRatios((current) => ({ ...current, [key]: Number(event.target.value) }))} />
                </div>
              ))}
            </div>
            <p className={ratioTotal === 100 ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>Total: {ratioTotal}%</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Cancel</Button>
            <Button onClick={saveSettings} disabled={!validSettings || savingSettings}>{savingSettings && <LoaderCircle className="animate-spin" />}Save settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={rebalanceOpen} onOpenChange={setRebalanceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rebalance all images?</AlertDialogTitle>
            <AlertDialogDescription>{t("This replaces every manual split assignment using the current Train, Validation, and Test ratios.")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={rebalance}>Rebalance all</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
