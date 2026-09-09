import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AddArea } from "./vocab-list";

/**
 * Der Fund vom 9. September, als Test (V-03c): Ein Doppelseiten-Import
 * schrieb 60 Vokabeln in die Datenbank, bevor das zweite Bild scheiterte –
 * die Oberfläche zeigte trotzdem nur eine Fehlermeldung, weil die alte
 * `submitPhotos()`-Schleife bei jedem `!result.ok` sofort zurückkehrte und
 * die längst geschriebene Bilanz des ersten Bildes verwarf.
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

describe("AddArea – Foto-Galerie (V-03c)", () => {
  afterEach(() => {
    vi.clearAllMocks();
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
    fireEvent.click(screen.getByRole("button", { name: "Foto" }));

    const seite224 = new File(["a"], "seite-224.jpg", { type: "image/jpeg" });
    const seite222 = new File(["b"], "seite-222.jpg", { type: "image/jpeg" });
    waehleFotos(container, [seite224, seite222]);

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
    fireEvent.click(screen.getByRole("button", { name: "Foto" }));
    waehleFotos(container, [new File(["a"], "seite.jpg", { type: "image/jpeg" })]);

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
    fireEvent.click(screen.getByRole("button", { name: "Foto" }));
    waehleFotos(container, [new File(["a"], "seite.jpg", { type: "image/jpeg" })]);

    expect(await screen.findByText("Dafür fehlt die Berechtigung.")).toBeInTheDocument();
  });
});
