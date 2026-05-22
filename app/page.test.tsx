import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("offers a short path into the CV workspace", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        name: /Train vision models from dataset to artifact/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configure run/i })).toHaveAttribute(
      "href",
      "/config",
    );
    expect(screen.getByText("OCR / Document Vision")).toBeInTheDocument();
  });
});
