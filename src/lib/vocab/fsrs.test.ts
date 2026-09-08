import { Rating } from "ts-fsrs";
import { describe, expect, it } from "vitest";

import { fsrsCardStateSchema } from "@/db/types/fsrs";

import { applyReview, dbRatingToGrade, newCardColumns } from "./fsrs";

const RATINGS = ["nochmal", "schwierig", "gut", "leicht"] as const;

describe("newCardColumns", () => {
  it("erzeugt eine neue Karte im Zustand 'neu', fällig sofort", () => {
    const now = new Date("2026-09-08T08:00:00.000Z");
    const columns = newCardColumns(now);

    expect(columns.state).toBe("neu");
    expect(columns.dueAt).toEqual(now);
    // Muss dem JSONB-Schema genügen – das ist, was tatsächlich in der
    // Datenbank landet.
    expect(() => fsrsCardStateSchema.parse(columns.fsrsState)).not.toThrow();
  });
});

describe("applyReview", () => {
  it("verschiebt eine neue Karte bei 'Good' in die Zukunft und markiert sie nicht mehr als neu", () => {
    const now = new Date("2026-09-08T08:00:00.000Z");
    const frisch = newCardColumns(now);

    const bewertet = applyReview(frisch.fsrsState, Rating.Good, now);

    expect(bewertet.rating).toBe("gut");
    expect(bewertet.state).not.toBe("neu");
    expect(bewertet.dueAt.getTime()).toBeGreaterThan(now.getTime());
  });

  it("eine falsche Antwort ('Again') führt zurück ins Lernen", () => {
    const now = new Date("2026-09-08T08:00:00.000Z");
    const frisch = newCardColumns(now);

    const bewertet = applyReview(frisch.fsrsState, Rating.Again, now);

    expect(bewertet.rating).toBe("nochmal");
    expect(bewertet.state).toBe("lernen");
  });

  it("dbRatingToGrade und die Rückrichtung stimmen für alle vier Bewertungen überein", () => {
    const now = new Date("2026-09-08T08:00:00.000Z");
    const frisch = newCardColumns(now);

    for (const rating of RATINGS) {
      const grade = dbRatingToGrade(rating);
      const ergebnis = applyReview(frisch.fsrsState, grade, now);
      expect(ergebnis.rating).toBe(rating);
    }
  });

  it("das Ergebnis lässt sich direkt in eine weitere Bewertung geben (Kette, wie in einer echten Session)", () => {
    const t0 = new Date("2026-09-08T08:00:00.000Z");
    let stand = newCardColumns(t0);

    for (const rating of ["gut", "gut", "schwierig", "leicht"] as const) {
      const ergebnis = applyReview(stand.fsrsState, dbRatingToGrade(rating), stand.dueAt);
      stand = ergebnis;
    }

    expect(() => fsrsCardStateSchema.parse(stand.fsrsState)).not.toThrow();
    expect(stand.dueAt.getTime()).toBeGreaterThan(t0.getTime());
  });
});
