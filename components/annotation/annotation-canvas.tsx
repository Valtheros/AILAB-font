"use client";

import {
  Annotorious,
  OpenSeadragonAnnotator,
  OpenSeadragonViewer,
  ShapeType,
  useAnnotator,
  useSelection,
  useViewer,
  type AnnotoriousOpenSeadragonAnnotator,
  type ImageAnnotation,
} from "@annotorious/react";
import { Hand, Maximize, Redo2, Scan, Trash2, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { isTextEditingTarget, type AnnotationClass, type AnnotationImage, type StoredAnnotation } from "@/lib/annotation";

interface CanvasBody {
  id: string;
  annotation: string;
  purpose: "classifying";
  value: string;
}

interface CanvasAnnotation {
  id: string;
  bodies: CanvasBody[];
  target: {
    annotation: string;
    selector: {
      type: ShapeType.RECTANGLE;
      geometry: {
        x: number;
        y: number;
        w: number;
        h: number;
        bounds: { minX: number; minY: number; maxX: number; maxY: number };
      };
    };
  };
}

function classBody(annotationId: string, classId: string): CanvasBody {
  return { id: `${annotationId}-class`, annotation: annotationId, purpose: "classifying", value: classId };
}

function toCanvas(annotation: StoredAnnotation, image: AnnotationImage): CanvasAnnotation | null {
  if (annotation.type !== "rectangle") return null;
  return {
    id: annotation.id,
    bodies: [classBody(annotation.id, annotation.classId)],
    target: {
      annotation: annotation.id,
      selector: {
        type: ShapeType.RECTANGLE,
        geometry: {
          x: annotation.x * image.width,
          y: annotation.y * image.height,
          w: annotation.width * image.width,
          h: annotation.height * image.height,
          bounds: {
            minX: annotation.x * image.width,
            minY: annotation.y * image.height,
            maxX: (annotation.x + annotation.width) * image.width,
            maxY: (annotation.y + annotation.height) * image.height,
          },
        },
      },
    },
  };
}

function toStored(annotation: CanvasAnnotation, image: AnnotationImage, fallbackClass: string): StoredAnnotation {
  const classId = annotation.bodies.find((body) => body.purpose === "classifying")?.value || fallbackClass;
  const geometry = annotation.target.selector.geometry;
  return {
    id: annotation.id,
    type: "rectangle",
    classId,
    x: geometry.x / image.width,
    y: geometry.y / image.height,
    width: geometry.w / image.width,
    height: geometry.h / image.height,
  };
}

function ViewerControls() {
  const viewer = useViewer();
  const zoom = (factor: number) => {
    viewer?.viewport.zoomBy(factor);
    viewer?.viewport.applyConstraints();
  };
  return (
    <div className="absolute bottom-3 left-3 z-20 flex gap-1 rounded-md border bg-background/90 p-1">
      <Button variant="ghost" size="icon" onClick={() => zoom(1.4)} title="Zoom in"><ZoomIn /></Button>
      <Button variant="ghost" size="icon" onClick={() => zoom(1 / 1.4)} title="Zoom out"><ZoomOut /></Button>
      <Button variant="ghost" size="icon" onClick={() => viewer?.viewport.goHome()} title="Fit image"><Maximize /></Button>
    </div>
  );
}

function DetectionCanvasInner({
  image,
  imageUrl,
  classes,
  onChange,
  onMarkEmpty,
}: {
  image: AnnotationImage;
  imageUrl: string;
  classes: AnnotationClass[];
  onChange: (annotations: StoredAnnotation[]) => void;
  onMarkEmpty: () => void;
}) {
  const anno = useAnnotator<AnnotoriousOpenSeadragonAnnotator>();
  const { selected } = useSelection();
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id ?? "");
  const [drawing, setDrawing] = useState(true);
  const ready = useRef(false);
  const lastEmitted = useRef("");

  const options = useMemo(() => ({
    tileSources: { type: "image" as const, url: imageUrl },
    showNavigationControl: false,
    animationTime: 0.2,
    blendTime: 0,
    maxZoomPixelRatio: 4,
  }), [imageUrl]);

  useEffect(() => {
    if (!anno) return;
    ready.current = false;
    const loaded = image.annotations
      .map((item) => toCanvas(item, image))
      .filter((item): item is CanvasAnnotation => item !== null);
    anno.setAnnotations(loaded as ImageAnnotation[]);
    lastEmitted.current = JSON.stringify(image.annotations);
    ready.current = true;
  }, [anno, image.id]);

  const emitAnnotations = useCallback(() => {
    if (!anno || !ready.current || !selectedClass) return;
    const live = anno.getAnnotations() as CanvasAnnotation[];
    const missingClass = live.find((item) => !item.bodies.some((body) => body.purpose === "classifying"));
    if (missingClass) {
      anno.updateAnnotation({ ...missingClass, bodies: [...missingClass.bodies, classBody(missingClass.id, selectedClass)] });
      return;
    }
    const stored = live.map((item) => toStored(item, image, selectedClass));
    const serialized = JSON.stringify(stored);
    if (serialized !== lastEmitted.current) {
      lastEmitted.current = serialized;
      onChange(stored);
    }
  }, [anno, image, onChange, selectedClass]);

  useEffect(() => {
    if (!anno) return;
    anno.on("createAnnotation", emitAnnotations);
    anno.on("updateAnnotation", emitAnnotations);
    anno.on("deleteAnnotation", emitAnnotations);
    return () => {
      anno.off("createAnnotation", emitAnnotations);
      anno.off("updateAnnotation", emitAnnotations);
      anno.off("deleteAnnotation", emitAnnotations);
    };
  }, [anno, emitAnnotations]);

  useEffect(() => {
    if (!anno) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextEditingTarget(event.target) || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      if (event.shiftKey || key === "y") anno.redo(); else anno.undo();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [anno]);

  const chooseClass = (classId: string) => {
    setSelectedClass(classId);
    if (!anno) return;
    for (const item of selected) {
      const annotation = item.annotation as CanvasAnnotation;
      anno.updateAnnotation({
        ...annotation,
        bodies: [
          ...annotation.bodies.filter((body) => body.purpose !== "classifying"),
          classBody(annotation.id, classId),
        ],
      });
    }
  };

  const styles = useMemo(() => (annotation: ImageAnnotation) => {
    const classId = annotation.bodies.find((body) => body.purpose === "classifying")?.value;
    const color = classes.find((item) => item.id === classId)?.color ?? "#22c55e";
    return { stroke: color, strokeWidth: 2, fill: color, fillOpacity: 0.2 };
  }, [classes]);

  return (
    <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="relative min-w-0 overflow-hidden rounded-md border bg-black">
        <OpenSeadragonAnnotator autoSave={false} tool="rectangle" drawingEnabled={drawing} style={styles}>
          <OpenSeadragonViewer className="h-[62dvh] min-h-[28rem] w-full" options={options} />
          <ViewerControls />
        </OpenSeadragonAnnotator>
      </div>
      <aside className="space-y-4 border-l-0 p-1 lg:border-l lg:pl-4">
        <div className="grid grid-cols-2 gap-2">
          <Button variant={drawing ? "secondary" : "outline"} onClick={() => setDrawing(true)}><Scan />Box</Button>
          <Button variant={!drawing ? "secondary" : "outline"} onClick={() => setDrawing(false)}><Hand />Pan</Button>
        </div>
        <div>
          <p className="text-sm font-semibold">Class</p>
          <div className="mt-2 grid gap-2">
            {classes.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => chooseClass(item.id)}
                className={cn("flex min-h-10 items-center gap-2 rounded-md border px-3 text-left text-sm", selectedClass === item.id && "border-foreground bg-accent")}
              >
                <span className="size-3 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="min-w-0 truncate">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button variant="outline" size="icon" onClick={() => anno?.undo()} title="Undo"><Undo2 /></Button>
          <Button variant="outline" size="icon" onClick={() => anno?.redo()} title="Redo"><Redo2 /></Button>
          <Button variant="outline" size="icon" disabled={!selected.length} onClick={() => selected.forEach((item) => anno?.removeAnnotation(item.annotation.id))} title="Delete selected"><Trash2 /></Button>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            anno?.setAnnotations([]);
            lastEmitted.current = "[]";
            onMarkEmpty();
          }}
        >
          Mark as empty
        </Button>
      </aside>
    </div>
  );
}

export default function AnnotationCanvas(props: React.ComponentProps<typeof DetectionCanvasInner>) {
  return <Annotorious><DetectionCanvasInner {...props} /></Annotorious>;
}
