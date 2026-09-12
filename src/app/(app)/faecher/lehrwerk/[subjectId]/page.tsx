import { notFound, redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";
import { anthropicConfigured } from "@/lib/env";

import { ladeLehrwerkKontext } from "./actions";
import { LehrwerkVerwalten } from "./lehrwerk-verwalten";

export const metadata = { title: "Lehrwerk · tutr" };

/** Lehrwerk pro Fach erfassen (L-01, §7/§10). Route analog zu `/faecher/vokabeln/[setId]`. */
export default async function LehrwerkPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  const kontext = await ladeLehrwerkKontext(subjectId);
  if (!kontext) notFound();

  return <LehrwerkVerwalten kontext={kontext} fotoVerfuegbar={anthropicConfigured()} />;
}
