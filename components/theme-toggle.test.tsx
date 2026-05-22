import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/theme-toggle";

const setTheme = vi.fn();

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "dark",
    setTheme,
  }),
}));

describe("ThemeToggle", () => {
  beforeEach(() => {
    setTheme.mockClear();
  });

  it("switches the app from dark mode to light mode", () => {
    render(<ThemeToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle theme" }));

    expect(setTheme).toHaveBeenCalledWith("light");
  });
});
