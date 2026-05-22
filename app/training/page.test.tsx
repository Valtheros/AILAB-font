import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TrainingPage from "@/app/training/page";

vi.mock("@/components/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("TrainingPage", () => {
  it("frames the page as a training monitor before a job starts", () => {
    render(<TrainingPage />);

    expect(
      screen.getByRole("heading", { name: "Training Monitor" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Start training/i }),
    ).toBeInTheDocument();
  });
});
