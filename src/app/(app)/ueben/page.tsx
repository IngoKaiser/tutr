import { redirect } from "next/navigation";

import { PageHeader } from "@/components/shell/primitives";
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
 */
export default async function PracticePage() {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  const overview = await loadDueOverview();

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Üben" trailing={overview ? `${overview.total} fällig` : undefined} />
      <PracticeSession overview={overview} canStart={actor.role === "student"} />
    </div>
  );
}
