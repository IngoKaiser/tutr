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
 * wird, ist Absicht: Sie ist zweimal vergessen worden – und ein drittes Mal
 * bei den Einstellungen, die gar kein Fußleisten-Bereich sind und trotzdem
 * lange ohne Ausgang dastanden (T-18).
 *
 * Ein echter Link auf die Elternseite, kein Browser-Zurück: In der
 * installierten PWA gibt es keine Browserleiste, und „zurück" landet dort, wo
 * man herkam, nicht dort, wo man hingehört. `label` benennt deshalb das Ziel
 * – und zwar **so, wie die Zielseite heißt** (T-18): „Vokabeln", nicht
 * „Vokabelsets", wenn die Seite oben „Vokabeln" stehen hat.
 *
 * `trailing` trägt den Kontext, zu dem die Seite gehört – meist das Fach.
 * Ein `ContextChip` gehört **nicht** hierher: Der ist den Chat-Ansichten
 * vorbehalten (`ChatKopf`), wo er das Fach nicht nur zeigt, sondern ändern
 * lässt.
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

/**
 * Die Kopfzeile der Chat-Ansichten (T-07b, zusammengeführt in T-18).
 *
 * **Warum die Chats nicht `PageHeader` benutzen:** Dort ist Höhe das knappste
 * Gut – über dem Verlauf steht sonst eine 2xl-Überschrift plus eigener
 * Rückweg-Zeile, und beides schiebt das Gespräch aus dem Bild. Diese Leiste
 * bringt Rückweg und Kontext in **eine** Zeile, klebt am oberen Rand des
 * Chat-Rahmens (`-mx-4 -mt-5`, dieselbe Rechnung wie beim Composer unten) und
 * scrollt nicht mit (T-12a).
 *
 * Bis T-18 stand sie zweimal fast gleich im Code – einmal im freien Chat,
 * einmal im Hausaufgaben-Dialog. Zwei Kopien derselben Leiste laufen
 * auseinander, sobald eine davon angefasst wird; genau das war passiert.
 *
 * Entweder `zurueck` (eine Ebene höher) oder `titel` (wenn es nichts gibt,
 * wohin man zurückginge – `/tutor` vor dem ersten Gespräch). `children` ist
 * der Platz für den Kontext-Chip daneben.
 */
export function ChatKopf({
  titel,
  zurueck,
  children,
}: {
  titel?: string;
  zurueck?: { href: string; label: string };
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-papier border-linie -mx-4 -mt-5 flex shrink-0 items-center gap-3 border-b px-4 py-2">
      {zurueck ? (
        <Link
          href={zurueck.href}
          className="text-tinte-leise hover:text-koenigsblau -ml-1 inline-flex shrink-0 items-center gap-1 px-1 py-1 text-[0.8125rem] font-medium"
        >
          <span aria-hidden="true">‹</span>
          {zurueck.label}
        </Link>
      ) : titel ? (
        <h1 className="text-lg font-semibold tracking-tight">{titel}</h1>
      ) : null}
      {children}
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
/**
 * Der Kontext-Chip „Fach › Thema" (§15).
 *
 * **Antippbar seit T-13 (ADR 0013 D4)**: Der Tutor startet ohne Fachwahl,
 * ordnet die erste Nachricht selbst zu – und ein Chip, der das Ergebnis nur
 * zeigt, hat keine Korrektur für eine falsche Zuordnung. `onClick` macht ihn
 * zum Knopf statt zur reinen Anzeige; ohne `onClick` (Hausaufgaben-Dialog,
 * der sein Fach von Anfang an kennt und nicht ändern lässt) bleibt er ein
 * `<span>` wie zuvor. `subject: null` heißt „noch nicht zugeordnet" und
 * zeigt „Fach wählen" statt eines Namens.
 */
export function ContextChip({
  subject,
  topic,
  onClick,
}: {
  subject: string | null;
  topic?: string | null;
  onClick?: () => void;
}) {
  const topicInhalt = topic ? (
    <>
      <span aria-hidden="true" className="opacity-55">
        ›
      </span>
      {topic}
    </>
  ) : null;
  const klassen =
    "bg-koenigsblau-hell text-koenigsblau inline-flex items-center gap-1.5 self-start rounded-full px-3 py-1.5 text-[0.8125rem] font-medium";

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={subject ? `Fach ${subject}, antippen zum Ändern` : "Fach wählen"}
        className={`${klassen} hover:bg-koenigsblau/15 transition-colors`}
      >
        {/* `subject` in einem eigenen `<span>`, nicht lose im `<button>`:
            Sonst gehört ein antippbarer Chip (mit dem `▾`-Pfeil daneben)
            textlich zu „Französisch ▾“ statt zu „Französisch“ – und ein
            Test, der genau den Fachnamen sucht
            (`getByText(name, { exact: true })`), fände nichts mehr. Die
            reine Anzeige unten braucht das nicht: Ohne Geschwistertext
            bleibt ihr eigener Text schon exakt der Fachname. */}
        <span>{subject ?? "Fach wählen"}</span>
        {topicInhalt}
        <span aria-hidden="true" className="opacity-55">
          ▾
        </span>
      </button>
    );
  }
  return (
    <span className={klassen}>
      {subject ?? "Fach wählen"}
      {topicInhalt}
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

/**
 * Ein Link, der aussieht wie ein `Button` (H-01).
 *
 * Auf „Heute" führt jede Handlung woandershin – üben, Termine, Hausaufgabe
 * fotografieren. Das ist Navigation, kein Klick-Handler: Ein `<a>` kann man
 * in einem neuen Tab öffnen, ein `<button onClick={router.push}>` nicht, und
 * ohne JavaScript funktioniert er auch. Gleiche Optik wie `Button`, damit
 * nicht auffällt, dass zwei verschiedene Elemente dahinterstecken.
 */
export function LinkButton({
  href,
  quiet = false,
  children,
}: {
  href: string;
  quiet?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`focus-visible:outline-koenigsblau block w-full rounded-[9px] border px-4 py-2.5 text-center text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
        quiet
          ? "border-linie-stark bg-flaeche text-tinte hover:bg-papier-tief"
          : "bg-koenigsblau text-auf-koenigsblau border-transparent"
      }`}
    >
      {children}
    </Link>
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
