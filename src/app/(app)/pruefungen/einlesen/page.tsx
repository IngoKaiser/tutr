import { redirect } from "next/navigation";

import { anthropicConfigured, databaseConfigured } from "@/lib/env";
import { loginStatus } from "@/lib/auth/actor";

import { KlausurplanEinlesen } from "./klausurplan-einlesen";

export const metadata = { title: "Klausurplan einlesen · tutr" };

/**
 * Bild- **und** Datei-Import Klausurplan (K-03/K-04, §6 M7, ADR 0016). Wie
 * bei `/tutor/hausaufgabe/neu`: nur das Login-Gate hier, der Rest im Client.
 *
 * `dbVerfuegbar` und `bildVerfuegbar` getrennt (anders als K-03s
 * `available`): Der Datei-Kanal (K-04, ADR 0016 D4) braucht **keinen**
 * Modellaufruf – ohne `ANTHROPIC_API_KEY` funktioniert er trotzdem, nur der
 * Foto-Kanal nicht.
 */
export default async function KlausurplanEinlesenPage() {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  return (
    <KlausurplanEinlesen
      dbVerfuegbar={databaseConfigured()}
      bildVerfuegbar={anthropicConfigured()}
    />
  );
}
