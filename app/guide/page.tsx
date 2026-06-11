import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  Crosshair,
  Database,
  Download,
  FileArchive,
  FileText,
  Folder,
  Image as ImageIcon,
  Layers3,
  Play,
  ScanText,
  Settings2,
  SlidersHorizontal,
  Upload,
} from "lucide-react";
import { MainLayout } from "@/components/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";

type TreeKind = "folder" | "image" | "file";

interface TreeRow {
  label: string;
  kind: TreeKind;
  depth: number;
}

const workflowStages = [
  {
    title: "Upload",
    description: "Zip the dataset and upload it on the Dataset page.",
    icon: Upload,
  },
  {
    title: "Match",
    description: "Pick a model; AILAB filters datasets by compatible format.",
    icon: Database,
  },
  {
    title: "Tune",
    description: "Adjust shared settings and model-specific parameters.",
    icon: SlidersHorizontal,
  },
  {
    title: "Train",
    description: "Queue the job and monitor logs, status, and metrics.",
    icon: Play,
  },
  {
    title: "Export",
    description: "Download weights, logs, metrics, and OCR artifacts.",
    icon: Download,
  },
];

const modelGuides = [
  {
    title: "ResNet / EfficientNet",
    task: "Image classification",
    format: "imagefolder",
    icon: Boxes,
    checklist: [
      "Put images inside one folder per class.",
      "Use ImageNet weights for the first run.",
      "Start with 224 image size and increase only if needed.",
    ],
    next: "Use this when the answer is one class per image.",
  },
  {
    title: "YOLOv11 / Faster R-CNN",
    task: "Object detection",
    format: "yolo_detection",
    icon: Crosshair,
    checklist: [
      "Include data.yaml at the dataset root.",
      "Pair images/train with labels/train text files.",
      "Choose YOLOv11 for speed; Faster R-CNN for a two-stage baseline.",
    ],
    next: "Use this when each image needs bounding boxes.",
  },
  {
    title: "DeepLabV3+",
    task: "Semantic segmentation",
    format: "semantic_masks",
    icon: Layers3,
    checklist: [
      "Each image needs a matching mask file.",
      "Set Mask classes to the number of pixel classes.",
      "Use ignore value 255 when masks contain unlabeled pixels.",
    ],
    next: "Use this when every pixel needs a class.",
  },
  {
    title: "Mask R-CNN",
    task: "Instance segmentation",
    format: "coco_instances",
    icon: BadgeCheck,
    checklist: [
      "Use COCO-style JSON annotations.",
      "Make sure image filenames in JSON resolve inside the dataset.",
      "Use this when separate object instances matter.",
    ],
    next: "Use this when objects need masks and identity.",
  },
  {
    title: "PaddleOCR",
    task: "OCR",
    format: "paddleocr_labels",
    icon: ScanText,
    checklist: [
      "Choose recognition for cropped text images.",
      "Choose detection for text boxes or polygons.",
      "Use the PaddleOCR setup helper to select config and checkpoint.",
    ],
    next: "Use this for OCR fine-tuning with PaddleOCR labels.",
  },
  {
    title: "Tesseract",
    task: "OCR",
    format: "tesseract_ground_truth",
    icon: FileText,
    checklist: [
      "Pair each training image with a matching .gt.txt file.",
      "Use a short output model code such as invoice_th.",
      "Increase max iterations for harder fonts or languages.",
    ],
    next: "Use this for Tesseract language or font adaptation.",
  },
];

const datasetLayouts = [
  {
    title: "ImageFolder",
    format: "imagefolder",
    rows: [
      { label: "dataset.zip", kind: "folder", depth: 0 },
      { label: "train", kind: "folder", depth: 1 },
      { label: "cat", kind: "folder", depth: 2 },
      { label: "cat_001.jpg", kind: "image", depth: 3 },
      { label: "dog", kind: "folder", depth: 2 },
      { label: "dog_001.jpg", kind: "image", depth: 3 },
      { label: "val", kind: "folder", depth: 1 },
    ] satisfies TreeRow[],
  },
  {
    title: "YOLO detection",
    format: "yolo_detection",
    rows: [
      { label: "dataset.zip", kind: "folder", depth: 0 },
      { label: "data.yaml", kind: "file", depth: 1 },
      { label: "images", kind: "folder", depth: 1 },
      { label: "train/image_001.jpg", kind: "image", depth: 2 },
      { label: "val/image_101.jpg", kind: "image", depth: 2 },
      { label: "labels", kind: "folder", depth: 1 },
      { label: "train/image_001.txt", kind: "file", depth: 2 },
      { label: "val/image_101.txt", kind: "file", depth: 2 },
    ] satisfies TreeRow[],
  },
  {
    title: "COCO instances",
    format: "coco_instances",
    rows: [
      { label: "dataset.zip", kind: "folder", depth: 0 },
      { label: "train", kind: "folder", depth: 1 },
      { label: "image_001.jpg", kind: "image", depth: 2 },
      { label: "_annotations.coco.json", kind: "file", depth: 2 },
      { label: "val", kind: "folder", depth: 1 },
      { label: "_annotations.coco.json", kind: "file", depth: 2 },
    ] satisfies TreeRow[],
  },
  {
    title: "PaddleOCR",
    format: "paddleocr_labels",
    rows: [
      { label: "dataset.zip", kind: "folder", depth: 0 },
      { label: "image_001.jpg", kind: "image", depth: 1 },
      { label: "rec_gt_train.txt", kind: "file", depth: 1 },
      { label: "rec_gt_val.txt", kind: "file", depth: 1 },
      { label: "det_gt_train.txt", kind: "file", depth: 1 },
    ] satisfies TreeRow[],
  },
  {
    title: "Tesseract",
    format: "tesseract_ground_truth",
    rows: [
      { label: "dataset.zip", kind: "folder", depth: 0 },
      { label: "line_001.tif", kind: "image", depth: 1 },
      { label: "line_001.gt.txt", kind: "file", depth: 1 },
      { label: "line_002.tif", kind: "image", depth: 1 },
      { label: "line_002.gt.txt", kind: "file", depth: 1 },
    ] satisfies TreeRow[],
  },
];

function TreeIcon({ kind }: { kind: TreeKind }) {
  if (kind === "folder") return <Folder className="h-4 w-4 text-amber-500" />;
  if (kind === "image") return <ImageIcon className="h-4 w-4 text-emerald-500" />;
  return <FileText className="h-4 w-4 text-muted-foreground" />;
}

function DatasetDiagram({
  format,
  rows,
  title,
}: {
  format: string;
  rows: TreeRow[];
  title: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant="secondary">{format}</Badge>
      </div>
      <div className="console-grid mt-4 rounded-lg border border-border bg-card p-3">
        <div className="space-y-2 font-mono text-xs">
          {rows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className="flex items-center gap-2"
              style={{ paddingLeft: row.depth * 16 }}
            >
              <TreeIcon kind={row.kind} />
              <span className="break-all text-foreground">{row.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function GuidePage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Guide"
          title="Training Guide"
          description="A practical map for choosing a model, preparing the right dataset format, and starting a clean training run in AILAB."
          actions={
            <>
              <Button asChild variant="outline">
                <Link href="/dataset">
                  <Upload className="h-4 w-4" />
                  Upload dataset
                </Link>
              </Button>
              <Button asChild>
                <Link href="/config">
                  Configure run
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </>
          }
        />

        <section className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenCheck className="h-5 w-5" />
                The AILAB Training Path
              </CardTitle>
              <CardDescription>
                Follow this order when starting a new model run.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-5">
                {workflowStages.map(({ description, icon: Icon, title }, index) => (
                  <div
                    key={title}
                    className="rounded-lg border border-border bg-background/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <p className="mt-4 text-sm font-semibold">{title}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {description}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Before You Train</CardTitle>
              <CardDescription>
                A quick sanity check that catches most failed jobs early.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Dataset format matches the selected model.",
                "Validation files exist when the trainer expects them.",
                "PaddleOCR checkpoint paths exist inside the OCR worker.",
                "The selected dataset appears in Configuration.",
              ].map((item) => (
                <div className="flex items-start gap-3" key={item}>
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <p className="text-sm leading-6 text-muted-foreground">{item}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Tabs defaultValue="models" className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="models">Model guide</TabsTrigger>
            <TabsTrigger value="datasets">Dataset layouts</TabsTrigger>
            <TabsTrigger value="ocr">PaddleOCR tips</TabsTrigger>
          </TabsList>

          <TabsContent value="models">
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {modelGuides.map(
                ({ checklist, format, icon: Icon, next, task, title }) => (
                  <div
                    key={title}
                    className="rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                        </span>
                        <div>
                          <h2 className="text-sm font-semibold">{title}</h2>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {task}
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">{format}</Badge>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                      {next}
                    </p>
                    <div className="mt-4 space-y-2">
                      {checklist.map((item) => (
                        <div className="flex items-start gap-2" key={item}>
                          <StatusBadge tone="success">OK</StatusBadge>
                          <p className="text-xs leading-5 text-muted-foreground">
                            {item}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ),
              )}
            </div>
          </TabsContent>

          <TabsContent value="datasets">
            <div className="grid gap-4 lg:grid-cols-2">
              {datasetLayouts.map((layout) => (
                <DatasetDiagram key={layout.title} {...layout} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ocr">
            <section className="grid gap-4 xl:grid-cols-[.85fr_1.15fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ScanText className="h-5 w-5" />
                    Recognition vs Detection
                  </CardTitle>
                  <CardDescription>
                    Pick the PaddleOCR recipe by the kind of label file you have.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-background/70 p-4">
                    <StatusBadge tone="success">Recognition</StatusBadge>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Use `rec_gt_train.txt` when each image is already cropped
                      to a word or text line.
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/70 p-4">
                    <StatusBadge tone="warning">Detection</StatusBadge>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Use `det_gt_train.txt` when the model must learn where
                      text appears in the full image.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5" />
                    Checkpoint Paths
                  </CardTitle>
                  <CardDescription>
                    The Configuration page now has helpers so users do not need
                    to type long PaddleOCR paths from memory.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    {[
                      {
                        title: "None",
                        body: "No override is sent; the selected config decides.",
                      },
                      {
                        title: "Previous run",
                        body: "Type only the AILAB run folder and the path is built.",
                      },
                      {
                        title: "Custom",
                        body: "Paste a full path only when the checkpoint is elsewhere.",
                      },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="rounded-lg border border-border bg-background/70 p-4"
                      >
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {item.body}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-dashed border-border bg-background/70 p-4">
                    <div className="flex items-center gap-2">
                      <FileArchive className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Generated path example</p>
                    </div>
                    <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
                      /app/runs/previous_ocr_run_1710000000000/best_accuracy
                    </p>
                  </div>
                </CardContent>
              </Card>
            </section>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
