import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddArea } from "./vocab-list";

/**
 * Zwei Funde als Test:
 *
 * V-03c – ein Doppelseiten-Import (9. September) schrieb 60 Vokabeln in die
 * Datenbank, bevor das zweite Bild scheiterte; die Oberfläche zeigte trotzdem
 * nur eine Fehlermeldung, weil die alte Schleife bei jedem `!result.ok`
 * zurückkehrte und die längst geschriebene Bilanz verwarf.
 *
 * V-10 – die Kamera startete die Verarbeitung sofort bei der Auswahl. Jetzt
 * wird erst gesammelt (drehen, wegnehmen möglich), dann per „Einlesen“
 * gestartet.
 *
 * `vi.hoisted`, weil `vi.mock`-Fabriken vor den Imports laufen (Vitest hebt
 * sie an) – ohne das wäre `addFromPhoto` beim Aufruf der Fabrik noch nicht
 * deklariert.
 */
const { addFromPhoto } = vi.hoisted(() => ({ addFromPhoto: vi.fn() }));

vi.mock("./actions", () => ({
  addFromPhoto,
  addFromPaste: vi.fn(),
  addManualItem: vi.fn(),
  deleteItem: vi.fn(),
  updateItem: vi.fn(),
}));

vi.mock("@/lib/vocab/image", () => ({
  prepareImageForUpload: vi.fn(async () => ({ base64: "AAA", mediaType: "image/jpeg" as const })),
}));

/** Das Eingabefeld ohne `capture` ist die Mediathek – dasselbe `onChange` wie die Kamera. */
function waehleFotos(container: HTMLElement, files: File[]) {
  const inputs = [...container.querySelectorAll('input[type="file"]')];
  const galerie = inputs.find((el) => !el.hasAttribute("capture")) as HTMLInputElement;
  Object.defineProperty(galerie, "files", { value: files, configurable: true });
  fireEvent.change(galerie);
}

/** Bilder wählen und den Einlese-Lauf starten – der neue Zweischritt (V-10). */
function waehleUndLiesEin(container: HTMLElement, files: File[]) {
  waehleFotos(container, files);
  fireEvent.click(screen.getByRole("button", { name: /^Einlesen/ }));
}

function oeffneFoto() {
  fireEvent.click(screen.getByRole("button", { name: "Foto" }));
}

describe("AddArea – Foto-Galerie (V-03c, V-10)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("die Auswahl startet nichts – erst „Einlesen“ ruft die Bilderkennung (V-10)", async () => {
    const { container } = render(<AddArea setId="set-1" photoAvailable={true} />);
    oeffneFoto();

    waehleFotos(container, [
      new File(["a"], "seite-1.jpg", { type: "image/jpeg" }),
      new File(["b"], "seite-2.jpg", { type: "image/jpeg" }),
    ]);

    // Ausgewählt, aber noch nichts geschickt.
    expect(addFromPhoto).not.toHaveBeenCalled();
    const einlesen = screen.getByRole("button", { name: "Einlesen (2)" });

    addFromPhoto.mockResolvedValue({
      ok: true,
      summary: { neu: 5, verknuepft: 0, zuPruefen: 0 },
      erkannt: 5,
    });
    fireEvent.click(einlesen);

    await waitFor(() => expect(addFromPhoto).toHaveBeenCalledTimes(2));
  });

  it("ein wartendes Bild lässt sich vor dem Einlesen wieder wegnehmen (V-10)", async () => {
    const { container } = render(<AddArea setId="set-1" photoAvailable={true} />);
    oeffneFoto();

    waehleFotos(container, [
      new File(["a"], "seite-1.jpg", { type: "image/jpeg" }),
      new File(["b"], "seite-2.jpg", { type: "image/jpeg" }),
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Bild 1 entfernen" }));

    expect(screen.getByRole("button", { name: "Einlesen" })).toBeInTheDocument();

    addFromPhoto.mockResolvedValue({
      ok: true,
      summary: { neu: 3, verknuepft: 0, zuPruefen: 0 },
      erkannt: 3,
    });
    fireEvent.click(screen.getByRole("button", { name: "Einlesen" }));

    await waitFor(() => expect(addFromPhoto).toHaveBeenCalledTimes(1));
  });

  it("ein scheiterndes Bild wirft die Bilanz eines erfolgreichen nicht weg", async () => {
    addFromPhoto
      .mockResolvedValueOnce({
        ok: true,
        summary: { neu: 60, verknuepft: 0, zuPruefen: 0 },
        erkannt: 60,
      })
      .mockResolvedValueOnce({
        ok: false,
        fehler: "Die Bilderkennung ist gerade nicht erreichbar. Versuch es gleich noch einmal.",
      });

    const { container } = render(<AddArea setId="set-1" photoAvailable={true} />);
    oeffneFoto();

    const seite224 = new File(["a"], "seite-224.jpg", { type: "image/jpeg" });
    const seite222 = new File(["b"], "seite-222.jpg", { type: "image/jpeg" });
    waehleUndLiesEin(container, [seite224, seite222]);

    await waitFor(() => expect(addFromPhoto).toHaveBeenCalledTimes(2));

    // Das erste, erfolgreiche Bild bleibt sichtbar – der eigentliche Fund:
    // Es wird nicht durch den Fehler des zweiten Bildes verworfen.
    expect(await screen.findByText("60 neu.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Die Bilderkennung ist gerade nicht erreichbar. Versuch es gleich noch einmal.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nochmal" })).toBeInTheDocument();
  });

  it("Nochmal wiederholt nur das gescheiterte Bild, nicht die ganze Auswahl", async () => {
    addFromPhoto.mockResolvedValueOnce({
      ok: false,
      fehler: "Die Bilderkennung hat nicht geklappt. Versuch es noch einmal oder tippe die Zeilen.",
    });

    const { container } = render(<AddArea setId="set-1" photoAvailable={true} />);
    oeffneFoto();
    waehleUndLiesEin(container, [new File(["a"], "seite.jpg", { type: "image/jpeg" })]);

    const nochmal = await screen.findByRole("button", { name: "Nochmal" });

    addFromPhoto.mockResolvedValueOnce({
      ok: true,
      summary: { neu: 23, verknuepft: 0, zuPruefen: 0 },
      erkannt: 23,
    });
    fireEvent.click(nochmal);

    expect(await screen.findByText("23 neu.")).toBeInTheDocument();
    expect(addFromPhoto).toHaveBeenCalledTimes(2);
  });

  it("meldet fehlende Berechtigung, ohne die Galerie stehen zu lassen", async () => {
    addFromPhoto.mockResolvedValueOnce(null);

    const { container } = render(<AddArea setId="set-1" photoAvailable={true} />);
    oeffneFoto();
    waehleUndLiesEin(container, [new File(["a"], "seite.jpg", { type: "image/jpeg" })]);

    expect(await screen.findByText("Dafür fehlt die Berechtigung.")).toBeInTheDocument();
  });
});
