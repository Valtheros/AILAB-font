"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Code2, Database, FlaskConical, SlidersHorizontal, Tags } from "lucide-react";
import { Suspense } from "react";
import { useLanguage } from "@/components/language-provider";
import { PublicHeader } from "@/components/workspace/public-header";
import { WorkspaceAction } from "@/components/workspace/workspace-action";

const steps = [
  { key: "landing.data", icon: Database },
  { key: "landing.label", icon: Tags },
  { key: "landing.train", icon: SlidersHorizontal },
  { key: "landing.test", icon: FlaskConical },
  { key: "landing.api", icon: Code2 },
];

export function LandingPage() {
  const { t } = useLanguage();
  return <div className="min-h-screen bg-background text-foreground">
    <PublicHeader />
    <main id="main-content">
      <section aria-labelledby="landing-title" className="relative isolate flex min-h-[30rem] flex-col justify-center overflow-hidden bg-[#eeecee] pt-60 text-neutral-950 lg:min-h-[32rem] lg:pt-0">
        <Image src="/landing/model-workflow.png" alt={t("landing.imageAlt")} width={1672} height={941} priority sizes="(min-width: 1024px) 910px, 426px" className="absolute right-0 top-0 -z-10 h-60 w-full object-contain object-right-top lg:h-full lg:object-right" />
        <div className="w-full">
          <div className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
            <h1 id="landing-title" className="text-7xl font-semibold leading-none">AILAB</h1>
            <p className="mt-5 max-w-sm text-xl leading-relaxed">{t("landing.description")}</p>
            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Suspense fallback={<span className="min-h-12 text-sm">{t("auth.gate.checking")}</span>}>
                <WorkspaceAction href="/dashboard" className="min-h-12 border-transparent bg-neutral-950 px-5 text-white hover:bg-neutral-800">{t("landing.enter")}</WorkspaceAction>
              </Suspense>
              <Link href="/guide" className="inline-flex min-h-11 items-center gap-2 text-sm underline-offset-4 hover:underline">{t("landing.guide")}<ArrowRight className="size-4" /></Link>
            </div>
          </div>
        </div>
      </section>
      <section aria-labelledby="workflow-heading" className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-10">
        <h2 id="workflow-heading" className="text-lg font-medium">{t("landing.workflow")}</h2>
        <ol className="mt-6 grid gap-5 sm:grid-cols-5 sm:gap-4">
          {steps.map(({ key, icon: Icon }, index) => <li key={key} className="flex min-w-0 items-center gap-3 sm:flex-wrap">
            <span className="text-xs tabular-nums text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
            <Icon className="size-5 shrink-0 text-emerald-700 dark:text-emerald-400" />
            <span className="text-sm font-medium">{t(key)}</span>
          </li>)}
        </ol>
      </section>
    </main>
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-5 text-xs leading-6 text-muted-foreground sm:px-8">
        <span>AILAB · Computer Vision</span>
      </div>
    </footer>
  </div>;
}
