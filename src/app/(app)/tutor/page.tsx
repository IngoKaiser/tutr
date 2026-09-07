import { Block, Notice, ContextChip, ReadingText, PageHeader } from "@/components/shell/primitives";

export const metadata = { title: "Tutor · tutr" };

/**
 * Konzept §5 und §15: Der Kontext-Chip steht immer über der Eingabe, damit
 * jederzeit sichtbar ist, worüber geredet wird. Einstiegs-Chips als Abkürzung,
 * „Hausaufgabe" am prominentesten.
 */
const STARTERS = ["Hausaufgabe", "Verstehen", "Vorschau", "Prüfung", "Nachbereitung"] as const;

export default function TutorPage() {
  return (
    <div className="flex flex-col gap-3">
      <PageHeader title="Tutor" />

      <Block>
        <ReadingText>
          Reflexive Verben beschreiben eine Handlung, die auf die handelnde Person zurückwirkt. Im
          Deutschen steht dafür „sich“ — im Französischen ändert sich das Pronomen mit der Person.
        </ReadingText>
      </Block>

      <div className="flex flex-wrap gap-1.5">
        {STARTERS.map((e, i) => (
          <span
            key={e}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
              i === 0
                ? "border-koenigsblau bg-koenigsblau-hell text-koenigsblau"
                : "border-linie-stark bg-flaeche text-tinte-weich"
            }`}
          >
            {e}
          </span>
        ))}
      </div>

      <Block>
        <ContextChip subject="Französisch" topic="Les verbes pronominaux" />
        <Notice>Frag etwas, sprich oder fotografiere die Aufgabe.</Notice>
      </Block>
    </div>
  );
}
