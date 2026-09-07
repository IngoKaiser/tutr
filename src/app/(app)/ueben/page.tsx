import { Block, Hinweis, Knopf, SeitenKopf, Stapel } from "@/components/shell/bausteine";

export const metadata = { title: "Üben · tutr" };

/** Konzept §5 und §6 M4: drei Stapel, Modi, Schwachstellen. */
export default function UebenPage() {
  return (
    <div className="flex flex-col gap-3">
      <SeitenKopf titel="Üben" neben="34 fällig" />

      <Block titel="Fällig heute" neben="setübergreifend">
        <Stapel kann={12} uebe={15} nochmal={7} />
        <Knopf>Session starten</Knopf>
      </Block>

      <Block titel="Prüfungsmodus">
        <Hinweis>Die Sets der nächsten Arbeit: Französisch Unité 3, 96 Vokabeln.</Hinweis>
        <Knopf leise>Auf die Arbeit üben</Knopf>
      </Block>

      <Block titel="Schwachstellen">
        <Hinweis>
          Reflexive Verben in der Verneinung — dreimal daneben. Kein Grund zur Sorge, das ist die
          Stelle, an der es bei allen hakt.
        </Hinweis>
        <Knopf leise>Gezielt üben</Knopf>
      </Block>
    </div>
  );
}
