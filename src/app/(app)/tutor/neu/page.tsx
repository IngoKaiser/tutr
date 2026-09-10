import { redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";
import { anthropicConfigured } from "@/lib/env";

import { loadTutorOverview } from "../actions";
import { Conversation } from "../chat";

export const metadata = { title: "Neues Gespräch · tutr" };

/**
 * Ein Gespräch, das es noch nicht gibt (T-07).
 *
 * Fach und Einstieg stehen in der URL, die Zeile in `tutor_session` entsteht
 * erst mit der ersten Frage – so sammeln sich keine leeren Gespräche an, nur
 * weil jemand die Seite geöffnet hat. Danach schreibt der Client die URL auf
 * `/tutor/<id>` um, ohne zu navigieren (der Stream läuft ja).
 */
export default async function NeuesGespraechPage({
  searchParams,
}: {
  searchParams: Promise<{ fach?: string; einstieg?: string }>;
}) {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");
  if (actor.role !== "student") redirect("/tutor");

  const { fach, einstieg } = await searchParams;
  const overview = await loadTutorOverview();
  const subject = overview?.subjects.find((s) => s.id === fach);

  // Ohne gültiges Fach gibt es nichts zu besprechen – zurück zur Auswahl,
  // statt ein Gespräch ohne Kontext aufzumachen (ADR 0010 D6).
  if (!subject) redirect("/tutor");

  return (
    <Conversation
      sessionId={null}
      subjectId={subject.id}
      subjectName={subject.name}
      subjectLanguage={subject.language}
      topicTitle={null}
      entryPoint={einstieg === "verstehen" ? "verstehen" : "freie_frage"}
      initialMessages={[]}
      available={anthropicConfigured()}
    />
  );
}
