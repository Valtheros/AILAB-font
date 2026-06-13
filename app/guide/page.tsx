import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Boxes,
  CheckCircle2,
  Crosshair,
  Database,
  Download,
  FileArchive,
  FileText,
  Folder,
  Image as ImageIcon,
  Layers3,
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
import { I18nText } from "@/components/i18n-text";

type TreeKind = "folder" | "image" | "file";

type GuideTab = "workflow" | "models" | "datasets" | "ocr";

interface TreeRow {
  label: string;
  kind: TreeKind;
  depth: number;
}

interface GuidePageProps {
  searchParams?: Promise<{ tab?: string | string[] }> | { tab?: string | string[] };
}

interface ModelGuide {
  title: string;
  task: string;
  format: string;
  accepted: string[];
  icon: typeof Boxes;
  useWhen: string;
  prepare: string[];
  importResult: string[];
  configure: string[];
  avoid: string[];
}

function guideTabFromSearch(value: string | string[] | undefined): GuideTab {
  const tab = Array.isArray(value) ? value[0] : value;
  return tab === "workflow" || tab === "datasets" || tab === "ocr" || tab === "models"
    ? tab
    : "workflow";
}

const workflowStages = [
  {
    title: "Choose the task",
    description: "Decide what the answer should look like: one class, boxes, masks, or text.",
    icon: BookOpenCheck,
  },
  {
    title: "Prepare labels",
    description: "Export a ZIP from a supported annotation tool or arrange files in the shown layout.",
    icon: FileArchive,
  },
  {
    title: "Inspect and import",
    description: "Upload the ZIP, review detected formats and ready models, then import it.",
    icon: Upload,
  },
  {
    title: "Configure model",
    description: "Open Configuration, pick a compatible dataset, set the model options, and review the run.",
    icon: SlidersHorizontal,
  },
  {
    title: "Train and export",
    description: "Start training, watch logs and metrics, then download artifacts from Results.",
    icon: Download,
  },
];

const decisionRows = [
  {
    need: "One label for the whole image",
    model: "ResNet or EfficientNet",
    dataset: "ImageFolder",
  },
  {
    need: "Find object positions with boxes",
    model: "YOLOv11 or Faster R-CNN",
    dataset: "YOLO detection or COCO boxes",
  },
  {
    need: "Classify every pixel",
    model: "DeepLabV3+",
    dataset: "Image and semantic mask pairs",
  },
  {
    need: "Separate object masks per instance",
    model: "Mask R-CNN",
    dataset: "COCO instance masks",
  },
  {
    need: "Read cropped words or text lines",
    model: "PaddleOCR recognition or Tesseract",
    dataset: "PaddleOCR rec labels or Tesseract .gt.txt",
  },
  {
    need: "Find text regions in full images",
    model: "PaddleOCR detection",
    dataset: "PaddleOCR det labels",
  },
];

const modelGuides: ModelGuide[] = [
  {
    title: "ResNet / EfficientNet",
    task: "Image classification",
    format: "imagefolder",
    accepted: ["ImageFolder"],
    icon: Boxes,
    useWhen: "Use when each image has exactly one final class, such as pass/fail, product type, or disease category.",
    prepare: [
      "Create one folder per class under train/.",
      "Put validation images under val/ with the same class folder names when available.",
      "Do not mix detection labels or masks inside the class folders.",
    ],
    importResult: [
      "AILAB detects imagefolder.",
      "Ready models should include ResNet and EfficientNet.",
    ],
    configure: [
      "Start with ImageNet weights enabled.",
      "Use image size 224 for the first run.",
      "Increase epochs only after confirming the first run learns.",
    ],
    avoid: [
      "Do not use this when one image can contain multiple objects that need positions.",
      "Do not use this when the output must be a mask or text string.",
    ],
  },
  {
    title: "YOLOv11",
    task: "Object detection",
    format: "yolo_detection",
    accepted: ["YOLO detection", "COCO boxes converted by import"],
    icon: Crosshair,
    useWhen: "Use when the goal is fast bounding-box detection for one or more objects in each image.",
    prepare: [
      "Use YOLO labels with data.yaml, images/train, and labels/train.",
      "COCO box datasets can also be uploaded; AILAB creates YOLO files under .ailab_normalized.",
      "Each label row must be class_id x_center y_center width height with normalized values.",
    ],
    importResult: [
      "Ready models should include YOLOv11 when yolo_detection is present.",
      "COCO box uploads should show normalized YOLO detection format after import.",
    ],
    configure: [
      "Start with Nano or Small model size for a quick baseline.",
      "Keep pretrained weights enabled.",
      "Use 640 image size unless small objects need more detail.",
    ],
    avoid: [
      "Do not upload YOLO polygon segmentation and expect detection unless boxes dominate.",
      "Do not use this when each object needs a separate mask.",
    ],
  },
  {
    title: "Faster R-CNN",
    task: "Object detection",
    format: "yolo_detection or coco_instances",
    accepted: ["YOLO detection", "COCO boxes"],
    icon: Crosshair,
    useWhen: "Use when a two-stage detector baseline is preferred over YOLO speed.",
    prepare: [
      "Upload YOLO detection or COCO box annotations.",
      "COCO files must reference image filenames that exist inside the ZIP.",
      "Box-only COCO is valid for Faster R-CNN.",
    ],
    importResult: [
      "Ready models should include Faster R-CNN for YOLO or COCO box datasets.",
      "No mask annotations are required for this model.",
    ],
    configure: [
      "Keep COCO weights enabled for the first run.",
      "Use short side 640 and long side cap 1333 as the initial baseline.",
      "Tune score threshold after training when reviewing predictions.",
    ],
    avoid: [
      "Do not choose this for pure image classification.",
      "Do not expect pixel masks from this detector.",
    ],
  },
  {
    title: "DeepLabV3+",
    task: "Semantic segmentation",
    format: "semantic_masks",
    accepted: ["Image and mask pairs"],
    icon: Layers3,
    useWhen: "Use when every pixel needs one class, such as road/background/object area.",
    prepare: [
      "Create train/images and train/masks folders.",
      "Each image must have a mask with the same base filename.",
      "Mask pixel values must match the class IDs used for training.",
    ],
    importResult: [
      "Ready models should include DeepLabV3+ only.",
      "Import will fail if masks are missing for images.",
    ],
    configure: [
      "Set Mask classes to the number of pixel classes.",
      "Use ignore value 255 only if masks contain unlabeled pixels.",
      "Start with resnet34 encoder and ImageNet weights.",
    ],
    avoid: [
      "Do not use this when separate instances of the same class must be distinguished.",
      "Do not use RGB color masks unless they are encoded into class IDs first.",
    ],
  },
  {
    title: "Mask R-CNN",
    task: "Instance segmentation",
    format: "coco_instances",
    accepted: ["COCO instance masks"],
    icon: BadgeCheck,
    useWhen: "Use when each object needs both a box and its own instance mask.",
    prepare: [
      "Export COCO JSON with segmentation polygons or RLE masks.",
      "Include images referenced by the COCO file inside the ZIP.",
      "Make sure annotations contain real masks, not only bounding boxes.",
    ],
    importResult: [
      "Ready models should include Mask R-CNN only when COCO masks are present.",
      "COCO box-only datasets stay compatible with Faster R-CNN but not Mask R-CNN.",
    ],
    configure: [
      "Keep COCO weights enabled for the first run.",
      "Use the default detection thresholds until a baseline finishes.",
      "Check failed imports for missing image references in JSON.",
    ],
    avoid: [
      "Do not choose Mask R-CNN for box-only COCO datasets.",
      "Do not use semantic masks where all objects of one class are merged together.",
    ],
  },
  {
    title: "PaddleOCR",
    task: "OCR detection or recognition",
    format: "paddleocr_labels",
    accepted: ["PaddleOCR rec/det labels", "Tesseract .gt.txt converted to rec"],
    icon: ScanText,
    useWhen: "Use when training OCR with PaddleOCR recipes for text detection or text recognition.",
    prepare: [
      "For recognition, use cropped text images with rec_gt_train.txt.",
      "For detection, use full images with det_gt_train.txt box or polygon labels.",
      "Tesseract .gt.txt recognition data can be imported and normalized for PaddleOCR recognition.",
    ],
    importResult: [
      "Ready models should include PaddleOCR when paddleocr_labels is present.",
      "Preview shows OCR tasks such as rec or det.",
    ],
    configure: [
      "Choose Recognition or Detection in the PaddleOCR base model selector.",
      "Use the preset config before trying custom paths.",
      "Use Previous run only when fine-tuning from an AILAB OCR checkpoint.",
    ],
    avoid: [
      "Do not choose recognition for full-page images unless text is already cropped.",
      "Do not choose detection when your labels only contain transcript text.",
    ],
  },
  {
    title: "Tesseract",
    task: "OCR language/font adaptation",
    format: "tesseract_ground_truth",
    accepted: ["Tesseract .gt.txt", "PaddleOCR rec converted to .gt.txt"],
    icon: FileText,
    useWhen: "Use when adapting Tesseract to a language, font, scanner style, or document source.",
    prepare: [
      "Pair each image with a matching .gt.txt file using the same base name.",
      "Keep each image focused on a line or word when possible.",
      "PaddleOCR recognition labels can be imported and normalized into .gt.txt pairs.",
    ],
    importResult: [
      "Ready models should include Tesseract when .gt.txt pairs exist.",
      "The OCR worker currently has eng and tha start models installed.",
    ],
    configure: [
      "Choose the start model such as English or Thai.",
      "Set a short output model code such as invoice_th.",
      "Increase max iterations for harder fonts or low-quality scans.",
    ],
    avoid: [
      "Do not use Tesseract for text detection boxes.",
      "Do not use full document pages when the ground truth is line-level text.",
    ],
  },
];

const datasetLayouts = [
  {
    title: "ImageFolder classification",
    format: "imagefolder",
    rows: [
      { label: "dataset.zip", kind: "folder", depth: 0 },
      { label: "train", kind: "folder", depth: 1 },
      { label: "cat", kind: "folder", depth: 2 },
      { label: "cat_001.jpg", kind: "image", depth: 3 },
      { label: "dog", kind: "folder", depth: 2 },
      { label: "dog_001.jpg", kind: "image", depth: 3 },
      { label: "val", kind: "folder", depth: 1 },
      { label: "cat", kind: "folder", depth: 2 },
      { label: "cat_101.jpg", kind: "image", depth: 3 },
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
    title: "COCO boxes or instances",
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
    title: "Semantic masks",
    format: "semantic_masks",
    rows: [
      { label: "dataset.zip", kind: "folder", depth: 0 },
      { label: "train", kind: "folder", depth: 1 },
      { label: "images/image_001.jpg", kind: "image", depth: 2 },
      { label: "masks/image_001.png", kind: "image", depth: 2 },
      { label: "val", kind: "folder", depth: 1 },
      { label: "images/image_101.jpg", kind: "image", depth: 2 },
      { label: "masks/image_101.png", kind: "image", depth: 2 },
    ] satisfies TreeRow[],
  },
  {
    title: "PaddleOCR recognition/detection",
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
    title: "Tesseract ground truth",
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

function Checklist({ items, tone = "success" }: { items: string[]; tone?: "success" | "warning" }) {
  const Icon = tone === "warning" ? AlertCircle : CheckCircle2;
  const color = tone === "warning" ? "text-amber-500" : "text-emerald-500";
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div className="flex items-start gap-2.5" key={item}>
          <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
          <p className="text-xs leading-5 text-muted-foreground"><I18nText textKey={item} /></p>
        </div>
      ))}
    </div>
  );
}

function ModelGuideCard({ guide }: { guide: ModelGuide }) {
  const Icon = guide.icon;
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </span>
          <div>
            <h2 className="text-sm font-semibold">{guide.title}</h2>
            <p className="mt-1 text-xs text-muted-foreground"><I18nText textKey={guide.task} /></p>
          </div>
        </div>
        <Badge variant="secondary">{guide.format}</Badge>
      </div>

      <p className="mt-4 text-sm leading-6 text-muted-foreground"><I18nText textKey={guide.useWhen} /></p>

      <div className="mt-4 flex flex-wrap gap-2">
        {guide.accepted.map((item) => (
          <StatusBadge key={item}>{item}</StatusBadge>
        ))}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Prepare</p>
          <Checklist items={guide.prepare} />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">After Import</p>
          <Checklist items={guide.importResult} />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Configure</p>
          <Checklist items={guide.configure} />
        </div>
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-muted-foreground">Avoid</p>
          <Checklist items={guide.avoid} tone="warning" />
        </div>
      </div>
    </div>
  );
}

export default async function GuidePage({ searchParams }: GuidePageProps) {
  const resolvedSearchParams = await searchParams;
  const defaultTab = guideTabFromSearch(resolvedSearchParams?.tab);

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Guide"
          title="Training Guide"
          description={<I18nText textKey="guide.header.description" />}
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

        <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpenCheck className="h-5 w-5" />
                Start Here
              </CardTitle>
              <CardDescription>
                <I18nText textKey="guide.start.description" />
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
                      <I18nText textKey={description} />
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Import Check</CardTitle>
              <CardDescription>
                <I18nText textKey="guide.import.description" />
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "The ZIP inspection finishes without errors.",
                "Ready models include the model you plan to train.",
                "Class names and annotation counts look correct.",
                "Warnings are understood before pressing Import dataset.",
              ].map((item) => (
                <div className="flex items-start gap-3" key={item}>
                  <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <p className="text-sm leading-6 text-muted-foreground"><I18nText textKey={item} /></p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Tabs defaultValue={defaultTab} className="space-y-4">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="workflow">Workflow</TabsTrigger>
            <TabsTrigger value="models">Model Guide</TabsTrigger>
            <TabsTrigger value="datasets">Dataset Layouts</TabsTrigger>
            <TabsTrigger value="ocr">OCR Details</TabsTrigger>
          </TabsList>

          <TabsContent value="workflow" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Choose By Output
                </CardTitle>
                <CardDescription>
                  <I18nText textKey="guide.workflow.description" />
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 lg:grid-cols-2">
                  {decisionRows.map((row) => (
                    <div
                      key={row.need}
                      className="rounded-lg border border-border bg-background/70 p-4"
                    >
                      <p className="text-sm font-semibold">{row.need}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge>{row.model}</Badge>
                        <Badge variant="secondary">{row.dataset}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <section className="grid gap-4 lg:grid-cols-3">
              {[
                {
                  title: "1. Upload ZIP",
                  body: "Use the Dataset page. AILAB inspects the ZIP first and shows source format, task, classes, annotation counts, and ready models.",
                  icon: Upload,
                },
                {
                  title: "2. Import Dataset",
                  body: "Press Import only after the preview looks right. AILAB keeps the original files and writes generated files under .ailab_normalized when conversion is needed.",
                  icon: FileArchive,
                },
                {
                  title: "3. Configure Run",
                  body: "Open Configuration. Only compatible datasets appear for the chosen model. If a dataset is missing, return to Dataset and inspect the warnings.",
                  icon: Settings2,
                },
              ].map(({ body, icon: Icon, title }) => (
                <div key={title} className="rounded-lg border border-border bg-card p-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </span>
                  <h2 className="mt-4 text-sm font-semibold">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground"><I18nText textKey={body} /></p>
                </div>
              ))}
            </section>
          </TabsContent>

          <TabsContent value="models">
            <div className="grid gap-4 xl:grid-cols-2">
              {modelGuides.map((guide) => (
                <ModelGuideCard key={guide.title} guide={guide} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="datasets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileArchive className="h-5 w-5" />
                  ZIP Layouts
                </CardTitle>
                <CardDescription>
                  <I18nText textKey="guide.layouts.description" />
                </CardDescription>
              </CardHeader>
            </Card>
            <div className="grid gap-4 lg:grid-cols-2">
              {datasetLayouts.map((layout) => (
                <DatasetDiagram key={layout.title} {...layout} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="ocr" className="space-y-4">
            <section className="grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ScanText className="h-5 w-5" />
                    PaddleOCR
                  </CardTitle>
                  <CardDescription>
                    <I18nText textKey="guide.paddle.description" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border bg-background/70 p-4">
                    <StatusBadge tone="success">Recognition</StatusBadge>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      <I18nText textKey="Use `rec_gt_train.txt` when each image is already cropped to one word or one text line." />
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-background/70 p-4">
                    <StatusBadge tone="warning">Detection</StatusBadge>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      <I18nText textKey="Use `det_gt_train.txt` when the model must learn where text appears in full images." />
                    </p>
                  </div>
                  <Checklist
                    items={[
                      "Use preset configs first; custom paths are for advanced/admin use.",
                      "Choose Previous run only when reusing an AILAB OCR checkpoint.",
                      "Tesseract .gt.txt recognition data can be imported for PaddleOCR recognition.",
                    ]}
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Tesseract
                  </CardTitle>
                  <CardDescription>
                    <I18nText textKey="guide.tesseract.description" />
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      {
                        title: "Start model",
                        body: "Choose English or Thai from the Tesseract start-model selector.",
                      },
                      {
                        title: "Ground truth",
                        body: "Each image must have a same-name .gt.txt transcript file.",
                      },
                      {
                        title: "Output code",
                        body: "Use a short model code, for example invoice_th or shop_sign_en.",
                      },
                      {
                        title: "Iterations",
                        body: "Increase max iterations when fonts, scans, or language are harder.",
                      },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="rounded-lg border border-border bg-background/70 p-4"
                      >
                        <p className="text-sm font-semibold">{item.title}</p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          <I18nText textKey={item.body} />
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-dashed border-border bg-background/70 p-4">
                    <div className="flex items-center gap-2">
                      <FileArchive className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Installed start models</p>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Badge>eng</Badge>
                      <Badge>tha</Badge>
                    </div>
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
