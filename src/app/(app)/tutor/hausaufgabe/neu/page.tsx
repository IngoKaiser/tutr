import { redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";
import { anthropicConfigured } from "@/lib/env";

import { FotoAufnahme } from "../foto-aufnahme";

export const metadata = { title: "Hausaufgabe · tutr" };

/**
 * Der erste Schritt des Hausaufgaben-Tutors (T-03 PR 2, §4a Schritt 1).
 *
 * **Kein Fach mehr nötig, um hierher zu kommen** (ADR 0013 D7): Bis T-13
 * verlangte diese Seite ein `?fach=` aus einer vorherigen Wahl – erst aus der
 * (inzwischen entfallenen) Tutor-Übersicht, kurzzeitig aus einer eigenen
 * kleinen Fachliste hier (T-13 PR 2). Beides ist überflüssig, seit das erste
 * eingelesene Foto das Fach selbst zuordnet (`fotoZuAufgaben()`,
 * `ai/schemas/homework-extraction.ts`). Diese Seite ist deshalb wieder genau
 * das, was sie beschreibt: der Foto-Schritt, ohne Umweg davor.
 */
export default async function NeueHausaufgabePage() {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");
  if (actor.role !== "student") redirect("/tutor");

  return <FotoAufnahme available={anthropicConfigured()} />;
}
