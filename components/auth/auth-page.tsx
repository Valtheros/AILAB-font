import Link from "next/link";
import { ArrowLeft, Cpu } from "lucide-react";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { I18nText } from "@/components/i18n-text";

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  return <main className="min-h-screen bg-background text-foreground">
    <header className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 md:px-8">
      <Link className="flex items-center gap-3 font-semibold" href="/overview">
        <Cpu className="size-5" />AILAB
      </Link>
      <div className="flex items-center gap-2"><LanguageToggle /><ThemeToggle /></div>
    </header>
    <section className="mx-auto flex max-w-md flex-col items-start gap-5 px-4 py-8">
      <Link href="/overview" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /><I18nText textKey="public.backOverview" />
      </Link>
      <h1 className="text-2xl font-semibold"><I18nText textKey={`public.${mode}Title`} /></h1>
      <Suspense fallback={null}><AuthForm mode={mode} /></Suspense>
    </section>
  </main>;
}
