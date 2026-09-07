import { Block, Notice, Button, PageHeader, Stack } from "@/components/shell/primitives";

export const metadata = { title: "Üben · tutr" };

/** Konzept §5 und §6 M4: drei Stapel, Modi, Schwachstellen. */
export default function PracticePage() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Üben" trailing="34 fällig" />

      <Block title="Fällig heute" trailing="setübergreifend">
        <Stack confident={12} practicing={15} again={7} />
        <Button>Session starten</Button>
      </Block>

      <Block title="Prüfungsmodus">
        <Notice>Die Sets der nächsten Arbeit: Französisch Unité 3, 96 Vokabeln.</Notice>
        <Button quiet>Auf die Arbeit üben</Button>
      </Block>

      <Block title="Schwachstellen">
        <Notice>
          Reflexive Verben in der Verneinung — dreimal daneben. Kein Grund zur Sorge, das ist die
          Stelle, an der es bei allen hakt.
        </Notice>
        <Button quiet>Gezielt üben</Button>
      </Block>
    </div>
  );
}
