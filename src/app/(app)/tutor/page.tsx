import { redirect } from "next/navigation";

import { Block, Notice, PageHeader } from "@/components/shell/primitives";
import { loginStatus } from "@/lib/auth/actor";
import { anthropicConfigured } from "@/lib/env";

import { ladeAuslastung, loadTutorOverview } from "./actions";
import { TutorOverviewView } from "./overview";

export const metadata = { title: "Tutor · tutr" };

/**
 * Der Tutor – Historie und der Beginn eines neuen Gesprächs in einem (T-07,
 * umgebaut in T-13).
 *
 * **Kein Formular mehr davor** (ADR 0013 D1): Bis T-13 stand hier eine
 * Fachwahl, drei Einstiegs-Kacheln und ein „Gespräch beginnen"-Knopf, bevor
 * überhaupt ein Wort fiel. Jetzt zeigt diese Seite direkt die Historie
 * (`TutorOverviewView` → `Conversation` mit `sessionId={null}`) und das
 * Eingabefeld darunter – wer tippt und abschickt, ist im Gespräch. Welches
 * Fach gemeint ist, ordnet der Server aus der ersten Nachricht zu
 * (`ordneFachZu()`, ADR 0013 D2), statt danach zu fragen.
 *
 * Für Eltern gibt es hier weiterhin nichts (ADR 0010 D2).
 */
export default async function TutorPage() {
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

  return (
    <TutorOverviewView
      overview={await loadTutorOverview()}
      available={anthropicConfigured()}
      auslastung={await ladeAuslastung()}
    />
  );
}
