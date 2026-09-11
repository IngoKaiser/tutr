/**
 * Bausteine der Designsprache. Jeder trägt eine Konzeptentscheidung – sie
 * kommen nicht aus einem UI-Kit.
 */

import Link from "next/link";

/**
 * Die Überschrift jeder Seite – und der einzige Weg eine Ebene höher.
 *
 * **Jede Seite unterhalb eines Fußleisten-Bereichs trägt einen `back`.** Die
 * Fußleiste kennt nur die fünf Bereiche und keine Tiefe darunter; ohne diesen
 * Link gäbe es aus einer Unterseite keinen Ausgang außer dem Umweg über die
 * Fußleiste. Dass die Regel hier steht und nicht in jedem Ticket neu bedacht
 * wird, ist Absicht: Sie ist zweimal vergessen worden.
 *
 * Ein echter Link auf die Elternseite, kein Browser-Zurück: In der
 * installierten PWA gibt es keine Browserleiste, und „zurück" landet dort, wo
 * man herkam, nicht dort, wo man hingehört. `label` benennt deshalb das Ziel
 * („Vokabelsets"), nicht die Richtung („Zurück").
 */
export function PageHeader({
  title,
  trailing,
  back,
}: {
  title: string;
  trailing?: string;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-4 flex flex-col gap-1">
      {back ? (
        <Link
          href={back.href}
          className="text-tinte-leise hover:text-koenigsblau -ml-1 inline-flex w-fit items-center gap-1 px-1 py-1.5 text-[0.8125rem] font-medium"
        >
          <span aria-hidden="true">‹</span>
          {back.label}
        </Link>
      ) : null}
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {trailing ? <span className="text-tinte-leise text-xs">{trailing}</span> : null}
      </div>
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

/**
 * Kontext-Chip „Fach › Thema" (§15). Steht immer über der Tutor-Eingabe.
 *
 * `topic` ist optional: Solange es keine Themen-Oberfläche gibt, kommt das
 * Thema laut §4a ohnehin daher, dass man aus einer Themenseite in den Tutor
 * geht – bis dahin zeigt der Chip nur das Fach. Ein Platzhalter wie „ohne
 * Thema" würde auf eine Lücke zeigen, statt Kontext zu geben.
 */
export function ContextChip({ subject, topic }: { subject: string; topic?: string | null }) {
  return (
    <span className="bg-koenigsblau-hell text-koenigsblau inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[0.8125rem] font-medium">
      {subject}
      {topic ? (
        <>
          <span aria-hidden="true" className="opacity-55">
            ›
          </span>
          {topic}
        </>
      ) : null}
    </span>
  );
}

export function Button({
  children,
  quiet = false,
  type = "button",
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  quiet?: boolean;
  /** "submit", wenn der Knopf in einem `<form onSubmit>` steht (V-02: Tippen-Eingabe). */
  type?: "button" | "submit";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`focus-visible:outline-koenigsblau w-full rounded-[9px] border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60 ${
        quiet
          ? "border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief"
          : "bg-koenigsblau text-auf-koenigsblau border-transparent"
      }`}
    >
      {children}
    </button>
  );
}

export type StapelTon = "sicher" | "koenigsblau" | "offen" | "leise";

const STAPEL_TON_KLASSE: Record<StapelTon, string> = {
  sicher: "bg-sicher-hell text-sicher",
  koenigsblau: "bg-koenigsblau-hell text-koenigsblau",
  offen: "bg-offen-hell text-offen",
  leise: "bg-papier-tief text-tinte-leise",
};

/**
 * Eine Reihe gleich breiter Zahlkacheln (§6 M4). Die Beschriftung kommt vom
 * Aufrufer: das Üben zeigt den Lernstand („Neu / Am Üben / Sitzt", V-08), der
 * Heute-Screen die Tagesbilanz.
 */
export function Stack({ items }: { items: { count: number; name: string; tone: StapelTon }[] }) {
  return (
    <div className="flex gap-1.5">
      {items.map((item) => (
        <div
          key={item.name}
          className={`flex flex-1 flex-col gap-0.5 rounded-[7px] px-2 py-2.5 ${STAPEL_TON_KLASSE[item.tone]}`}
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

/**
 * Eine Leiste „wie ausgelastet" (S-03d-Fortschrittsanzeige, Tutor/Einstellungen).
 *
 * Bewusst kein Prozent-Verlauf in Rot/Gelb/Grün: Das läse sich wie ein
 * Dringlichkeits-Element (CLAUDE.md verbietet solche ausdrücklich), dabei
 * ist das hier eine ruhige Information, keine Warnung – eine volle Leiste
 * bedeutet eine kurze Pause, nicht einen Fehler. Eine Farbe für jeden Stand.
 * Kein US-$-Betrag (`kostenUsd()` bleibt intern) – nur der Anteil am Deckel.
 */
export function Auslastungsbalken({
  anteil,
  label,
}: {
  /** 0–1, wie `lib/ai/rate-limit.ts` `Auslastung`. */
  anteil: number;
  label: string;
}) {
  const prozent = Math.round(Math.min(1, Math.max(0, anteil)) * 100);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-tinte-weich text-[0.75rem]">{label}</span>
        <span className="text-tinte-leise text-[0.6875rem] tabular-nums">{prozent} %</span>
      </div>
      <span
        role="img"
        aria-label={`${label}: ${prozent} % ausgelastet`}
        className="bg-papier-tief block h-1.5 overflow-hidden rounded-full"
      >
        <span
          className="bg-koenigsblau block h-full rounded-full"
          style={{ width: `${prozent}%` }}
        />
      </span>
    </div>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <p className="text-tinte-weich text-[0.8125rem] leading-normal">{children}</p>;
}
