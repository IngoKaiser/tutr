import { notFound, redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";

import { loadOrphans } from "./actions";
import { OrphanList } from "./orphan-list";

export const metadata = { title: "Ohne Set · tutr" };

export default async function OrphanPage({ params }: { params: Promise<{ subjectId: string }> }) {
  const { subjectId } = await params;
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  const view = await loadOrphans(subjectId);
  if (!view) notFound();

  return <OrphanList view={view} canManage={actor.role === "student"} />;
}
