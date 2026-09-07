/**
 * Bausteine der Designsprache. Jeder trägt eine Konzeptentscheidung – sie
 * kommen nicht aus einem UI-Kit.
 */

export function PageHeader({ title, trailing }: { title: string; trailing?: string }) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {trailing ? <span className="text-tinte-leise text-xs">{trailing}</span> : null}
    </div>
  );
}

export function Block({
  title,
  trailing,
  emphasized = false,
  children,
}: {
  title?: string;
  trailing?: string;
  emphasized?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-2.5 rounded-[10px] border p-3.5 ${
        emphasized ? "border-koenigsblau bg-koenigsblau-hell" : "border-linie bg-papier"
      }`}
    >
      {title ? (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {trailing ? (
            <span className="text-tinte-leise text-xs tabular-nums">{trailing}</span>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Mastery ist nie eine Zahl, immer zwei (Konzept §6 M1). */
export function Mastery({ coverage, confidence }: { coverage: number; confidence: number }) {
  const items = [
    { value: coverage, label: "Abdeckung", color: "bg-koenigsblau" },
    { value: confidence, label: "Sicherheit", color: "bg-sicher" },
  ];
  return (
    <div className="flex gap-5">
      {items.map((item) => (
        <div key={item.label} className="flex flex-1 flex-col gap-1.5">
          <span className="text-2xl leading-none font-semibold tabular-nums">{item.value} %</span>
          <span className="text-tinte-leise text-[0.6875rem] font-semibold tracking-wider uppercase">
            {item.label}
          </span>
          <span className="bg-papier-tief h-1 overflow-hidden rounded-full">
            <span
              className={`block h-full rounded-full ${item.color}`}
              style={{ width: `${item.value}%` }}
            />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Die sechs Lernpfad-Stufen aus §3. Immer alle sichtbar, überspringbar. */
const STAGES = ["Vorschau", "Verstehen", "Festigen", "Anwenden", "Prüfen", "Nachber."] as const;

export function LearningPath({ stage }: { stage: number }) {
  return (
    <ol className="flex gap-1" aria-label="Lernpfad">
      {STAGES.map((s, i) => {
        const state = i < stage ? "done" : i === stage ? "current" : "open";
        return (
          <li
            key={s}
            aria-current={state === "current" ? "step" : undefined}
            className={`flex-1 rounded-md border px-0.5 py-1.5 text-center text-[0.625rem] font-semibold ${
              state === "done"
                ? "bg-sicher-hell text-sicher border-transparent"
                : state === "current"
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
export function ContextChip({ subject, topic }: { subject: string; topic: string }) {
  return (
    <span className="bg-koenigsblau-hell text-koenigsblau inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[0.8125rem] font-medium">
      {subject}{" "}
      <span aria-hidden="true" className="opacity-55">
        ›
      </span>{" "}
      {topic}
    </span>
  );
}

export function Button({
  children,
  quiet = false,
}: {
  children: React.ReactNode;
  quiet?: boolean;
}) {
  return (
    <button
      type="button"
      className={`focus-visible:outline-koenigsblau w-full rounded-[9px] border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
        quiet
          ? "border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief"
          : "bg-koenigsblau text-auf-koenigsblau border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

/** Drei Stapel der Vokabel-Session (§6 M4). */
export function Stack({
  confident,
  practicing,
  again,
}: {
  confident: number;
  practicing: number;
  again: number;
}) {
  const items = [
    { count: confident, name: "Kann ich", colorClass: "bg-sicher-hell text-sicher" },
    { count: practicing, name: "Übe ich", colorClass: "bg-koenigsblau-hell text-koenigsblau" },
    { count: again, name: "Nochmal", colorClass: "bg-offen-hell text-offen" },
  ];
  return (
    <div className="flex gap-1.5">
      {items.map((item) => (
        <div
          key={item.name}
          className={`flex flex-1 flex-col gap-0.5 rounded-[7px] px-2 py-2.5 ${item.colorClass}`}
        >
          <span className="text-lg leading-none font-semibold tabular-nums">{item.count}</span>
          <span className="text-[0.625rem] font-semibold">{item.name}</span>
        </div>
      ))}
    </div>
  );
}

export function ReadingText({ children }: { children: React.ReactNode }) {
  return <p className="font-lese text-tinte-weich text-[0.9375rem] leading-relaxed">{children}</p>;
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <p className="text-tinte-weich text-[0.8125rem] leading-normal">{children}</p>;
}
