import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

type ThemeName = "light" | "dark";

function resolveTheme(value: string | undefined): ThemeName {
  return value === "light" ? "light" : "dark";
}

const themeBootstrapScript = `
(() => {
  try {
    const cookieTheme = document.cookie.match(/(?:^|; )theme=(light|dark)(?:;|$)/)?.[1];
    const storedTheme = localStorage.getItem("theme");
    const theme = cookieTheme === "light" || cookieTheme === "dark"
      ? cookieTheme
      : storedTheme === "light"
        ? "light"
        : "dark";
    const root = document.documentElement;

    root.classList.remove("light", "dark");
    root.classList.add(theme);
    root.style.colorScheme = theme;
    localStorage.setItem("theme", theme);
    document.cookie = "theme=" + theme + "; Path=/; Max-Age=31536000; SameSite=Lax";
  } catch {
    document.documentElement.classList.add("dark");
    document.documentElement.style.colorScheme = "dark";
  }
})();
`;

export const metadata: Metadata = {
  title: "Train - AI Training Platform",
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

  return (
    <html
      className={initialTheme}
      lang="en"
      style={{ colorScheme: initialTheme }}
      suppressHydrationWarning
    >
      <head>
        <script
          id="theme-bootstrap"
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider defaultTheme={initialTheme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
