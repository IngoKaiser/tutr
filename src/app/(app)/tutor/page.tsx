import { redirect } from "next/navigation";

import { Block, Notice, PageHeader } from "@/components/shell/primitives";
import { loginStatus } from "@/lib/auth/actor";

import { loadTutorOverview } from "./actions";
import { TutorOverviewView } from "./overview";

export const metadata = { title: "Tutor · tutr" };

/**
 * Ebene 1 des Tutors: die Gesprächsübersicht (T-07).
 *
 * Vorher war `/tutor` gleichzeitig Startmaske und Chat, mit der Historie
 * darunter – dadurch gab es weder einen Ort für „alle Gespräche" noch einen
 * Weg zurück aus einem Gespräch. Jetzt: hier die Übersicht, unter
 * `/tutor/neu` und `/tutor/[sessionId]` das Gespräch.
 *
 * `?einstieg=` wählt den Einstieg vor – der Kamera-Knopf auf „Heute" (H-01,
 * §5) landet damit direkt auf „Hausaufgabe" und nicht auf „Freie Frage".
 * Ein unbekannter Wert fällt still auf „Freie Frage" zurück: Die URL ist
 * Nutzereingabe, kein Vertrag.
 *
 * Für Eltern gibt es hier nichts (ADR 0010 D2).
 */
export default async function TutorPage({
  searchParams,
}: {
  searchParams: Promise<{ einstieg?: string }>;
}) {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  if (actor.role !== "student") {
    return (
      <div className="flex flex-col gap-3">
        <PageHeader title="Tutor" />
        <Block>
          <Notice>
            Der Tutor ist die Lernseite deines Kindes. Gespräche mit dem Tutor bleiben zwischen Kind
            und Tutor – du siehst später Termine, Fortschritt und Zusammenfassungen, nicht den Chat.
          </Notice>
        </Block>
      </div>
    );
  }

  const { einstieg } = await searchParams;
  return (
    <TutorOverviewView
      overview={await loadTutorOverview()}
      einstieg={einstieg === "hausaufgabe" || einstieg === "verstehen" ? einstieg : "freie_frage"}
    />
  );
}
