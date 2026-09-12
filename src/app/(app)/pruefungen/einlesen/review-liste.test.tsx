import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { CalendarImportDraft } from "@/lib/calendar/import-draft";

import { ReviewListe } from "./review-liste";

/**
 * Die Review-Phase des Kalender-Imports (K-03, in K-02c aufgegangen).
 *
 * `vi.hoisted`, weil `vi.mock`-Fabriken vor den Imports laufen (Vitest hebt
 * sie an) – dasselbe Muster wie bei `vocab-list.test.tsx`.
 */
const { ladeReviewKontext, speichereEigeneGruppen, uebernehmen, setEventStatus } = vi.hoisted(
  () => ({
    ladeReviewKontext: vi.fn(),
    speichereEigeneGruppen: vi.fn(async () => true),
    uebernehmen: vi.fn(async () => ({ ok: true as const, angelegt: 1, aktualisiert: 0 })),
    setEventStatus: vi.fn(async () => undefined),
  }),
);

vi.mock("./actions", () => ({ ladeReviewKontext, speichereEigeneGruppen, uebernehmen }));
vi.mock("../actions", () => ({ setEventStatus }));

const MATHEMATIK = "fach-mathematik";
const FRANZOESISCH = "fach-franzoesisch";

function draft(patch: Partial<CalendarImportDraft>): CalendarImportDraft {
  return {
    type: "klassenarbeit",
    subjectGuess: "Mathematik",
    title: "Mathearbeit 8.5",
    displayName: null,
    date: "2026-10-09",
    groups: ["8.5"],
    relevant: true,
    confidence: "hoch",
    note: null,
    ...patch,
  };
}

const KONTEXT_OHNE_EINRICHTUNG = {
  schoolYearId: "jahr-1",
  subjects: [
    { id: MATHEMATIK, name: "Mathematik", language: null },
    { id: FRANZOESISCH, name: "Französisch", language: "fr" },
  ],
  className: "8.5",
  ownGroups: ["8.5"],
  existingEvents: [],
};

describe("ReviewListe", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("zeigt eine erkannte Zeile mit aufgelöstem Fach und übernimmt sie", async () => {
    ladeReviewKontext.mockResolvedValue(KONTEXT_OHNE_EINRICHTUNG);
    render(<ReviewListe drafts={[draft({})]} />);

    await screen.findByText("Mathearbeit 8.5");
    expect(screen.getByRole("combobox")).toHaveValue(MATHEMATIK);

    fireEvent.click(screen.getByRole("button", { name: "Übernehmen" }));

    await screen.findByText(/1 Termin angelegt/);
    expect(uebernehmen).toHaveBeenCalledWith({
      neu: [
        {
          subjectId: MATHEMATIK,
          type: "klassenarbeit",
          title: "Mathearbeit 8.5",
          date: "2026-10-09",
          groups: ["8.5"],
        },
      ],
      verschoben: [],
    });
  });

  it("Gruppen-Einrichtung beim ersten Mal: schlägt eigene Tokens vor, speichert die Auswahl", async () => {
    ladeReviewKontext.mockResolvedValue({ ...KONTEXT_OHNE_EINRICHTUNG, ownGroups: null });
    render(<ReviewListe drafts={[draft({ groups: ["8.1", "8.2", "8.5"] })]} />);

    await screen.findByText("Welche Zeilen betreffen dich?");
    // "8.5" beginnt mit der eigenen Klasse und ist deshalb vorangehakt, die anderen nicht.
    expect(screen.getByRole("checkbox", { name: "8.5" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "8.1" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Weiter" }));

    await screen.findByText("Mathearbeit 8.5");
    expect(speichereEigeneGruppen).toHaveBeenCalledWith(["8.5"]);
  });

  it("verschobene Termine zeigen altes und neues Datum, entfallene bieten „Termin absagen“ an", async () => {
    ladeReviewKontext.mockResolvedValue({
      ...KONTEXT_OHNE_EINRICHTUNG,
      existingEvents: [
        {
          id: "bestehend-1",
          subjectId: MATHEMATIK,
          groups: ["8.5"],
          date: "2026-10-06",
          title: "Mathearbeit 8.5",
        },
        {
          id: "bestehend-2",
          subjectId: FRANZOESISCH,
          groups: ["8.5"],
          date: "2026-09-25",
          title: "Frz. Arbeit",
        },
      ],
    });
    render(<ReviewListe drafts={[draft({})]} />);

    await screen.findByText(/06\.10\.2026 → 09\.10\.2026/);
    await screen.findByText("Frz. Arbeit (25.09.2026)");

    fireEvent.click(screen.getByRole("button", { name: "Termin absagen" }));
    expect(setEventStatus).toHaveBeenCalledWith("bestehend-2", "abgesagt");
  });
});
