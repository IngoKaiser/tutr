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

  // --- T-14: Zeilenumbrüche und Formelsatz -----------------------------

  it("ein einzelner Zeilenumbruch bleibt einer – Rechenschritte kleben nicht mehr aneinander", () => {
    // Der Fund aus dem Testen: Das Modell schrieb zwei Umformungen auf zwei
    // Zeilen, Markdown machte daraus einen Absatz, und im Chat stand beides
    // hintereinander – unterscheidbar nur durch die Fettung.
    const { container } = render(
      <TutorMarkdown>{"7x - 4x - 9 = 15\n**3x - 9 = 15**"}</TutorMarkdown>,
    );
    expect(container.querySelector("br")).not.toBeNull();
    expect(container.textContent).toContain("7x - 4x - 9 = 15");
    expect(container.textContent).toContain("3x - 9 = 15");
  });

  it("zwei Zeilenumbrüche bleiben ein Absatz, nicht zwei <br>", () => {
    const { container } = render(<TutorMarkdown>{"Erster Absatz.\n\nZweiter."}</TutorMarkdown>);
    expect(container.querySelectorAll("p")).toHaveLength(2);
    expect(container.querySelector("br")).toBeNull();
  });

  it("setzt eine Formel zwischen $…$ als echte Mathematik", () => {
    const { container } = render(<TutorMarkdown>{"Also ist $x = 8$."}</TutorMarkdown>);
    // KaTeX hinterlässt eine `.katex`-Hülle – der Text steht dann gesetzt da,
    // nicht als Dollarzeichen-Rohtext.
    expect(container.querySelector(".katex")).not.toBeNull();
    expect(container.textContent).not.toContain("$");
  });

  it("setzt eine abgesetzte Gleichung als Block – $$ auf eigenen Zeilen", () => {
    // Wichtig für den Systemprompt: `$$…$$` mitten im Absatz bleibt inline.
    // Abgesetzt wird nur, was auf eigenen Zeilen steht – der Prompt verlangt
    // genau diese Schreibweise für Rechenwege (`ai/prompts/tutor.ts`).
    const { container } = render(<TutorMarkdown>{"$$\n3x = 24\n$$"}</TutorMarkdown>);
    expect(container.querySelector(".katex-display")).not.toBeNull();
  });

  it("eine mehrzeilige Umformung mit aligned bleibt eine Einheit", () => {
    // Die Schulheft-Schreibweise: Umformung links, Operation rechts.
    const { container } = render(
      <TutorMarkdown>
        {
          "$$\n\\begin{aligned}\n7x - 9 &= 4x + 15 &&\\mid -4x \\\\\n3x - 9 &= 15\n\\end{aligned}\n$$"
        }
      </TutorMarkdown>,
    );
    expect(container.querySelector(".katex-display")).not.toBeNull();
    const gesetzt = container.querySelector(".katex-html")?.textContent ?? "";
    expect(gesetzt).toContain("7x");
    expect(gesetzt).toContain("3x");
  });

  it("kennt \\ce{…} für Chemie (mhchem)", () => {
    const { container } = render(<TutorMarkdown>{"$\\ce{2H2 + O2 -> 2H2O}$"}</TutorMarkdown>);
    expect(container.querySelector(".katex")).not.toBeNull();

    // Geprüft wird der **gesetzte** Teil (`.katex-html`), nicht der ganze
    // Text: KaTeX legt das rohe LaTeX zusätzlich als MathML-Annotation in
    // den DOM, dort steht `\ce{…}` erwartungsgemäß weiter wörtlich drin.
    //
    // `\ce` im gesetzten Teil hieße: mhchem ist nicht geladen und KaTeX hat
    // das Makro buchstabiert. Genau das passierte, solange `rehype-katex`
    // (katex ^0.16) und das Projekt (katex 0.18) zwei getrennte
    // KaTeX-Instanzen hatten – der mhchem-Import registrierte die Makros auf
    // der Instanz, die gar nicht rendert.
    const gesetzt = container.querySelector(".katex-html")?.textContent ?? "";
    expect(gesetzt).not.toContain("\\ce");
    expect(gesetzt).toContain("H");
  });

  it("kaputtes LaTeX reißt nicht die Seite mit, sondern bleibt sichtbar stehen", () => {
    // `throwOnError: false`: Ein Modell, das sich vertippt, darf den Chat
    // nicht weißfärben.
    expect(() =>
      render(<TutorMarkdown>{"$\\frac{1}{$ und weiter im Text"}</TutorMarkdown>),
    ).not.toThrow();
  });
});
