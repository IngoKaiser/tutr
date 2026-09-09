import { redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";

import { loadDueBySubject } from "./actions";
import { PracticeSession } from "./practice-session";

export const metadata = { title: "Üben · tutr" };

/**
 * Konzept §5 und §6 M4 (V-02, fachgebunden seit V-06): „Fällig heute" ist
 * echt, Prüfungsmodus und Schwachstellen sind V-04 und sagen das auch –
 * erfundene Zahlen daneben einer echten wären genau die Unwahrheit, die §15
 * verbietet.
 *
 * Ein Block je Fach statt einer Zahl über alles (ADR 0008 D3) – niemand übt
 * Französisch- und Spanischvokabeln in derselben Runde. Kein eigener
 * Auswahl-Bildschirm davor: Bei realistisch ein bis drei Fächern mit
 * fälligen Karten steht „Französisch · 12 fällig" direkt neben dem Knopf,
 * der es übt.
 *
 * `loadDueBySubject()` prüft `databaseConfigured()` selbst und liefert dann
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

  const bySubject = await loadDueBySubject();

  return <PracticeSession bySubject={bySubject} canStart={actor.role === "student"} />;
}
