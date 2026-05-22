import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DatasetPage from "@/app/dataset/page";

vi.mock("@/components/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("DatasetPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows a readable service error when datasets cannot load", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<DatasetPage />);

    expect(
      await screen.findByRole("heading", {
        name: "Dataset service unavailable",
      }),
    ).toBeInTheDocument();
  });
});
