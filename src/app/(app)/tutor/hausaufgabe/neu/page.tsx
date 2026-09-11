import { redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";
import { anthropicConfigured } from "@/lib/env";

import { loadTutorOverview } from "../../actions";
import { FotoAufnahme } from "../foto-aufnahme";

export const metadata = { title: "Hausaufgabe · tutr" };

/**
 * Der erste Schritt des Hausaufgaben-Tutors (T-03 PR 2, §4a Schritt 1):
 * Fach steht schon fest (aus `overview.tsx`), hier kommt das Foto dazu.
 *
 * Anders als `/tutor/neu` legt diese Seite die Session **nicht** lazy an –
 * die Foto-Galerie braucht schon vor dem ersten eingelesenen Bild eine
 * `session_id`, an die sie ihre Aufgaben hängen kann (mehrere Fotos einer
 * Doppelseite gehören zusammen). `FotoAufnahme` ruft `starteHausaufgabe()`
 * selbst beim ersten Bild auf, nicht diese Seite beim Rendern – sonst
 * entstünde bei jedem Reload eine neue, leere Session.
 */
export default async function NeueHausaufgabePage({
  searchParams,
}: {
  searchParams: Promise<{ fach?: string }>;
}) {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");
  if (actor.role !== "student") redirect("/tutor");

  const { fach } = await searchParams;
  const overview = await loadTutorOverview();
  const subject = overview?.subjects.find((s) => s.id === fach);
  if (!subject) redirect("/tutor");

  return (
    <FotoAufnahme
      subjectId={subject.id}
      subjectName={subject.name}
      available={anthropicConfigured()}
    />
  );
}
