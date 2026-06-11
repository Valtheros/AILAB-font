"use client";

import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BookOpenCheck,
  Boxes,
  Database,
  Download,
  FileSliders,
  Layers3,
  Play,
  ScanText,
} from "lucide-react";
import { MainLayout } from "@/components/MainLayout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/workspace/page-header";
import { BackendStatusBadge } from "@/components/workspace/backend-status-badge";
import { StatusBadge } from "@/components/workspace/status-badge";

const quickActions = [
  {
    title: "Upload dataset",
    description: "Bring ZIP datasets into the workspace.",
    href: "/dataset",
    icon: Database,
  },
  {
    title: "Read guide",
    description: "See model choices and dataset layouts.",
    href: "/guide",
    icon: BookOpenCheck,
  },
  {
    title: "Configure run",
    description: "Choose tasks, models, and parameters.",
    href: "/config",
    icon: FileSliders,
  },
  {
    title: "Open monitor",
    description: "Start or inspect a training job.",
    href: "/training",
    icon: Play,
  },
  {
    title: "Browse results",
    description: "Download metrics and artifacts.",
    href: "/results",
    icon: Download,
  },
];

const workflowStages = [
  {
    title: "Dataset",
    description: "Detect formats, classes, and task compatibility.",
    icon: Database,
  },
  {
    title: "Configure",
    description: "Tune shared settings and model-specific parameters.",
    icon: FileSliders,
  },
  {
    title: "Train",
    description: "Watch job state, logs, progress, and metrics.",
    icon: Activity,
  },
  {
    title: "Artifact",
    description: "Collect weights, reports, and OCR outputs.",
    icon: Layers3,
  },
];

const taskFamilies = [
  { label: "Classification", icon: Boxes },
  { label: "Segmentation", icon: Layers3 },
  { label: "OCR", icon: ScanText },
  { label: "Detection", icon: Activity },
];

export default function DashboardPage() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workspace"
          title="Dashboard"
          description="Move from datasets to artifacts with one workspace for Computer Vision training."
          actions={
            <Button asChild>
              <Link href="/config">
                Configure run
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />

        <section className="grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <BackendStatusBadge />
                <StatusBadge>4 task families</StatusBadge>
              </div>
              <CardTitle>Training Workspace</CardTitle>
              <CardDescription>
                A compact run path for classification, segmentation, OCR, and
                object detection.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-4">
                {workflowStages.map(({ description, icon: Icon, title }, index) => (
                  <div
                    className="rounded-lg border border-border bg-background/70 p-4"
                    key={title}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-border">
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        0{index + 1}
                      </span>
                    </div>
                    <h2 className="mt-5 text-sm font-semibold">{title}</h2>
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
              <CardTitle>Workspace Status</CardTitle>
              <CardDescription>
                Stable signals for the current frontend workflow.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {taskFamilies.map(({ icon: Icon, label }) => (
                  <div
                    className="rounded-lg border border-border bg-background/70 p-3"
                    key={label}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <p className="mt-4 text-sm font-medium">{label}</p>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex flex-wrap gap-2">
                <BackendStatusBadge />
                <StatusBadge>Frontend available</StatusBadge>
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              Jump into the page that owns each part of the workflow.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {quickActions.map(({ description, href, icon: Icon, title }) => (
              <Link
                className="group rounded-lg border border-border bg-background/70 p-4 transition-colors hover:bg-accent"
                href={href}
                key={href}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border">
                    <Icon className="h-4 w-4" />
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <h2 className="mt-6 text-sm font-semibold">{title}</h2>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {description}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
