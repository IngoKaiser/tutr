import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Lernrhythmus } from "./lernrhythmus";

// vitest.config: globals: false → kein Auto-Cleanup zwischen Tests.
afterEach(cleanup);

/** V-13: die Erklärung ist standardmäßig zu, aber immer im DOM (kein JS nötig, um sie zu lesen). */
describe("Lernrhythmus", () => {
  it("ist standardmäßig eingeklappt", () => {
    const { container } = render(<Lernrhythmus />);
    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });

  it("nennt das Prinzip ohne den Algorithmusnamen", () => {
    render(<Lernrhythmus />);
    expect(screen.getByText(/Am Üben/)).toBeInTheDocument();
    expect(screen.getByText(/Sitzt/)).toBeInTheDocument();
    expect(screen.queryByText(/FSRS/i)).not.toBeInTheDocument();
  });

  it("das Diagramm beschreibt sich selbst für Screenreader", () => {
    render(<Lernrhythmus />);
    expect(
      screen.getByRole("img", { name: /heute[\s\S]*morgen[\s\S]*Tagen[\s\S]*Wochen/ }),
    ).toBeInTheDocument();
  });
});
