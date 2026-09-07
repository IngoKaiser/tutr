import { Block, Notice, LearningPath, Mastery, PageHeader } from "@/components/shell/primitives";

export const metadata = { title: "Fächer · tutr" };

/** Konzept §5: Fächer → Thema-Seite ist der Hub. Beispieldaten bis F-04e. */
export default function SubjectsPage() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Fächer" trailing="Jahrgang 8 · 8c" />

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
    </div>
  );
}
