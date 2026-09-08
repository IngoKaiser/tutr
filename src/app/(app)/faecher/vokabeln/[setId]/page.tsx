import { notFound, redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";

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

  return <VocabList detail={detail} canManage={actor.role === "student"} />;
}
