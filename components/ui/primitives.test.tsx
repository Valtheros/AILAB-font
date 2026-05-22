import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

describe("shared UI primitives", () => {
  it("uses semantic console tokens for core controls", () => {
    render(
      <>
        <Button variant="outline">Refresh</Button>
        <Card>Metrics</Card>
      </>,
    );

    expect(screen.getByRole("button", { name: "Refresh" })).toHaveClass(
      "border-border",
    );
    expect(screen.getByText("Metrics")).toHaveClass("bg-card");
  });
});
