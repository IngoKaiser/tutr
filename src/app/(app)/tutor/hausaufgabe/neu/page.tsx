import { redirect } from "next/navigation";

import { Block, LinkButton, Notice, PageHeader } from "@/components/shell/primitives";
import { loginStatus } from "@/lib/auth/actor";
import { anthropicConfigured } from "@/lib/env";

import { loadTutorOverview } from "../../actions";
import { FotoAufnahme } from "../foto-aufnahme";

export const metadata = { title: "Hausaufgabe · tutr" };

/**
 * Der erste Schritt des Hausaufgaben-Tutors (T-03 PR 2, §4a Schritt 1):
 * Fach steht fest, hier kommt das Foto dazu.
 *
 * Die Session entsteht **nicht** hier lazy – die Foto-Galerie braucht schon
 * vor dem ersten eingelesenen Bild eine `session_id`, an die sie ihre
 * Aufgaben hängen kann (mehrere Fotos einer Doppelseite gehören zusammen).
 * `FotoAufnahme` ruft `starteHausaufgabe()` selbst beim ersten Bild auf,
 * nicht diese Seite beim Rendern – sonst entstünde bei jedem Reload eine
 * neue, leere Session.
 *
 * **Ohne `?fach=`**: Bis T-13 (ADR 0013 D1) übergab der Fach-Wähler auf
 * `/tutor` das Fach hierher; der ist mit der Kachelreihe verschwunden. Fach
 * aus dem Foto lesen statt zu fragen ist die Zielrichtung (ADR 0013 D7),
 * aber ein eigenes, noch offenes Stück Arbeit – bis dahin fragt diese Seite
 * selbst, mit der kleinstmöglichen Fassung der alten Fachwahl: eine Liste
 * zum Antippen, keine Einstiegs-Kacheln, kein „Gespräch beginnen“-Knopf.
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

  if (subject) {
    return (
      <FotoAufnahme
        subjectId={subject.id}
        subjectName={subject.name}
        available={anthropicConfigured()}
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Hausaufgabe" back={{ href: "/tutor", label: "Tutor" }} />
      <Block title="Welches Fach?">
        {overview && overview.subjects.length > 0 ? (
          <div className="flex flex-col gap-1.5">
            {overview.subjects.map((s) => (
              <LinkButton key={s.id} href={`/tutor/hausaufgabe/neu?fach=${s.id}`} quiet>
                {s.name}
              </LinkButton>
            ))}
          </div>
        ) : (
          <Notice>
            Leg zuerst unter „Fächer“ ein Fach im aktuellen Schuljahr an – ohne Fach weiß der Tutor
            nicht, worüber ihr redet.
          </Notice>
        )}
      </Block>
    </div>
  );
}
