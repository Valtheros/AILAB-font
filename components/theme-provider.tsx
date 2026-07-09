"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeName = "light" | "dark";

function ThemeProvider({
  children,
  defaultTheme = "dark",
}: {
  children: React.ReactNode;
  defaultTheme?: ThemeName;
}) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      disableTransitionOnChange
      enableColorScheme
      enableSystem={false}
      storageKey="theme"
    >
      {children}
    </NextThemesProvider>
  );
}

export { ThemeProvider };
