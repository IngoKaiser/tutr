import { Block, Hinweis, Knopf, Mastery, SeitenKopf } from "@/components/shell/bausteine";

export const metadata = { title: "Prüfungen · tutr" };

/** Konzept §5 und §6 M7: Kalender, Lernplan, Probeprüfungen, Noten. */
export default function PruefungenPage() {
  return (
    <div className="flex flex-col gap-3">
      <SeitenKopf titel="Prüfungen" neben="nächste 4 Wochen" />

      <Block titel="Französisch · Klassenarbeit" neben="25.09." betont>
        <Hinweis>2 von 3 Themen vorbereitet · Zielnote 2</Hinweis>
        <Mastery abdeckung={72} sicherheit={58} />
        <Knopf>Vorbereitung öffnen</Knopf>
      </Block>

      <Block titel="Mathematik · Klassenarbeit" neben="09.10.">
        <Hinweis>Themen noch nicht verknüpft.</Hinweis>
        <Knopf leise>Themen zuordnen</Knopf>
      </Block>

      <Block titel="Termin eintragen">
        <Hinweis>
          Klausurplan fotografieren, Datei importieren oder von Hand eintragen — alles landet vorher
          im Review.
        </Hinweis>
      </Block>
    </div>
  );
}
