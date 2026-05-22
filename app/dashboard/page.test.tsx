import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DashboardPage from "@/app/dashboard/page";

vi.mock("@/components/MainLayout", () => ({
  MainLayout: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("DashboardPage", () => {
  it("orients the user around the CV workflow", () => {
    render(<DashboardPage />);

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText(/Move from datasets to artifacts/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Upload dataset/i })).toHaveAttribute(
      "href",
      "/dataset",
    );
  });
});
