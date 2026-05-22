import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ResultsPage from "@/app/results/page";

vi.mock("@/components/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("ResultsPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows a service error when run history is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<ResultsPage />);

    expect(await screen.findByText(/Run history unavailable/i)).toBeInTheDocument();
  });
});
