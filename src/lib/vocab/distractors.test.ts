import { describe, expect, it } from "vitest";

import { buildMultipleChoiceOptions, pickDistractors } from "./distractors";

function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

describe("pickDistractors", () => {
  it("schließt die richtige Antwort aus", () => {
    const result = pickDistractors(
      ["aufstehen", "aufwachen", "gehen"],
      "aufstehen",
      3,
      seededRng(1),
    );
    expect(result).not.toContain("aufstehen");
  });

  it("keine Dopplungen, auch wenn der Pool welche enthält", () => {
    const result = pickDistractors(
      ["gehen", "gehen", "gehen", "kommen"],
      "aufstehen",
      3,
      seededRng(1),
    );
    expect(new Set(result).size).toBe(result.length);
  });

  it("liefert weniger als verlangt, wenn der Pool zu klein ist – kein Fehler", () => {
    const result = pickDistractors(["gehen"], "aufstehen", 3, seededRng(1));
    expect(result).toEqual(["gehen"]);
  });

  it("liefert nichts bei einem leeren Pool", () => {
    expect(pickDistractors([], "aufstehen", 3, seededRng(1))).toEqual([]);
  });
});

describe("buildMultipleChoiceOptions", () => {
  it("enthält die richtige Antwort genau einmal", () => {
    const options = buildMultipleChoiceOptions(
      ["gehen", "kommen", "essen"],
      "aufstehen",
      3,
      seededRng(1),
    );
    expect(options.filter((o) => o === "aufstehen")).toHaveLength(1);
  });

  it("die richtige Antwort steht nicht immer an derselben Stelle", () => {
    const positions = new Set<number>();
    for (let seed = 1; seed <= 20; seed++) {
      const options = buildMultipleChoiceOptions(
        ["gehen", "kommen", "essen"],
        "aufstehen",
        3,
        seededRng(seed),
      );
      positions.add(options.indexOf("aufstehen"));
    }
    expect(positions.size).toBeGreaterThan(1);
  });
});
