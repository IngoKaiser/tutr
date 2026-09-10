import { redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";

import { loadOrphanGroups, loadSets, loadSubjects } from "./actions";
import { SetList } from "./set-list";

export const metadata = { title: "Vokabeln · tutr" };

/**
 * Sets nach Fach (V-03a, ADR 0007). Erste dynamische Route im Projekt
 * (`[setId]` für die Detailliste) – sonst kein neues Muster.
 *
 * Hängt unter „Fächer", nicht unter „Üben": Vokabeln pflegen ist Material
 * eines Fachs, kein Bestandteil der Übungssession.
 */
export default async function VocabSetsPage() {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  const [sets, subjects, orphanGroups] = await Promise.all([
    loadSets(),
    loadSubjects(),
    loadOrphanGroups(),
  ]);

  return (
    <SetList
      sets={sets}
      subjects={subjects}
      orphanGroups={orphanGroups}
      canManage={actor.role === "student"}
    />
  );
}
