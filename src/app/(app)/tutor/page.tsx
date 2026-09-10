import { redirect } from "next/navigation";

import { Block, Notice, PageHeader } from "@/components/shell/primitives";
import { loginStatus } from "@/lib/auth/actor";
import { anthropicConfigured } from "@/lib/env";

import { loadSession, loadTutorOverview } from "./actions";
import { TutorChat } from "./chat";

export const metadata = { title: "Tutor · tutr" };

/**
 * Der Tutor-Chat (T-02, Konzept §4/§15, ADR 0010).
 *
 * Stufe 1: ein Chatfenster, Kontext-Chip mit Fach, zwei Einstiege (freie
 * Frage und „Verstehen"), Antworten aus Allgemeinwissen – ausdrücklich als
 * solche gekennzeichnet. Kontextpaket, Schichten und „Erklär es anders"
 * sind Stufe 2 (T-01/T-02c).
 *
 * Für Eltern gibt es hier nichts (ADR 0010 D2): kein Verlauf, keine
 * Zusammenfassung. Der Zweizeiler für die Elternsicht kommt mit T-03.
 */
export default async function TutorPage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
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

  const { s } = await searchParams;
  const [overview, active] = await Promise.all([
    loadTutorOverview(),
    s ? loadSession(s) : Promise.resolve(null),
  ]);

  // `key` bindet den Client-Zustand an das gewählte Gespräch: Ein Klick auf
  // ein anderes Gespräch (echte Navigation) baut die Komponente frisch aus
  // den neuen Props auf. Ein **neu** begonnenes Gespräch navigiert dagegen
  // nicht, sondern schreibt nur die URL um – so bricht der laufende Stream
  // nicht ab.
  return (
    <TutorChat
      key={s ?? "neu"}
      overview={overview}
      active={active}
      activeId={s ?? null}
      available={anthropicConfigured()}
    />
  );
}
