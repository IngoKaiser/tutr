import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TutorMarkdown } from "./markdown";

describe("TutorMarkdown", () => {
  it("macht **fett** zu echtem <strong>, nicht zu Sternchen im Text", () => {
    render(<TutorMarkdown>Eine **Zelle** ist der Baustein.</TutorMarkdown>);
    const stark = screen.getByText("Zelle");
    expect(stark.tagName).toBe("STRONG");
    expect(screen.queryByText(/\*\*Zelle\*\*/)).toBeNull();
  });

  it("rendert eine Liste als <ul><li>", () => {
    render(<TutorMarkdown>{"- Erstens\n- Zweitens"}</TutorMarkdown>);
    const punkte = screen.getAllByRole("listitem");
    expect(punkte).toHaveLength(2);
    expect(punkte[0]).toHaveTextContent("Erstens");
  });

  it("rendert kein rohes HTML – der Tag bleibt Text (XSS-frei ohne Sanitizer)", () => {
    const { container } = render(
      <TutorMarkdown>{'Test <img src=x onerror="alert(1)"> Ende'}</TutorMarkdown>,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain("<img");
  });

  it("öffnet Links in neuem Tab mit noopener/nofollow", () => {
    render(<TutorMarkdown>{"[simpleclub](https://simpleclub.com)"}</TutorMarkdown>);
    const link = screen.getByRole("link", { name: "simpleclub" });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("nofollow");
  });

  it("GFM: eine Tabelle wird zu <table>", () => {
    render(<TutorMarkdown>{"| A | B |\n| - | - |\n| 1 | 2 |"}</TutorMarkdown>);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "A" })).toBeInTheDocument();
  });
});
