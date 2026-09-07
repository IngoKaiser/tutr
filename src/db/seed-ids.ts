/**
 * Feste IDs der Beispieldaten. Eigene Datei, weil sowohl der Seed
 * (`src/db/seed.ts`) als auch der Dev-Actor (`src/lib/dev-actor.ts`) sie
 * brauchen – als Konstante an einer Stelle können sie nicht auseinanderlaufen.
 */
export const SEED_IDS = {
  familieA: "00000000-0000-4000-8000-00000000d001",
  elternteilA: "00000000-0000-4000-8000-00000000d002",
  kindA: "00000000-0000-4000-8000-00000000d003",
  geschwisterA: "00000000-0000-4000-8000-00000000d004",

  familieB: "00000000-0000-4000-8000-00000000e001",
  elternteilB: "00000000-0000-4000-8000-00000000e002",
  kindB: "00000000-0000-4000-8000-00000000e003",

  schuljahrA: "00000000-0000-4000-8000-00000000d010",
  schuljahrGeschwister: "00000000-0000-4000-8000-00000000d011",
  schuljahrB: "00000000-0000-4000-8000-00000000e010",

  franzoesisch: "00000000-0000-4000-8000-00000000d020",
  mathematik: "00000000-0000-4000-8000-00000000d021",

  themaVerbes: "00000000-0000-4000-8000-00000000d030",
  themaGleichungen: "00000000-0000-4000-8000-00000000d031",

  lehrwerkKuratiert: "00000000-0000-4000-8000-00000000c001",
} as const;
