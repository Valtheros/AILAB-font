"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  Database,
  Download,
  FileSliders,
  Play,
} from "lucide-react";
import { MainLayout } from "@/components/MainLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/workspace/page-header";
import { StatusBadge, type StatusTone } from "@/components/workspace/status-badge";
import { useLanguage } from "@/components/language-provider";
import { apiBaseUrl } from "@/lib/api";

const API_URL = apiBaseUrl();

const quickActions = [
  {
    title: "Upload dataset",
    descriptionKey: "dashboard.action.upload.description",
    href: "/dataset",
    icon: Database,
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

interface Dataset {
  id: string;
  name: string;
  images: number;
  classes: string[];
  size: string;
  createdAt: string;
}

interface TrainingRun {
  id: string;
  project_name: string;
  model_name?: string;
  dataset_name?: string;
  status?: string;
  updatedAt: number | string;
}

function formatDate(value: number | string, locale: string) {
  const date = new Date(typeof value === "number" ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString(locale);
}

function statusTone(status: string): StatusTone {
  if (["running", "started", "completed", "exited"].includes(status)) return "success";
  if (["queued", "stopping", "stopped", "cancelled"].includes(status)) return "warning";
  if (status === "failed") return "danger";
  return "neutral";
}

export default function DashboardPage() {
  const { language, t } = useLanguage();
  const [datasets, setDatasets] = useState<Dataset[] | null>(null);
  const [runs, setRuns] = useState<TrainingRun[] | null>(null);
  const [datasetError, setDatasetError] = useState(false);
  const [runError, setRunError] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/api/datasets`)
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: { datasets?: Dataset[] }) =>
        setDatasets(
          [...(data.datasets ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        ),
      )
      .catch(() => setDatasetError(true));

    fetch(`${API_URL}/api/runs`)
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data: { runs?: TrainingRun[] }) => setRuns(data.runs ?? []))
      .catch(() => setRunError(true));
  }, []);

  return (
    <MainLayout>
      <div className="flex flex-col gap-6">
        <div className="order-1">
          <PageHeader
            title="Dashboard"
            description={t("dashboard.header.description")}
          />
        </div>

        <section className="order-3 grid gap-4 md:order-2 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Recent Datasets
              </CardTitle>
              <CardDescription>{t("dashboard.recent.datasets.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {datasetError ? (
                <p className="text-sm text-muted-foreground">{t("dashboard.recent.datasets.error")}</p>
              ) : datasets === null ? (
                <p className="text-sm text-muted-foreground">{t("dashboard.recent.loading")}</p>
              ) : datasets.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("dashboard.recent.datasets.empty")}</p>
              ) : (
                datasets.slice(0, 3).map((dataset) => (
                  <div className="rounded-md border border-border bg-background/70 p-3" key={dataset.id}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="break-words text-sm font-medium">{dataset.name}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">{dataset.size}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {dataset.images.toLocaleString()} {t("dashboard.recent.images")} · {dataset.classes.length} {t("dashboard.recent.classes")} · {dataset.createdAt}
                    </p>
                  </div>
                ))
              )}
              <Link className="inline-flex items-center gap-2 text-sm font-medium hover:underline" href="/dataset">
                View all datasets <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Recent Training Runs
              </CardTitle>
              <CardDescription>{t("dashboard.recent.runs.description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {runError ? (
                <p className="text-sm text-muted-foreground">{t("dashboard.recent.runs.error")}</p>
              ) : runs === null ? (
                <p className="text-sm text-muted-foreground">{t("dashboard.recent.loading")}</p>
              ) : runs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("dashboard.recent.runs.empty")}</p>
              ) : (
                runs.slice(0, 3).map((run) => {
                  const status = run.status || "unknown";
                  return (
                    <div className="rounded-md border border-border bg-background/70 p-3" key={run.id || run.project_name}>
                      <div className="flex items-start justify-between gap-3">
                        <p className="break-words text-sm font-medium">{run.project_name}</p>
                        <StatusBadge tone={statusTone(status)}>{status}</StatusBadge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {run.model_name || t("dashboard.recent.unknownModel")} · {run.dataset_name || t("dashboard.recent.noDataset")} · {formatDate(run.updatedAt, language === "th" ? "th-TH" : "en-US")}
                      </p>
                    </div>
                  );
                })
              )}
              <Link className="inline-flex items-center gap-2 text-sm font-medium hover:underline" href="/results">
                View all runs <ArrowRight className="h-4 w-4" />
              </Link>
            </CardContent>
          </Card>
        </section>

        <Card className="order-2 md:order-3">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>{t("dashboard.quick.description")}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{t(descriptionKey)}</p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
