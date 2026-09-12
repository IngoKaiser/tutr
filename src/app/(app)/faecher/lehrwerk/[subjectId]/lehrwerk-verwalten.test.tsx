import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LehrwerkVerwalten } from "./lehrwerk-verwalten";
import type { LehrwerkKontext } from "./actions";

/**
 * Lehrwerk pro Fach erfassen (L-01). `vi.hoisted`, weil `vi.mock`-Fabriken
 * vor den Imports laufen – dasselbe Muster wie bei `vocab-list.test.tsx`.
 */
const {
  ordneVorhandenesLehrwerkZu,
  entferneZuordnung,
  leseKapitelAusFoto,
  speichereNeuesLehrwerk,
  aktualisiereEigenesLehrwerk,
} = vi.hoisted(() => ({
  ordneVorhandenesLehrwerkZu: vi.fn(async () => ({ ok: true as const })),
  entferneZuordnung: vi.fn(async () => true),
  leseKapitelAusFoto: vi.fn(),
  speichereNeuesLehrwerk: vi.fn(async () => ({ ok: true as const })),
  aktualisiereEigenesLehrwerk: vi.fn(async () => ({ ok: true as const })),
}));

vi.mock("./actions", () => ({
  ordneVorhandenesLehrwerkZu,
  entferneZuordnung,
  leseKapitelAusFoto,
  speichereNeuesLehrwerk,
  aktualisiereEigenesLehrwerk,
}));

vi.mock("@/lib/image", () => ({
  prepareImageForUpload: vi.fn(async () => ({ base64: "AAA", mediaType: "image/jpeg" as const })),
}));

function waehleFotos(container: HTMLElement, files: File[]) {
  const inputs = [...container.querySelectorAll('input[type="file"]')];
  const galerie = inputs.find((el) => !el.hasAttribute("capture")) as HTMLInputElement;
  Object.defineProperty(galerie, "files", { value: files, configurable: true });
  fireEvent.change(galerie);
}

const OHNE_LEHRWERK: LehrwerkKontext = {
  subjectId: "fach-1",
  subjectName: "Französisch",
  zugewiesen: null,
  kandidaten: [],
};

const MIT_KANDIDAT: LehrwerkKontext = {
  ...OHNE_LEHRWERK,
  kandidaten: [
    {
      textbookId: "buch-kuratiert",
      titel: "Découvertes 4",
      verlag: "Klett",
      jahrgangsstufe: 8,
      kuratiert: true,
    },
  ],
};

const MIT_ZUWEISUNG: LehrwerkKontext = {
  subjectId: "fach-1",
  subjectName: "Französisch",
  zugewiesen: {
    textbookId: "buch-eigen",
    titel: "Découvertes 4",
    verlag: "Klett",
    jahrgangsstufe: 8,
    eigenes: true,
    kapitel: [{ titel: "Unité 3", seiten: "48–67", sequence: 3 }],
  },
  kandidaten: [],
};

describe("LehrwerkVerwalten", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("ohne Kandidaten geht „Lehrwerk erfassen“ direkt zum Foto-Schritt (L-02: keine Kanalwahl mehr)", () => {
    render(<LehrwerkVerwalten kontext={OHNE_LEHRWERK} fotoVerfuegbar={true} />);
    expect(screen.getByText("Kein Lehrwerk hinterlegt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Lehrwerk erfassen" }));
    expect(screen.getByText("Inhaltsverzeichnis abfotografieren")).toBeInTheDocument();
  });

  it("mit Kandidaten führt „Lehrwerk erfassen“ erst zur Zuordnungsliste, ohne KI", async () => {
    render(<LehrwerkVerwalten kontext={MIT_KANDIDAT} fotoVerfuegbar={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Lehrwerk erfassen" }));

    expect(screen.getByText("Découvertes 4")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Zuordnen" }));

    await screen.findByText("Kein Lehrwerk hinterlegt");
    expect(ordneVorhandenesLehrwerkZu).toHaveBeenCalledWith("fach-1", "buch-kuratiert");
  });

  it("Foto → Kapitelliste → Kapitel hinzufügen → Speichern (deckt „manuell“ mit ab)", async () => {
    leseKapitelAusFoto.mockResolvedValue({
      ok: true,
      titel: "Découvertes 4",
      verlag: "Klett",
      jahrgangsstufe: 8,
      kapitel: [{ titel: "Unité 3", seiten: "48–67", sequence: 3 }],
    });

    const { container } = render(
      <LehrwerkVerwalten kontext={OHNE_LEHRWERK} fotoVerfuegbar={true} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Lehrwerk erfassen" }));

    waehleFotos(container, [new File(["a"], "seite-1.jpg", { type: "image/jpeg" })]);
    fireEvent.click(screen.getByRole("button", { name: /^Einlesen/ }));

    await screen.findByRole("button", { name: "Zur Kapitelliste" });
    fireEvent.click(screen.getByRole("button", { name: "Zur Kapitelliste" }));

    expect(screen.getByDisplayValue("Découvertes 4")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Unité 3")).toBeInTheDocument();

    // Ein zweites Kapitel von Hand – ohne diesen Weg gäbe es keine manuelle
    // Eingabe mehr, seit der eigene „manuell“-Kanal entfallen ist.
    fireEvent.click(screen.getByRole("button", { name: "Kapitel hinzufügen" }));
    const kapitelTitel = screen.getAllByPlaceholderText("Kapiteltitel");
    fireEvent.change(kapitelTitel[1]!, { target: { value: "Unité 4" } });

    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await screen.findByText("Kein Lehrwerk hinterlegt");
    expect(speichereNeuesLehrwerk).toHaveBeenCalledWith("fach-1", {
      titel: "Découvertes 4",
      verlag: "Klett",
      jahrgangsstufe: 8,
      quelle: "foto",
      kapitel: [
        { titel: "Unité 3", seiten: "48–67", sequence: 1 },
        { titel: "Unité 4", seiten: null, sequence: 2 },
      ],
    });
  });

  it("Zuordnung entfernen ruft die Aktion mit der Fach-Id auf", async () => {
    render(<LehrwerkVerwalten kontext={MIT_ZUWEISUNG} fotoVerfuegbar={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Zuordnung entfernen" }));

    // `kontext` ist in diesem Test ein statisches Prop – anders als im echten
    // Serverzyklus (`revalidatePath()`) zeigt die Ansicht danach weiterhin
    // die alte Zuweisung. Geprüft wird deshalb der Aufruf, nicht der Text.
    await waitFor(() => expect(entferneZuordnung).toHaveBeenCalledWith("fach-1"));
  });

  it("Bearbeiten eines eigenen Lehrwerks speichert über aktualisiereEigenesLehrwerk", async () => {
    render(<LehrwerkVerwalten kontext={MIT_ZUWEISUNG} fotoVerfuegbar={true} />);
    fireEvent.click(screen.getByRole("button", { name: "Bearbeiten" }));

    expect(screen.getByDisplayValue("Unité 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));

    await waitFor(() =>
      expect(aktualisiereEigenesLehrwerk).toHaveBeenCalledWith(
        "fach-1",
        "buch-eigen",
        expect.objectContaining({ titel: "Découvertes 4" }),
      ),
    );
  });
});
