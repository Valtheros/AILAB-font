import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/workspace/page-header";

describe("PageHeader", () => {
  it("renders hierarchy and actions for a workflow page", () => {
    render(
      <PageHeader
        eyebrow="Workspace"
        title="Dataset Management"
        description="Upload and inspect datasets."
        actions={<Button>Refresh</Button>}
      />,
    );

    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Dataset Management" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
  });
});
