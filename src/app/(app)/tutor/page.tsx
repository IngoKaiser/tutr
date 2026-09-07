import { Block, Hinweis, KontextChip, Lesetext, SeitenKopf } from "@/components/shell/bausteine";

export const metadata = { title: "Tutor · tutr" };

/**
 * Konzept §5 und §15: Der Kontext-Chip steht immer über der Eingabe, damit
 * jederzeit sichtbar ist, worüber geredet wird. Einstiegs-Chips als Abkürzung,
 * „Hausaufgabe" am prominentesten.
 */
const EINSTIEGE = ["Hausaufgabe", "Verstehen", "Vorschau", "Prüfung", "Nachbereitung"] as const;

export default function TutorPage() {
  return (
    <div className="flex flex-col gap-3">
      <SeitenKopf titel="Tutor" />

      <Block>
        <Lesetext>
          Reflexive Verben beschreiben eine Handlung, die auf die handelnde Person zurückwirkt. Im
          Deutschen steht dafür „sich“ — im Französischen ändert sich das Pronomen mit der Person.
        </Lesetext>
      </Block>

      <div className="flex flex-wrap gap-1.5">
        {EINSTIEGE.map((e, i) => (
          <span
            key={e}
            className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${
              i === 0
                ? "border-koenigsblau bg-koenigsblau-hell text-koenigsblau"
                : "border-linie-stark text-tinte-weich"
            }`}
          >
            {e}
          </span>
        ))}
      </div>

      <Block>
        <KontextChip fach="Französisch" thema="Les verbes pronominaux" />
        <Hinweis>Frag etwas, sprich oder fotografiere die Aufgabe.</Hinweis>
      </Block>
    </div>
  );
}
