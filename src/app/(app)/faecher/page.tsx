import Link from "next/link";

import { Block, Notice, LearningPath, Mastery, PageHeader } from "@/components/shell/primitives";

export const metadata = { title: "Fächer · tutr" };

/**
 * Konzept §5: Fächer → Thema-Seite ist der Hub. Beispieldaten bis F-04e.
 *
 * Der „Vokabeln"-Block ist echt (V-03a) – Sets und Vokabelverwaltung hängen
 * hier, nicht unter „Üben": Vokabeln pflegen ist Material eines Fachs, das
 * Üben selbst eine eigene Sache.
 *
 * **Kein „Jahrgang 8 · 8c" mehr in der Kopfzeile.** Das stand hier als fest
 * getippter Text aus der F-07-Attrappe. Ein erfundenes Fach erkennt man als
 * Platzhalter, eine erfundene Klasse sieht aus wie ein gespeichertes
 * persönliches Datum – bei einer App, die ausdrücklich wenig speichert, ist
 * das der falsche Eindruck. Die Klasse wird bei der Anmeldung gar nicht
 * gefragt (ADR 0005, Nachtrag) und nirgends gelesen; der Jahrgang kommt
 * zurück, wenn diese Seite mit F-04e echte Daten liest.
 */
export default function SubjectsPage() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Fächer" />

      <Block title="Französisch · Les verbes pronominaux" trailing="aktiv">
        <LearningPath stage={2} />
        <Mastery coverage={72} confidence={58} />
      </Block>

      <Block title="Mathematik · Quadratische Gleichungen" trailing="aktiv">
        <LearningPath stage={2} />
        <Mastery coverage={61} confidence={34} />
      </Block>

      <Block title="Weitere Fächer">
        <Notice>Deutsch · Englisch · Biologie · PGW — noch keine aktiven Themen.</Notice>
      </Block>

      <Block title="Vokabeln">
        <Notice>Sets anlegen, Vokabeln einfügen oder von Hand eintragen.</Notice>
        <Link
          href="/faecher/vokabeln"
          className="text-koenigsblau text-[0.8125rem] font-medium underline underline-offset-2"
        >
          Zu den Vokabelsets
        </Link>
      </Block>
    </div>
  );
}
