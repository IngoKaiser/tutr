import { Block, Notice, Button, Mastery, PageHeader } from "@/components/shell/primitives";

export const metadata = { title: "Prüfungen · tutr" };

/** Konzept §5 und §6 M7: Kalender, Lernplan, Probeprüfungen, Noten. */
export default function ExamsPage() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Prüfungen" trailing="nächste 4 Wochen" />

      <Block title="Französisch · Klassenarbeit" trailing="25.09." emphasized>
        <Notice>2 von 3 Themen vorbereitet · Zielnote 2</Notice>
        <Mastery coverage={72} confidence={58} />
        <Button>Vorbereitung öffnen</Button>
      </Block>

      <Block title="Mathematik · Klassenarbeit" trailing="09.10.">
        <Notice>Themen noch nicht verknüpft.</Notice>
        <Button quiet>Themen zuordnen</Button>
      </Block>

      <Block title="Termin eintragen">
        <Notice>
          Klausurplan fotografieren, Datei importieren oder von Hand eintragen — alles landet vorher
          im Review.
        </Notice>
      </Block>
    </div>
  );
}
