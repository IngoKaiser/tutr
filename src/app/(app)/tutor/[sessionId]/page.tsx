import { notFound, redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";
import { anthropicConfigured } from "@/lib/env";

import { loadSession, loadTutorOverview } from "../actions";
import { Conversation } from "../chat";

export const metadata = { title: "Tutor · tutr" };

/**
 * Ebene 2 des Tutors: ein bestehendes Gespräch (T-07).
 *
 * Eigene Route statt `?s=…`, damit der Zurück-Link auf die Übersicht ehrlich
 * ist – `primitives.tsx` verlangt ihn für jede Seite unterhalb eines
 * Fußleisten-Bereichs, und die erste Fassung hatte ihn vergessen.
 */
export default async function GespraechPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");
  if (actor.role !== "student") redirect("/tutor");

  const { sessionId } = await params;
  const session = await loadSession(sessionId);
  // `null` heißt: gibt es nicht, oder gehört einem anderen Kind – RLS
  // unterscheidet das nicht, und die Oberfläche soll es auch nicht.
  if (!session) notFound();
  // Eine Hausaufgaben-Session gehört auf ihre eigene Route (T-03 PR 2) – der
  // freie Chat kennt weder Aufgabenliste noch Bahnen. Ein alter Link oder ein
  // Eintrag aus der Übersicht landet trotzdem hier, deshalb die Weiche.
  if (session.entryPoint === "hausaufgabe") redirect(`/tutor/hausaufgabe/${sessionId}`);

  const overview = await loadTutorOverview();
  const subject = overview?.subjects.find((s) => s.name === session.subjectName);

  return (
    <Conversation
      sessionId={session.id}
      subjectId={subject?.id ?? ""}
      subjectName={session.subjectName}
      subjectLanguage={session.subjectLanguage}
      topicTitle={session.topicTitle}
      entryPoint={session.entryPoint === "verstehen" ? "verstehen" : "freie_frage"}
      initialMessages={session.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }))}
      available={anthropicConfigured()}
    />
  );
}
