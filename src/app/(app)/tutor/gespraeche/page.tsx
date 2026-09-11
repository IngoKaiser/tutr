import { redirect } from "next/navigation";

import { Block, Notice, PageHeader } from "@/components/shell/primitives";
import { loginStatus } from "@/lib/auth/actor";

import { loadAlleGespraeche } from "../actions";
import { ArchivView } from "./archiv";

export const metadata = { title: "Alle Gespräche · tutr" };

/**
 * Das Archiv (T-19c, ADR 0014 D3).
 *
 * `/tutor` zeigt die letzten sechs und bleibt damit Startfläche; hier steht
 * alles, nach Fach gruppiert und durchsuchbar. Die Trennung ist der Punkt:
 * Eine Liste, die zugleich Archiv und Startfläche sein soll, ist für beides
 * zu lang beziehungsweise zu unsortiert.
 *
 * Für Eltern gibt es hier nichts (ADR 0010 D2) – wie auf `/tutor` selbst.
 */
export default async function GespraechePage() {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  if (actor.role !== "student") {
    return (
      <>
        <PageHeader title="Alle Gespräche" back={ZURUECK} />
        <Block>
          <Notice>
            Gespräche mit dem Tutor bleiben zwischen Kind und Tutor – du siehst später Termine,
            Fortschritt und Zusammenfassungen, nicht den Chat.
          </Notice>
        </Block>
      </>
    );
  }

  const sessions = await loadAlleGespraeche();

  if (!sessions) {
    return (
      <>
        <PageHeader title="Alle Gespräche" back={ZURUECK} />
        <Block>
          <Notice>Der Tutor ist gerade nicht verfügbar.</Notice>
        </Block>
      </>
    );
  }

  return <ArchivView sessions={sessions} />;
}

/** `label` benennt die Zielseite so, wie sie oben heißt (T-18, `PageHeader`). */
const ZURUECK = { href: "/tutor", label: "Tutor" };
