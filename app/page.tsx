"use client";

import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  Cpu,
  Database,
  ScanText,
  Telescope,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/workspace/status-badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/components/language-provider";

const taskFamilies = [
  { label: "Image Classification", detail: "ResNet and EfficientNet", icon: Cpu },
  { label: "Segmentation", detail: "DeepLabV3+ and Mask R-CNN", icon: Boxes },
  {
    label: "OCR / Document Vision",
    detail: "PaddleOCR and Tesseract",
    icon: ScanText,
  },
  {
    label: "Object Detection",
    detail: "YOLOv11 and Faster R-CNN",
    icon: Telescope,
  },
];

export default function HomePage() {
  const { t } = useLanguage();

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-8">
        <Link className="flex items-center gap-3" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-foreground text-background">
            <Database className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold">AILAB</span>
            <span className="block text-xs text-muted-foreground">
              {t("common.noCodeTraining")}
            </span>
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-7xl items-center gap-8 px-4 pb-10 md:px-8 lg:grid-cols-[1.03fr_.97fr]">
        <div>
          <Badge className="mb-5" variant="outline">
            Dataset to artifact
          </Badge>
          <h1 className="max-w-3xl text-4xl font-semibold leading-none sm:text-6xl">
            Train vision models from dataset to artifact.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            {t("home.hero.description")}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/login?callbackURL=/config">
                Configure run
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login?callbackURL=/dataset">Browse datasets</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/login?callbackURL=/dashboard">Open dashboard</Link>
            </Button>
          </div>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {taskFamilies.map(({ detail, icon: Icon, label }) => (
              <div className="console-surface flex min-h-24 items-start gap-3 p-4" key={label}>
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="console-surface console-grid overflow-hidden p-4 sm:p-6">
          <div className="rounded-lg border border-border bg-zinc-950 p-4 text-zinc-100">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs text-zinc-400">
                run/resnet_flowers_001
              </p>
              <StatusBadge>Preview</StatusBadge>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs text-zinc-400">Task</p>
                <p className="mt-1 text-sm font-medium">Image Classification</p>
              </div>
              <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <p className="text-xs text-zinc-400">Dataset</p>
                <p className="mt-1 text-sm font-medium">flowers_imagefolder</p>
              </div>
            </div>
            <div className="mt-3 rounded-md border border-white/10 bg-white/[0.04] p-4">
              <div className="mb-5 flex items-center justify-between text-xs text-zinc-400">
                <span>Training signal</span>
                <span>Epoch 38 / 50</span>
              </div>
              <div className="flex h-28 items-end gap-2">
                {[32, 48, 43, 67, 61, 78, 74].map((height) => (
                  <span
                    className="flex-1 rounded-t bg-zinc-100"
                    key={height}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
