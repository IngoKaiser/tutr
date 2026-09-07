import { Block, Hinweis, Knopf, SeitenKopf, Stapel } from "@/components/shell/bausteine";

export const metadata = { title: "Heute · tutr" };

/**
 * Konzept §5: „in 10–15 Minuten etwas Sinnvolles tun, ohne zu suchen."
 * Die Seite macht den ersten Schritt – eine klare nächste Sache, nicht eine
 * Liste zum Selbstsortieren. Beispieldaten bis K-01/V-01 echte liefern.
 */
export default function HeutePage() {
  return (
    <div className="flex flex-col gap-3">
      <SeitenKopf titel="Heute" neben="Montag, 7. September" />

      <Block titel="Französisch · Klassenarbeit" neben="in 18 Tagen" betont>
        <Hinweis>Les verbes pronominaux · Unité 3 · Vokabeln Unité 3</Hinweis>
        <Knopf>Vorbereitung öffnen</Knopf>
      </Block>

      <Block titel="Fällig heute" neben="34 Karten">
        <Stapel kann={12} uebe={15} nochmal={7} />
        <Knopf leise>Üben · etwa 12 Minuten</Knopf>
      </Block>

      <Block titel="Mathematik · Quadratische Gleichungen" neben="Festigen">
        <Hinweis>
          Zwei Verständnischecks hintereinander danebengegangen. Ich glaube, es hakt eine Stufe
          früher — 3 Fragen, dann wissen wir es.
        </Hinweis>
        <Knopf leise>Grundlagen prüfen</Knopf>
      </Block>

      <Knopf leise>Hausaufgabe fotografieren</Knopf>
    </div>
  );
}
