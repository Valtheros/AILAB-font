"use client";

import Konva from "konva";
import {
  Brush,
  Eraser,
  Eye,
  EyeOff,
  Hand,
  Maximize,
  Pentagon,
  Plus,
  Redo2,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, Image as KonvaImage, Layer, Line, Stage } from "react-konva";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { annotationId, isTextEditingTarget, type AnnotationClass, type AnnotationImage, type StoredAnnotation } from "@/lib/annotation";

type Tool = "polygon" | "brush" | "eraser" | "hand";
type Point = [number, number];

function points(values: number[][], width: number, height: number) {
  return values.flatMap(([x, y]) => [x * width, y * height]);
}

export default function SegmentationCanvas({
  image,
  imageUrl,
  classes,
  instanceMode,
  onChange,
  onMarkEmpty,
}: {
  image: AnnotationImage;
  imageUrl: string;
  classes: AnnotationClass[];
  instanceMode: boolean;
  onChange: (annotations: StoredAnnotation[]) => void;
  onMarkEmpty: () => void;
}) {
  const maxBrushSize = Math.max(4, Math.min(160, Math.floor(Math.min(image.width, image.height) / 2)));
  const container = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<HTMLImageElement | null>(null);
  const [size, setSize] = useState({ width: 900, height: 620 });
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<Tool>("polygon");
  const [selectedClass, setSelectedClass] = useState(classes[0]?.id ?? "");
  const [selectedInstance, setSelectedInstance] = useState("");
  const [selectedShape, setSelectedShape] = useState("");
  const [annotations, setAnnotations] = useState<StoredAnnotation[]>(image.annotations);
  const [past, setPast] = useState<StoredAnnotation[][]>([]);
  const [future, setFuture] = useState<StoredAnnotation[][]>([]);
  const [draftPolygon, setDraftPolygon] = useState<Point[]>([]);
  const [draftBrush, setDraftBrush] = useState<Point[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(Math.min(24, maxBrushSize));
  const [opacity, setOpacity] = useState(45);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    const next = new window.Image();
    setSource(null);
    next.onload = () => setSource(next);
    next.src = imageUrl;
    return () => { next.onload = null; };
  }, [imageUrl]);

  const fit = useCallback((nextSize: { width: number; height: number }) => {
    const nextScale = Math.min(nextSize.width / image.width, nextSize.height / image.height);
    setScale(nextScale);
    setOffset({
      x: (nextSize.width - image.width * nextScale) / 2,
      y: (nextSize.height - image.height * nextScale) / 2,
    });
  }, [image.height, image.width]);

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const resize = () => {
      const next = {
        width: Math.max(320, element.clientWidth),
        height: Math.max(448, Math.min(window.innerHeight * 0.68, 760)),
      };
      setSize(next);
      fit(next);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [fit]);

  useEffect(() => {
    setAnnotations(image.annotations);
    setPast([]);
    setFuture([]);
    setDraftPolygon([]);
    setDraftBrush([]);
    setSelectedShape("");
    const first = image.annotations.find((item) => "instanceId" in item);
    setSelectedInstance(first && "instanceId" in first ? first.instanceId || annotationId() : annotationId());
  }, [image.id]);

  const commit = useCallback((next: StoredAnnotation[]) => {
    setPast((items) => [...items.slice(-49), annotations]);
    setFuture([]);
    setAnnotations(next);
    onChange(next);
  }, [annotations, onChange]);

  const undo = useCallback(() => {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [annotations, ...items].slice(0, 50));
    setAnnotations(previous);
    onChange(previous);
  }, [annotations, onChange, past]);

  const redo = useCallback(() => {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items.slice(-49), annotations]);
    setAnnotations(next);
    onChange(next);
  }, [annotations, future, onChange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextEditingTarget(event.target) || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      if (event.shiftKey || key === "y") redo(); else undo();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [redo, undo]);

  const normalizedPointer = (event: Konva.KonvaEventObject<PointerEvent | MouseEvent>): Point | null => {
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return null;
    const x = (pointer.x - offset.x) / scale / image.width;
    const y = (pointer.y - offset.y) / scale / image.height;
    if (x < 0 || y < 0 || x > 1 || y > 1) return null;
    return [x, y];
  };

  const finishPolygon = () => {
    if (draftPolygon.length < 3 || !selectedClass) return;
    const annotation: StoredAnnotation = {
      id: annotationId(),
      type: "polygon",
      classId: selectedClass,
      ...(instanceMode ? { instanceId: selectedInstance || annotationId() } : {}),
      points: draftPolygon,
    };
    setDraftPolygon([]);
    commit([...annotations, annotation]);
  };

  const pointerDown = (event: Konva.KonvaEventObject<PointerEvent>) => {
    if (tool === "hand") return;
    if (event.target.hasName("vertex")) return;
    if (tool === "polygon" && event.target.getClassName() !== "Image") return;
    const point = normalizedPointer(event);
    if (!point || !selectedClass) return;
    if (tool === "polygon") {
      setDraftPolygon((current) => [...current, point]);
      return;
    }
    setDrawing(true);
    setDraftBrush([point]);
  };

  const pointerMove = (event: Konva.KonvaEventObject<PointerEvent>) => {
    if (!drawing || (tool !== "brush" && tool !== "eraser")) return;
    const point = normalizedPointer(event);
    if (!point) return;
    setDraftBrush((current) => {
      const last = current.at(-1);
      if (last && Math.hypot(last[0] - point[0], last[1] - point[1]) < 0.001) return current;
      return [...current, point];
    });
  };

  const pointerUp = () => {
    if (!drawing) return;
    setDrawing(false);
    if (draftBrush.length < 2 || !selectedClass) {
      setDraftBrush([]);
      return;
    }
    const hasMaskToErase = annotations.some((annotation) => {
      if (annotation.type === "classification" || annotation.type === "rectangle") return false;
      if (annotation.type === "brush" && annotation.mode === "erase") return false;
      if (!instanceMode) return true;
      return annotation.instanceId === selectedInstance;
    });
    if (tool === "eraser" && !hasMaskToErase) {
      setDraftBrush([]);
      return;
    }
    const annotation: StoredAnnotation = {
      id: annotationId(),
      type: "brush",
      classId: selectedClass,
      ...(instanceMode ? { instanceId: selectedInstance || annotationId() } : {}),
      mode: tool === "eraser" ? "erase" : "paint",
      radius: brushSize / (Math.min(image.width, image.height) * 2),
      points: draftBrush,
    };
    setDraftBrush([]);
    commit([...annotations, annotation]);
  };

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    event.evt.preventDefault();
    const stage = event.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!pointer) return;
    const factor = event.evt.deltaY > 0 ? 1 / 1.12 : 1.12;
    const nextScale = Math.max(0.05, Math.min(scale * factor, 12));
    const imagePoint = { x: (pointer.x - offset.x) / scale, y: (pointer.y - offset.y) / scale };
    setScale(nextScale);
    setOffset({ x: pointer.x - imagePoint.x * nextScale, y: pointer.y - imagePoint.y * nextScale });
  };

  const zoom = (factor: number) => {
    const center = { x: size.width / 2, y: size.height / 2 };
    const nextScale = Math.max(0.05, Math.min(scale * factor, 12));
    const imagePoint = { x: (center.x - offset.x) / scale, y: (center.y - offset.y) / scale };
    setScale(nextScale);
    setOffset({ x: center.x - imagePoint.x * nextScale, y: center.y - imagePoint.y * nextScale });
  };

  const grouped = useMemo(() => {
    const result = new Map<string, StoredAnnotation[]>();
    for (const annotation of annotations) {
      const key = instanceMode && "instanceId" in annotation
        ? annotation.instanceId || annotation.id
        : annotation.id;
      result.set(key, [...(result.get(key) ?? []), annotation]);
    }
    return result;
  }, [annotations, instanceMode]);

  const colorFor = (classId: string) => classes.find((item) => item.id === classId)?.color ?? "#22c55e";

  const renderAnnotation = (annotation: StoredAnnotation) => {
    if (annotation.type === "classification" || annotation.type === "rectangle") return null;
    const color = colorFor(annotation.classId);
    if (annotation.type === "polygon") {
      return (
        <Line
          key={annotation.id}
          points={points(annotation.points, image.width, image.height)}
          closed
          fill={color}
          stroke={color}
          strokeWidth={Math.max(1, 2 / scale)}
          onClick={() => setSelectedShape(annotation.id)}
          onTap={() => setSelectedShape(annotation.id)}
        />
      );
    }
    return (
      <Line
        key={annotation.id}
        points={points(annotation.points, image.width, image.height)}
        stroke={annotation.mode === "erase" ? "#000" : color}
        strokeWidth={annotation.radius * Math.min(image.width, image.height) * 2}
        lineCap="round"
        lineJoin="round"
        globalCompositeOperation={annotation.mode === "erase" ? "destination-out" : "source-over"}
      />
    );
  };

  const selectedPolygon = annotations.find((item) => item.id === selectedShape && item.type === "polygon");
  const removeGroup = (groupId: string) => {
    const next = annotations.filter((annotation) => {
      const key = instanceMode && "instanceId" in annotation ? annotation.instanceId || annotation.id : annotation.id;
      return key !== groupId;
    });
    setSelectedShape("");
    commit(next);
  };

  const markEmpty = () => {
    setPast((items) => [...items.slice(-49), annotations]);
    setFuture([]);
    setAnnotations([]);
    onMarkEmpty();
  };

  return (
    <div className="grid min-h-0 gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div ref={container} className="relative min-w-0 overflow-hidden rounded-md border bg-black">
        <Stage
          width={size.width}
          height={size.height}
          x={offset.x}
          y={offset.y}
          scaleX={scale}
          scaleY={scale}
          draggable={tool === "hand"}
          onDragEnd={(event) => setOffset({ x: event.target.x(), y: event.target.y() })}
          onWheel={handleWheel}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onDblClick={finishPolygon}
          onDblTap={finishPolygon}
        >
          <Layer>{source && <KonvaImage image={source} width={image.width} height={image.height} />}</Layer>
          {instanceMode ? [...grouped.entries()].map(([groupId, items]) => (
            <Layer key={groupId} opacity={hidden.has(groupId) ? 0 : opacity / 100}>
              {items.map(renderAnnotation)}
            </Layer>
          )) : (
            <Layer opacity={opacity / 100}>
              {annotations.filter((item) => !hidden.has(item.id)).map(renderAnnotation)}
            </Layer>
          )}
          <Layer>
            {draftPolygon.length > 0 && <Line points={points(draftPolygon, image.width, image.height)} stroke={colorFor(selectedClass)} strokeWidth={Math.max(1, 2 / scale)} />}
            {draftBrush.length > 1 && (
              <Line
                points={points(draftBrush, image.width, image.height)}
                stroke={tool === "eraser" ? "#ef4444" : colorFor(selectedClass)}
                strokeWidth={brushSize}
                lineCap="round"
                lineJoin="round"
              />
            )}
            {selectedPolygon?.type === "polygon" && selectedPolygon.points.map(([x, y], index) => (
              <Circle
                key={`${selectedPolygon.id}-${index}`}
                x={x * image.width}
                y={y * image.height}
                radius={Math.max(4, 7 / scale)}
                name="vertex"
                fill="#fff"
                stroke={colorFor(selectedPolygon.classId)}
                strokeWidth={Math.max(1, 2 / scale)}
                draggable
                onDragEnd={(event) => {
                  const next = annotations.map((item) => item.id === selectedPolygon.id && item.type === "polygon"
                    ? {
                        ...item,
                        points: item.points.map((point, pointIndex) => pointIndex === index
                          ? [
                              Math.max(0, Math.min(1, event.target.x() / image.width)),
                              Math.max(0, Math.min(1, event.target.y() / image.height)),
                            ]
                          : point),
                      }
                    : item);
                  commit(next);
                }}
              />
            ))}
          </Layer>
        </Stage>
        <div className="absolute bottom-3 left-3 flex gap-1 rounded-md border bg-background/90 p-1">
          <Button variant="ghost" size="icon" onClick={() => zoom(1.4)} title="Zoom in"><ZoomIn /></Button>
          <Button variant="ghost" size="icon" onClick={() => zoom(1 / 1.4)} title="Zoom out"><ZoomOut /></Button>
          <Button variant="ghost" size="icon" onClick={() => fit(size)} title="Fit image"><Maximize /></Button>
        </div>
      </div>

      <aside className="space-y-4 border-l-0 p-1 lg:border-l lg:pl-4">
        <div className="grid grid-cols-4 gap-1">
          <Button variant={tool === "polygon" ? "secondary" : "outline"} size="icon" onClick={() => setTool("polygon")} title="Polygon"><Pentagon /></Button>
          <Button variant={tool === "brush" ? "secondary" : "outline"} size="icon" onClick={() => setTool("brush")} title="Brush"><Brush /></Button>
          <Button variant={tool === "eraser" ? "secondary" : "outline"} size="icon" onClick={() => setTool("eraser")} title="Eraser"><Eraser /></Button>
          <Button variant={tool === "hand" ? "secondary" : "outline"} size="icon" onClick={() => setTool("hand")} title="Pan"><Hand /></Button>
        </div>
        {draftPolygon.length > 0 && (
          <div className="flex gap-2">
            <Button size="sm" onClick={finishPolygon} disabled={draftPolygon.length < 3}>Finish polygon</Button>
            <Button size="sm" variant="outline" onClick={() => setDraftPolygon([])}>Cancel</Button>
          </div>
        )}
        {(tool === "brush" || tool === "eraser") && (
          <div className="space-y-1.5">
            <LabelText>Brush size: {brushSize}px</LabelText>
            <input className="w-full" type="range" min="4" max={maxBrushSize} value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
          </div>
        )}
        <div className="space-y-1.5">
          <LabelText>Mask opacity: {opacity}%</LabelText>
          <input className="w-full" type="range" min="10" max="90" value={opacity} onChange={(event) => setOpacity(Number(event.target.value))} />
        </div>
        <div>
          <p className="text-sm font-semibold">Class</p>
          <div className="mt-2 grid gap-2">
            {classes.map((item) => (
              <button key={item.id} type="button" onClick={() => setSelectedClass(item.id)} className={cn("flex min-h-10 items-center gap-2 rounded-md border px-3 text-left text-sm", selectedClass === item.id && "border-foreground bg-accent")}>
                <span className="size-3 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="min-w-0 truncate">{item.name}</span>
              </button>
            ))}
          </div>
        </div>
        {instanceMode && <Button variant="outline" className="w-full" onClick={() => { const next = annotationId(); setSelectedInstance(next); setSelectedShape(""); }}><Plus />New instance</Button>}
        <div className="max-h-52 space-y-1 overflow-y-auto border-t pt-3">
          <p className="mb-2 text-sm font-semibold">{instanceMode ? "Objects" : "Annotations"} ({grouped.size})</p>
          {[...grouped.entries()].map(([groupId, items], index) => {
            const item = items[0];
            if (!item) return null;
            const active = instanceMode ? selectedInstance === groupId : selectedShape === item.id;
            return (
              <div key={groupId} className={cn("grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1 rounded border p-1", active && "border-foreground")}>
                <button type="button" className="min-w-0 truncate px-2 text-left text-sm" onClick={() => { if (instanceMode) setSelectedInstance(groupId); setSelectedShape(item.id); }}>
                  {instanceMode ? `Object ${index + 1}` : `Shape ${index + 1}`} · {classes.find((entry) => entry.id === item.classId)?.name}
                </button>
                <Button variant="ghost" size="icon" onClick={() => setHidden((current) => { const next = new Set(current); if (next.has(groupId)) next.delete(groupId); else next.add(groupId); return next; })} title={hidden.has(groupId) ? "Show" : "Hide"}>
                  {hidden.has(groupId) ? <EyeOff /> : <Eye />}
                </Button>
                <Button variant="ghost" size="icon" onClick={() => removeGroup(groupId)} title="Delete"><Trash2 /></Button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2 border-t pt-3">
          <Button variant="outline" size="icon" onClick={undo} disabled={!past.length} title="Undo"><Undo2 /></Button>
          <Button variant="outline" size="icon" onClick={redo} disabled={!future.length} title="Redo"><Redo2 /></Button>
        </div>
        <Button variant="outline" className="w-full" onClick={markEmpty}>Mark as empty</Button>
      </aside>
    </div>
  );
}

function LabelText({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground">{children}</p>;
}
