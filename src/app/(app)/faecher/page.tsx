import { redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";

import { loadSubjects } from "./actions";
import { SubjectList } from "./subject-list";

export const metadata = { title: "Fächer · tutr" };

/**
 * Konzept §5: Fächer → Thema-Seite ist der Hub (F-16a, ADR 0009 D1).
 *
 * Vorher eine Attrappe mit erfundenen Themen und Prozentzahlen; jetzt die
 * echten Fächer des aktiven Schuljahres, anlegbar vom Kind selbst – ohne
 * Elternteil kam vorher niemand zu einem Fach (ADR 0006 D1: „funktioniert
 * ohne Elternkonto").
 */
export default async function SubjectsPage() {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  const subjects = await loadSubjects();

  return <SubjectList subjects={subjects} canManage={actor.role === "student"} />;
}
