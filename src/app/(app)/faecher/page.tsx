import { Block, Hinweis, Lernpfad, Mastery, SeitenKopf } from "@/components/shell/bausteine";

export const metadata = { title: "Fächer · tutr" };

/** Konzept §5: Fächer → Thema-Seite ist der Hub. Beispieldaten bis F-04e. */
export default function FaecherPage() {
  return (
    <div className="flex flex-col gap-3">
      <SeitenKopf titel="Fächer" neben="Jahrgang 8 · 8c" />

      <Block titel="Französisch · Les verbes pronominaux" neben="aktiv">
        <Lernpfad stufe={2} />
        <Mastery abdeckung={72} sicherheit={58} />
      </Block>

      <Block titel="Mathematik · Quadratische Gleichungen" neben="aktiv">
        <Lernpfad stufe={2} />
        <Mastery abdeckung={61} sicherheit={34} />
      </Block>

      <Block titel="Weitere Fächer">
        <Hinweis>Deutsch · Englisch · Biologie · PGW — noch keine aktiven Themen.</Hinweis>
      </Block>
    </div>
  );
}
