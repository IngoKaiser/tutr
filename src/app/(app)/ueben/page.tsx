import { redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";

import { loadDueBySubject, loadSetSessionCards } from "./actions";
import { PracticeSession, type InitialSetSession } from "./practice-session";
import type { Direction } from "@/lib/vocab/session";

export const metadata = { title: "Üben · tutr" };

/**
 * Konzept §5 und §6 M4 (V-02, fachgebunden seit V-06, Modi seit V-04):
 * „Fällig heute" ist echt – erfundene Zahlen daneben wären genau die
 * Unwahrheit, die §15 verbietet. Prüfungsmodus fehlt weiterhin (K-01, der
 * Kalender, steht noch aus – ohne Termine keine „nächste Arbeit").
 *
 * Ein Block je Fach statt einer Zahl über alles (ADR 0008 D3) – niemand übt
 * Französisch- und Spanischvokabeln in derselben Runde. Kein eigener
 * Auswahl-Bildschirm davor: Bei realistisch ein bis drei Fächern mit
 * fälligen Karten steht „Französisch · 12 fällig" direkt neben dem Knopf,
 * der es übt.
 *
 * **Set-Modus (V-04):** `?set=<id>&richtung=<...>` kommt von „Dieses Set
 * üben" auf der Set-Seite (`/faecher/vokabeln/[setId]`) – der Einstieg lebt
 * dort, nicht hier (ADR 0008 Nachtrag V-04). Diese Seite lädt die Karten
 * dafür serverseitig und übergibt sie fertig an `PracticeSession`, die dann
 * direkt in der Übung startet, ohne die Fach-Übersicht dazwischen.
 *
 * `loadDueBySubject()` prüft `databaseConfigured()` selbst und liefert dann
 * `null` – dieselbe Absicherung wie bei `/einstellungen` (F-06b): die
 * CI-E2E läuft ohne `DATABASE_URL`.
 *
 * `PageHeader` steckt in `PracticeSession`, nicht hier: Die Kopfzeile muss
 * während des Übens den Fortschritt zeigen, nicht die beim Laden der Seite
 * eingefrorene Zahl – die wäre nach der ersten Antwort schon falsch.
 */
export default async function PracticePage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; richtung?: string }>;
}) {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  const { set, richtung } = await searchParams;
  const direction: Direction | null =
    richtung === "vorwaerts" || richtung === "rueckwaerts" ? richtung : null;

  const [bySubject, setSession] = await Promise.all([
    loadDueBySubject(),
    set ? loadSetSessionCards(set, direction) : Promise.resolve(null),
  ]);

  const initialSession: InitialSetSession | null = setSession
    ? { label: setSession.setTitle, cards: setSession.cards }
    : null;

  return (
    <PracticeSession
      bySubject={bySubject}
      canStart={actor.role === "student"}
      initialSession={initialSession}
      // `set` stand da, aber `loadSetSessionCards()` kam leer zurück (Set
      // gelöscht, keine Karten, oder keine Kind-Rolle) – ehrlich sagen statt
      // stillschweigend auf die Übersicht zurückzufallen.
      setLoadFailed={Boolean(set) && !setSession}
    />
  );
}
