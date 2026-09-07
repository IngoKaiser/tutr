/**
 * Bausteine der Designsprache. Jeder trägt eine Konzeptentscheidung – sie
 * kommen nicht aus einem UI-Kit.
 */

export function SeitenKopf({ titel, neben }: { titel: string; neben?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{titel}</h1>
      {neben ? <span className="text-tinte-leise text-xs">{neben}</span> : null}
    </div>
  );
}

export function Block({
  titel,
  neben,
  betont = false,
  children,
}: {
  titel?: string;
  neben?: string;
  betont?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-2.5 rounded-[10px] border p-3.5 ${
        betont ? "border-koenigsblau bg-koenigsblau-hell" : "border-linie bg-papier"
      }`}
    >
      {titel ? (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{titel}</h2>
          {neben ? <span className="text-tinte-leise text-xs tabular-nums">{neben}</span> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Mastery ist nie eine Zahl, immer zwei (Konzept §6 M1). */
export function Mastery({ abdeckung, sicherheit }: { abdeckung: number; sicherheit: number }) {
  const teile = [
    { wert: abdeckung, marke: "Abdeckung", farbe: "bg-koenigsblau" },
    { wert: sicherheit, marke: "Sicherheit", farbe: "bg-sicher" },
  ];
  return (
    <div className="flex gap-5">
      {teile.map((t) => (
        <div key={t.marke} className="flex flex-1 flex-col gap-1.5">
          <span className="text-2xl leading-none font-semibold tabular-nums">{t.wert} %</span>
          <span className="text-tinte-leise text-[0.6875rem] font-semibold tracking-wider uppercase">
            {t.marke}
          </span>
          <span className="bg-papier-tief h-1 overflow-hidden rounded-full">
            <span
              className={`block h-full rounded-full ${t.farbe}`}
              style={{ width: `${t.wert}%` }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Die sechs Lernpfad-Stufen aus §3. Immer alle sichtbar, überspringbar. */
const STUFEN = ["Vorschau", "Verstehen", "Festigen", "Anwenden", "Prüfen", "Nachber."] as const;

export function Lernpfad({ stufe }: { stufe: number }) {
  return (
    <ol className="flex gap-1" aria-label="Lernpfad">
      {STUFEN.map((s, i) => {
        const zustand = i < stufe ? "erledigt" : i === stufe ? "jetzt" : "offen";
        return (
          <li
            key={s}
            aria-current={zustand === "jetzt" ? "step" : undefined}
            className={`flex-1 rounded-md border px-0.5 py-1.5 text-center text-[0.625rem] font-semibold ${
              zustand === "erledigt"
                ? "bg-sicher-hell text-sicher border-transparent"
                : zustand === "jetzt"
                  ? "border-koenigsblau bg-koenigsblau-hell text-koenigsblau"
                  : "bg-papier-tief text-tinte-leise border-transparent"
            }`}
          >
            {s}
          </li>
        );
      })}
    </ol>
  );
}

/** Kontext-Chip „Fach › Thema" (§15). Steht immer über der Tutor-Eingabe. */
export function KontextChip({ fach, thema }: { fach: string; thema: string }) {
  return (
    <span className="bg-koenigsblau-hell text-koenigsblau inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[0.8125rem] font-medium">
      {fach}{" "}
      <span aria-hidden="true" className="opacity-55">
        ›
      </span>{" "}
      {thema}
    </span>
  );
}

export function Knopf({ children, leise = false }: { children: React.ReactNode; leise?: boolean }) {
  return (
    <button
      type="button"
      className={`focus-visible:outline-koenigsblau w-full rounded-[9px] border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
        leise
          ? "border-linie-stark text-tinte hover:bg-papier-tief bg-transparent"
          : "bg-koenigsblau text-auf-koenigsblau border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

/** Drei Stapel der Vokabel-Session (§6 M4). */
export function Stapel({ kann, uebe, nochmal }: { kann: number; uebe: number; nochmal: number }) {
  const teile = [
    { zahl: kann, name: "Kann ich", klasse: "bg-sicher-hell text-sicher" },
    { zahl: uebe, name: "Übe ich", klasse: "bg-koenigsblau-hell text-koenigsblau" },
    { zahl: nochmal, name: "Nochmal", klasse: "bg-offen-hell text-offen" },
  ];
  return (
    <div className="flex gap-1.5">
      {teile.map((t) => (
        <div
          key={t.name}
          className={`flex flex-1 flex-col gap-0.5 rounded-[7px] px-2 py-2.5 ${t.klasse}`}
        >
          <span className="text-lg leading-none font-semibold tabular-nums">{t.zahl}</span>
          <span className="text-[0.625rem] font-semibold">{t.name}</span>
        </div>
      ))}
    </div>
  );
}

export function Lesetext({ children }: { children: React.ReactNode }) {
  return <p className="font-lese text-tinte-weich text-[0.9375rem] leading-relaxed">{children}</p>;
}

export function Hinweis({ children }: { children: React.ReactNode }) {
  return <p className="text-tinte-weich text-[0.8125rem] leading-normal">{children}</p>;
}
