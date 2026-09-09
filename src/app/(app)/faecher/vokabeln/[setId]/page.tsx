import { notFound, redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";
import { anthropicConfigured } from "@/lib/env";

import { loadSetDetail } from "./actions";
import { VocabList } from "./vocab-list";

export const metadata = { title: "Vokabeln · tutr" };

export default async function VocabSetDetailPage({
  params,
}: {
  params: Promise<{ setId: string }>;
}) {
  const { setId } = await params;
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  const detail = await loadSetDetail(setId);
  if (!detail) notFound();

  // Serverseitig geprüft und als Wahrheitswert weitergereicht: Der Schlüssel
  // selbst darf den Client nie erreichen, aber ob es einen gibt, entscheidet
  // hier über einen Knopf oder einen ehrlichen Satz (V-03b).
  return (
    <VocabList
      detail={detail}
      canManage={actor.role === "student"}
      photoAvailable={anthropicConfigured()}
    />
  );
}
