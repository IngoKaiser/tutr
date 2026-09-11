import { notFound, redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";
import { anthropicConfigured } from "@/lib/env";

import { ladeAufgabe } from "../../actions";
import { AufgabeChat } from "../../aufgabe-chat";

export const metadata = { title: "Hausaufgabe · tutr" };

/** Der Dialog zu einer einzelnen Aufgabe (T-03 PR 2, §4a Schritt 2–4). */
export default async function AufgabePage({
  params,
}: {
  params: Promise<{ sessionId: string; taskId: string }>;
}) {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");
  if (actor.role !== "student") redirect("/tutor");

  const { sessionId, taskId } = await params;
  const aufgabe = await ladeAufgabe(sessionId, taskId);
  if (!aufgabe) notFound();

  return <AufgabeChat aufgabe={aufgabe} available={anthropicConfigured()} />;
}
