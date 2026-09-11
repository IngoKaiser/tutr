import { notFound, redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";

import { ladeHausaufgabenListe } from "../actions";
import { AufgabenListe } from "../aufgaben-liste";

export const metadata = { title: "Hausaufgabe · tutr" };

/**
 * Die Aufgabenliste einer Hausaufgaben-Session (T-03 PR 2, §4a „Ansicht"):
 * Aufgabe · Status · (Zeit steht an der Aufgabe selbst, s. `homework_task`).
 */
export default async function HausaufgabenListePage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");
  if (actor.role !== "student") redirect("/tutor");

  const { sessionId } = await params;
  const liste = await ladeHausaufgabenListe(sessionId);
  if (!liste) notFound();

  return <AufgabenListe liste={liste} />;
}
