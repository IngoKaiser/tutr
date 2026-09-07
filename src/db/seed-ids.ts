/**
 * Feste IDs der Beispieldaten. Eigene Datei, weil sowohl der Seed
 * (`src/db/seed.ts`) als auch der Dev-Actor (`src/lib/dev-actor.ts`) sie
 * brauchen – als Konstante an einer Stelle können sie nicht auseinanderlaufen.
 *
 * Seit ADR 0006 gibt es keine Familien mehr: Die Beispieldaten sind zwei
 * unverbundene Kinder plus ein Geschwisterkind, das dasselbe Elternkonto
 * teilt. Erst diese Konstellation zeigt, was die Policies leisten – ein
 * Elternteil sieht mehrere Kinder, die Kinder einander nicht.
 */
export const SEED_IDS = {
  parentOne: "00000000-0000-4000-8000-00000000d002",
  studentOne: "00000000-0000-4000-8000-00000000d003",
  siblingOne: "00000000-0000-4000-8000-00000000d004",

  parentTwo: "00000000-0000-4000-8000-00000000e002",
  studentTwo: "00000000-0000-4000-8000-00000000e003",

  schoolYearOne: "00000000-0000-4000-8000-00000000d010",
  schoolYearSibling: "00000000-0000-4000-8000-00000000d011",
  schoolYearTwo: "00000000-0000-4000-8000-00000000e010",

  subjectFrench: "00000000-0000-4000-8000-00000000d020",
  subjectMaths: "00000000-0000-4000-8000-00000000d021",

  topicVerbes: "00000000-0000-4000-8000-00000000d030",
  topicEquations: "00000000-0000-4000-8000-00000000d031",

  textbookCurated: "00000000-0000-4000-8000-00000000c001",
} as const;

/** Adresse des Beispiel-Elternteils – Anker für `app.parent_may_link`. */
export const SEED_PARENT_EMAIL = "eltern@example.org";
