import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SwipeRow, UndoLoeschen } from "./swipe-row";

// vitest.config: globals: false → kein Auto-Cleanup, sonst stapeln sich die
// Renders und `getByText` findet mehrere.
afterEach(cleanup);

/**
 * V-11: die Wisch-Zeile. Die Gesten-Feinheiten (Trägheit, echtes
 * Pointer-Capture) lassen sich in jsdom nicht nachstellen – geprüft wird die
 * Schwellenlogik: kurzer Wisch klappt zurück, mittlerer rastet ein und macht
 * den Knopf fokussierbar, langer löscht direkt.
 */
function ziehe(el: Element, distanz: number) {
  fireEvent.pointerDown(el, { clientX: 300, clientY: 40, button: 0, pointerId: 1 });
  fireEvent.pointerMove(el, { clientX: 300 + distanz, clientY: 40, pointerId: 1 });
  fireEvent.pointerUp(el, { clientX: 300 + distanz, clientY: 40, pointerId: 1 });
}

describe("SwipeRow", () => {
  it("ein kurzer Wisch löst nichts aus und klappt zurück", () => {
    const onDelete = vi.fn();
    render(
      <ul>
        <SwipeRow onDelete={onDelete}>
          <button type="button">Zeile</button>
        </SwipeRow>
      </ul>,
    );
    const flaeche = screen.getByText("Zeile").parentElement!;
    ziehe(flaeche, -20);
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Löschen")).toHaveAttribute("tabindex", "-1");
  });

  it("ein mittlerer Wisch rastet ein und macht „Löschen“ erreichbar", () => {
    const onDelete = vi.fn();
    render(
      <ul>
        <SwipeRow onDelete={onDelete}>
          <button type="button">Zeile</button>
        </SwipeRow>
      </ul>,
    );
    const flaeche = screen.getByText("Zeile").parentElement!;
    ziehe(flaeche, -80);

    const loeschen = screen.getByText("Löschen");
    expect(loeschen).toHaveAttribute("tabindex", "0");
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(loeschen);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("ein langer Wisch löscht direkt", () => {
    const onDelete = vi.fn();
    render(
      <ul>
        <SwipeRow onDelete={onDelete}>
          <button type="button">Zeile</button>
        </SwipeRow>
      </ul>,
    );
    ziehe(screen.getByText("Zeile").parentElement!, -160);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("eine vertikale Bewegung gilt als Scrollen, nicht als Wisch", () => {
    const onDelete = vi.fn();
    render(
      <ul>
        <SwipeRow onDelete={onDelete}>
          <button type="button">Zeile</button>
        </SwipeRow>
      </ul>,
    );
    const flaeche = screen.getByText("Zeile").parentElement!;
    fireEvent.pointerDown(flaeche, { clientX: 300, clientY: 40, button: 0, pointerId: 1 });
    fireEvent.pointerMove(flaeche, { clientX: 292, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(flaeche, { clientX: 292, clientY: 200, pointerId: 1 });
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Löschen")).toHaveAttribute("tabindex", "-1");
  });

  it("disabled: kein Wischen", () => {
    const onDelete = vi.fn();
    render(
      <ul>
        <SwipeRow onDelete={onDelete} disabled>
          <button type="button">Zeile</button>
        </SwipeRow>
      </ul>,
    );
    ziehe(screen.getByText("Zeile").parentElement!, -200);
    expect(onDelete).not.toHaveBeenCalled();
  });
});

describe("UndoLoeschen", () => {
  it("zeigt je schwebender Löschung eine Rückgängig-Zeile", () => {
    const onZurueck = vi.fn();
    render(
      <UndoLoeschen
        eintraege={[
          { id: "a", label: "aller" },
          { id: "b", label: "venir" },
        ]}
        onZurueck={onZurueck}
      />,
    );
    expect(screen.getByText("„aller“ gelöscht")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Rückgängig" })[1]!);
    expect(onZurueck).toHaveBeenCalledWith("b");
  });

  it("rendert nichts, wenn nichts schwebt", () => {
    const { container } = render(<UndoLoeschen eintraege={[]} onZurueck={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
