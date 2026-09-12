import { redirect } from "next/navigation";

import { anthropicConfigured, databaseConfigured } from "@/lib/env";
import { loginStatus } from "@/lib/auth/actor";

import { KlausurplanEinlesen } from "./klausurplan-einlesen";

export const metadata = { title: "Klausurplan einlesen · tutr" };

/** Bild-Import Klausurplan (K-03, §6 M7, ADR 0016). Wie bei `/tutor/hausaufgabe/neu`: nur das Login-Gate hier, der Rest im Client. */
export default async function KlausurplanEinlesenPage() {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  return <KlausurplanEinlesen available={databaseConfigured() && anthropicConfigured()} />;
}
