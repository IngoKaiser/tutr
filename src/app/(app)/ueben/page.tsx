import { redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";

import { loadDueOverview } from "./actions";
import { PracticeSession } from "./practice-session";

export const metadata = { title: "Üben · tutr" };

/**
 * Konzept §5 und §6 M4 (V-02): „Fällig heute" ist echt, Prüfungsmodus und
 * Schwachstellen sind V-04 und sagen das auch – erfundene Zahlen daneben
 * einer echten wären genau die Unwahrheit, die §15 verbietet.
 *
 * `loadDueOverview()` prüft `databaseConfigured()` selbst und liefert dann
 * `null` – dieselbe Absicherung wie bei `/einstellungen` (F-06b): die
 * CI-E2E läuft ohne `DATABASE_URL`.
 *
 * `PageHeader` steckt in `PracticeSession`, nicht hier: Die Kopfzeile muss
 * während des Übens den Fortschritt zeigen, nicht die beim Laden der Seite
 * eingefrorene Zahl – die wäre nach der ersten Antwort schon falsch.
 */
export default async function PracticePage() {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  const overview = await loadDueOverview();

  return <PracticeSession overview={overview} canStart={actor.role === "student"} />;
}
