import { Block, Notice, Button, PageHeader, Stack } from "@/components/shell/primitives";

export const metadata = { title: "Heute · tutr" };

/**
 * Konzept §5: „in 10–15 Minuten etwas Sinnvolles tun, ohne zu suchen."
 * Die Seite macht den ersten Schritt – eine klare nächste Sache, nicht eine
 * Liste zum Selbstsortieren. Beispieldaten bis K-01/V-01 echte liefern.
 */
export default function TodayPage() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Heute" trailing="Montag, 7. September" />

      <Block title="Französisch · Klassenarbeit" trailing="in 18 Tagen" emphasized>
        <Notice>Les verbes pronominaux · Unité 3 · Vokabeln Unité 3</Notice>
        <Button>Vorbereitung öffnen</Button>
      </Block>

      <Block title="Fällig heute" trailing="34 Karten">
        <Stack confident={12} practicing={15} again={7} />
        <Button quiet>Üben · etwa 12 Minuten</Button>
      </Block>

      <Block title="Mathematik · Quadratische Gleichungen" trailing="Festigen">
        <Notice>
          Zwei Verständnischecks hintereinander danebengegangen. Ich glaube, es hakt eine Stufe
          früher — 3 Fragen, dann wissen wir es.
        </Notice>
        <Button quiet>Grundlagen prüfen</Button>
      </Block>

      <Button quiet>Hausaufgabe fotografieren</Button>
    </div>
  );
}
