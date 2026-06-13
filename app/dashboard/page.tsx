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
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge } from "@/components/workspace/status-badge";
import { useLanguage } from "@/components/language-provider";

const quickActions = [
  {
    title: "Upload dataset",
    descriptionKey: "dashboard.action.upload.description",
    href: "/dataset",
    icon: Database,
  },
  {
    title: "Read guide",
    descriptionKey: "dashboard.action.guide.description",
    href: "/guide",
    icon: BookOpenCheck,
  },
  {
    title: "Configure run",
    descriptionKey: "dashboard.action.config.description",
    href: "/config",
    icon: FileSliders,
  },
  {
    title: "Open monitor",
    descriptionKey: "dashboard.action.monitor.description",
    href: "/training",
    icon: Play,
  },
  {
    title: "Browse results",
    descriptionKey: "dashboard.action.results.description",
    href: "/results",
    icon: Download,
  },
];

const workflowStages = [
  {
    title: "Dataset",
    descriptionKey: "dashboard.stage.dataset.description",
    icon: Database,
  },
  {
    title: "Configure",
    descriptionKey: "dashboard.stage.configure.description",
    icon: FileSliders,
  },
  {
    title: "Train",
    descriptionKey: "dashboard.stage.train.description",
    icon: Activity,
  },
  {
    title: "Artifact",
    descriptionKey: "dashboard.stage.artifact.description",
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
  const { t } = useLanguage();

  return (
    <MainLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workspace"
          title="Dashboard"
          description={t("dashboard.header.description")}
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
                <StatusBadge>4 task families</StatusBadge>
              </div>
              <CardTitle>Training Workspace</CardTitle>
              <CardDescription>
                {t("dashboard.workspace.description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-4">
                {workflowStages.map(
                  ({ descriptionKey, icon: Icon, title }, index) => (
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
                        {t(descriptionKey)}
                      </p>
                    </div>
                  ),
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workspace Status</CardTitle>
              <CardDescription>
                {t("dashboard.status.description")}
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
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>
              {t("dashboard.quick.description")}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {quickActions.map(({ descriptionKey, href, icon: Icon, title }) => (
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
                  {t(descriptionKey)}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
