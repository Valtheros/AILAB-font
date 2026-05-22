import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/workspace/status-badge";

describe("StatusBadge", () => {
  it("renders an accent tone only for meaningful workflow state", () => {
    render(<StatusBadge tone="success">Worker ready</StatusBadge>);

    expect(screen.getByText("Worker ready")).toHaveAttribute(
      "data-tone",
      "success",
    );
  });
});
