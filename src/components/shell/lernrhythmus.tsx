/**
 * Erklärt den Lernrhythmus beim Vokabelüben (V-13).
 *
 * Aus der Rückmeldung: Die drei Kacheln „Neu / Am Üben / Sitzt" (V-08) und
 * die wechselnde Fällig-Zahl sind ohne Erklärung nicht nachvollziehbar –
 * warum ist nicht jeden Tag alles dran? tutr rechnet über `ts-fsrs`
 * (CLAUDE.md: „Spaced Repetition ausschließlich über ts-fsrs"), aber dieser
 * Name gehört nicht vors Kind – erklärt wird das **Prinzip**, nicht der
 * Algorithmus.
 *
 * Ein natives `<details>` statt eigenem Auf/Zu-Zustand: kostenlos
 * tastaturbedienbar, kein `useState`, kein Layout-Sprung durch einen
 * Portal/Modal.
 */
export function Lernrhythmus() {
  return (
    <details className="border-linie bg-papier group rounded-[10px] border p-3.5">
      <summary className="text-tinte-weich hover:text-tinte flex cursor-pointer list-none items-center gap-1.5 text-[0.8125rem] font-medium">
        <span
          aria-hidden="true"
          className="border-linie-stark text-tinte-leise flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[0.625rem] leading-none font-semibold transition-transform group-open:rotate-180"
        >
          ?
        </span>
        Wie entscheidet tutr, wann eine Vokabel wieder dran ist?
      </summary>

      <div className="mt-3 flex flex-col gap-3">
        <ReadingParagraph>
          Jede Vokabel startet bei <b>Neu</b>. Beantwortest du sie richtig, wandert sie weiter – zu{" "}
          <b>Am Üben</b>, und wenn du sie in <b>beiden Richtungen</b> sicher kannst, zu <b>Sitzt</b>
          . Danach musst du sie nicht mehr jeden Tag üben: Je öfter du eine Vokabel richtig weißt,
          desto länger wartet tutr, bis sie zurückkommt.
        </ReadingParagraph>

        <LernkurveSvg />

        <ReadingParagraph>
          Eine falsche Antwort dreht das um: Die Vokabel kommt noch in <b>derselben Übung</b> wieder
          – und beim nächsten Mal wieder früher als sonst. Deshalb ist nicht jeden Tag alles fällig:
          tutr merkt sich für jede Vokabel einzeln, wie sicher du sie schon kannst.
        </ReadingParagraph>
      </div>
    </details>
  );
}

function ReadingParagraph({ children }: { children: React.ReactNode }) {
  return <p className="text-tinte-weich text-[0.8125rem] leading-relaxed">{children}</p>;
}

/**
 * Eine Vokabel, viermal hintereinander richtig gewusst: Der Abstand bis zum
 * nächsten Mal wächst jedes Mal. Bewusst **eine** Vokabel, nicht der ganze
 * Wortschatz – die Zahlen sind erfundene, aber plausible Tage, keine echte
 * FSRS-Berechnung; es geht um das Prinzip „öfter richtig → größere Pause",
 * nicht um eine korrekte Kurve.
 */
function LernkurveSvg() {
  const punkte = [
    { x: 36, tag: "heute", ton: "neu" as const },
    { x: 132, tag: "morgen", ton: "ueben" as const },
    { x: 268, tag: "in 5 Tagen", ton: "ueben" as const },
    { x: 440, tag: "in 3 Wochen", ton: "sitzt" as const },
  ];
  const FARBE = {
    neu: "fill-tinte-leise",
    ueben: "fill-koenigsblau",
    sitzt: "fill-sicher",
  };

  return (
    <svg
      viewBox="0 0 560 92"
      className="text-linie-stark w-full"
      role="img"
      aria-label="Eine Vokabel wird viermal hintereinander richtig gewusst. Der Abstand bis zur nächsten Abfrage wächst jedes Mal: heute, morgen, in 5 Tagen, in 3 Wochen."
    >
      <line x1="20" y1="40" x2="500" y2="40" stroke="currentColor" strokeWidth="1.5" />
      {punkte.slice(0, -1).map((p, i) => {
        const naechster = punkte[i + 1]!;
        const mitte = (p.x + naechster.x) / 2;
        return (
          <path
            key={p.tag}
            d={`M ${p.x} 40 Q ${mitte} 10 ${naechster.x} 40`}
            fill="none"
            className="stroke-koenigsblau"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        );
      })}
      {punkte.map((p) => (
        <g key={p.tag}>
          <circle cx={p.x} cy={40} r={9} className={FARBE[p.ton]} />
          <text
            x={p.x}
            y={68}
            textAnchor="middle"
            className="fill-tinte-weich"
            style={{ font: "600 11px var(--font-sans, sans-serif)" }}
          >
            {p.tag}
          </text>
        </g>
      ))}
    </svg>
  );
}
