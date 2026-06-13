import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import { LanguageProvider } from "@/components/language-provider";
import { LANGUAGE_COOKIE, resolveLanguage } from "@/lib/i18n";
import "./globals.css";

type ThemeName = "light" | "dark";

function resolveTheme(value: string | undefined): ThemeName {
  return value === "light" ? "light" : "dark";
}

export const metadata: Metadata = {
  title: "AILAB - AI Training Platform",
  description:
    "Train AI models easily with a visual interface. No coding required.",
  keywords: [
    "yolo",
    "yolov11",
    "object detection",
    "ai training",
    "machine learning",
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const initialTheme = resolveTheme(cookieStore.get("theme")?.value);
  const initialLanguage = resolveLanguage(cookieStore.get(LANGUAGE_COOKIE)?.value);

  return (
    <html
      className={initialTheme}
      lang={initialLanguage}
      style={{ colorScheme: initialTheme }}
      suppressHydrationWarning
    >
      <body className="antialiased">
        <LanguageProvider defaultLanguage={initialLanguage}>
          <ThemeProvider defaultTheme={initialTheme}>{children}</ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
