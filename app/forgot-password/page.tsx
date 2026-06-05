import Link from "next/link";
import { Cpu } from "lucide-react";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import { ThemeToggle } from "@/components/theme-toggle";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <Link className="flex items-center gap-3" href="/">
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-foreground text-background">
            <Cpu className="h-4 w-4" />
          </span>
          <span>
            <span className="block text-sm font-semibold">AILAB</span>
            <span className="block text-xs text-muted-foreground">
              Secure workspace
            </span>
          </span>
        </Link>
        <ThemeToggle />
      </header>
      <section className="mx-auto grid min-h-[calc(100vh-5.5rem)] max-w-6xl items-center gap-10 px-4 pb-10 md:px-8 lg:grid-cols-[1fr_28rem]">
        <div>
          <p className="mb-4 text-xs font-semibold uppercase text-muted-foreground">
            Account recovery
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-none sm:text-5xl">
            Recover access without leaving your training workspace behind.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
            Request a short-lived code, confirm it from your inbox, and set a
            new password for your AILAB account.
          </p>
        </div>
        <Suspense fallback={null}>
          <ForgotPasswordForm />
        </Suspense>
      </section>
    </main>
  );
}
