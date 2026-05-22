import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConfigPage from "@/app/config/page";

vi.mock("@/components/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ConfigPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("labels fallback catalog and dataset unavailability", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    render(<ConfigPage />);

    expect(
      await screen.findByText(/Using local model catalog/i),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Datasets unavailable/i)).toBeInTheDocument();
  });
});
