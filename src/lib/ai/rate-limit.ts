import { sql } from "drizzle-orm";

import type { Transaction } from "@/db/actor";

/**
 * Kostendeckel für KI-Endpunkte (S-03b, ADR 0010 D4; in echtes Geld übersetzt
 * mit S-03c).
 *
 * Ab dem ersten Tutor-Klick löst jede Frage einen bezahlten Modellaufruf aus.
 * Ohne Deckel ist ein festhängender Client oder ein gelangweilter Nachmittag
 * teurer als der gesamte übrige Betrieb.
 *
 * Der Zähler ist eine Zeile je Aufruf in `ai_usage` und die Prüfung eine
 * `sum(...)`-Abfrage über ein gleitendes Fenster – kein Redis, keine neue
 * Abhängigkeit (ADR 0010 D4, „Abgelehnte Alternativen").
 *
 * **Warum echtes Geld statt Anfragenzahl (S-03c):** Eine gezählte Anfrage
 * sagt nichts über ihre Kosten – ein kurzes „Ja, genau" und eine lange
 * Herleitung mit fünf Absätzen Verlauf schlugen bisher gleich zu Buche. Der
 * eigentliche Schutz soll das Geld begrenzen, nicht die Klicks.
 *
 * Drei Fenster, jedes mit derselben Rolle wie vorher, nur in US-$ statt in
 * Anfragen (grobe Näherung 1 $ ≈ 1 € – für einen Sicherheitsdeckel reicht
 * das; wichtig ist die Größenordnung, nicht die dritte Nachkommastelle):
 * - **Stunde** fängt eine Endlosschleife ab, schnell und eng.
 * - **Tag** ist der Alltagsdeckel, deutlich über typischer Nutzung.
 * - **Woche** ist neu (S-03c) und fällt mit `AUFBEWAHRUNG_TAGE` zusammen:
 *   Weil Zeilen ohnehin nach 7 Tagen gelöscht werden, *ist* die ungefilterte
 *   Summe über alle verbliebenen Zeilen schon die Wochensumme – kein
 *   zusätzliches `filter` nötig.
 */

/**
 * Sonnet-5-Preise je Token, in US-$ (Stand September 2026, ohne Prompt
 * Caching – der Tutor cacht heute nicht). Ausgabe-Tokens kosten fünfmal so
 * viel wie Eingabe-Tokens; eine einzelne addierte Zahl (wie vor S-03c)
 * ließe sich nicht mehr in Geld zurückrechnen, deshalb trennt `ai_usage`
 * seit S-03c `input_tokens`/`output_tokens`.
 */
const USD_JE_INPUT_TOKEN = 2 / 1_000_000;
const USD_JE_OUTPUT_TOKEN = 10 / 1_000_000;

/**
 * Websuche-Tool der Claude API (L-01, „Claude sucht das Lehrwerk"): 0,01 $ je
 * Suche, **zusätzlich** zu den Tokens der Antwort – Anthropics eigene Angabe
 * ist 10 $ je 1000 Suchen. Ohne diesen Posten würde `ai_usage` echte Kosten
 * stumm unterzählen, sobald ein Aufruf das Tool nutzt.
 */
const USD_JE_SUCHANFRAGE = 10 / 1000;

/**
 * Kosten eines oder mehrerer Aufrufe in US-$. Rein und ungerundet – eine
 * Schätzung für einen Deckel, keine Abrechnung auf den Cent. `searchRequests`
 * ist 0 für alle Endpunkte ohne Websuche-Tool (Standardwert).
 */
export function kostenUsd(inputTokens: number, outputTokens: number, searchRequests = 0): number {
  return (
    inputTokens * USD_JE_INPUT_TOKEN +
    outputTokens * USD_JE_OUTPUT_TOKEN +
    searchRequests * USD_JE_SUCHANFRAGE
  );
}

/**
 * Die drei Deckel in US-$. Hergeleitet aus der vorherigen Zählung
 * (20/Stunde, 60/Tag bei ~1,1 ct je Tutor-Antwort) und probehalber auf
 * Rundzahlen gebracht statt auf die exakt selbe Schwelle – die alte Zahl war
 * selbst schon eine Schätzung:
 * - Stunde: vorher ~22 ct Worst Case → 0,30 $.
 * - Tag: vorher ~66 ct Worst Case → 1,00 $, spürbar über dem realistischen
 *   Alltag (~44 ct bei den ~40 Antworten/Tag aus Konzept §11).
 * - Woche: neu. Ein Tag am Deckel, jeden Tag der Woche, wäre 7,00 $ – 5,00 $
 *   liegt darunter und wirkt damit auch bei durchgehend hoher, aber nicht
 *   verdächtiger Nutzung, ohne im Alltag spürbar zu werden.
 */
export const AI_LIMITS = {
  stundeUsd: 0.3,
  tagUsd: 1.0,
  wocheUsd: 5.0,
} as const;

/** Wie lange `ai_usage`-Zeilen aufbewahrt werden – zugleich die Breite des Wochenfensters (siehe oben). */
const AUFBEWAHRUNG_TAGE = 7;

export type LimitEntscheidung = { erlaubt: true } | { erlaubt: false; nachricht: string };

/**
 * Reine Entscheidung aus drei Kostenständen (in US-$) – der testbare Kern.
 *
 * Die Nachricht sagt, **wann es weitergeht**, nicht „Rate limit exceeded":
 * Der Deckel ist ein Kostenschutz, kein pädagogisches Mittel, und darf nicht
 * wie eine Strafe klingen. Geprüft wird vom größten Fenster zum kleinsten –
 * ist die Woche schon aufgebraucht, wäre „in einer Stunde geht's weiter"
 * eine falsche Zusage.
 */
export function pruefeLimit(kosten: {
  stundeUsd: number;
  tagUsd: number;
  wocheUsd: number;
}): LimitEntscheidung {
  if (kosten.wocheUsd >= AI_LIMITS.wocheUsd) {
    return {
      erlaubt: false,
      nachricht:
        "Für diese Woche ist beim Tutor erstmal Schluss – nächste Woche geht's weiter. Deine Vokabeln und Karten gehen weiter.",
    };
  }
  if (kosten.tagUsd >= AI_LIMITS.tagUsd) {
    return {
      erlaubt: false,
      nachricht:
        "Für heute ist genug gefragt – der Tutor macht bis morgen Pause. Deine Vokabeln und Karten gehen weiter.",
    };
  }
  if (kosten.stundeUsd >= AI_LIMITS.stundeUsd) {
    return {
      erlaubt: false,
      nachricht:
        "Kurze Pause: In der nächsten Stunde geht es wieder. So lange kannst du üben oder lesen.",
    };
  }
  return { erlaubt: true };
}

export type Fensterkosten = { stundeUsd: number; tagUsd: number; wocheUsd: number };

/**
 * Liest die Kosten des Kindes im Actor-Kontext von `tx` für einen Endpunkt,
 * über alle drei Fenster. Reiner Lesezugriff – räumt nichts auf, entscheidet
 * nichts; das macht `pruefeUndZaehle()` bzw. `pruefeLimit()` daraus.
 *
 * Eine Zeile ohne `input_tokens`/`output_tokens` (Aufruf vor der Antwort
 * abgebrochen) zählt mit `sum(...)` automatisch als 0 $ – eine bekannte,
 * kleine Lücke: Ein abgebrochener Stream hat schon etwas gekostet, nur weiß
 * diese Zeile nicht, wie viel. Für einen Sicherheitsdeckel unkritisch,
 * solange Abbrüche die Ausnahme bleiben.
 *
 * Das Wochenfenster trägt hier (anders als in der ursprünglichen Fassung)
 * einen eigenen Zeitfilter, statt sich auf das Aufräumen in
 * `pruefeUndZaehle()` zu verlassen: `ladeGesamtauslastung()` liest, ohne
 * vorher aufzuräumen (ein Modellaufruf gehört nicht in eine reine
 * Anzeige-Abfrage) – ohne eigenen Filter zählte eine Zeile, die die
 * siebentägige Aufbewahrung längst überschritten hat, aber noch nicht
 * gelöscht wurde, fälschlich zur Woche mit.
 */
async function leseKosten(tx: Transaction, endpoint: "tutor" | "vision"): Promise<Fensterkosten> {
  const [row] = await tx.execute<{
    eingabe_stunde: string;
    ausgabe_stunde: string;
    suche_stunde: string;
    eingabe_tag: string;
    ausgabe_tag: string;
    suche_tag: string;
    eingabe_woche: string;
    ausgabe_woche: string;
    suche_woche: string;
  }>(sql`
    select
      coalesce(sum(input_tokens)    filter (where created_at > now() - interval '1 hour'), 0)::text as eingabe_stunde,
      coalesce(sum(output_tokens)   filter (where created_at > now() - interval '1 hour'), 0)::text as ausgabe_stunde,
      coalesce(sum(search_requests) filter (where created_at > now() - interval '1 hour'), 0)::text as suche_stunde,
      coalesce(sum(input_tokens)    filter (where created_at > now() - interval '1 day'), 0)::text  as eingabe_tag,
      coalesce(sum(output_tokens)   filter (where created_at > now() - interval '1 day'), 0)::text  as ausgabe_tag,
      coalesce(sum(search_requests) filter (where created_at > now() - interval '1 day'), 0)::text  as suche_tag,
      coalesce(sum(input_tokens)    filter (where created_at > now() - make_interval(days => ${AUFBEWAHRUNG_TAGE})), 0)::text as eingabe_woche,
      coalesce(sum(output_tokens)   filter (where created_at > now() - make_interval(days => ${AUFBEWAHRUNG_TAGE})), 0)::text as ausgabe_woche,
      coalesce(sum(search_requests) filter (where created_at > now() - make_interval(days => ${AUFBEWAHRUNG_TAGE})), 0)::text as suche_woche
    from ai_usage
    where student_id = app.student_id() and endpoint = ${endpoint}`);

  return {
    stundeUsd: kostenUsd(
      Number(row?.eingabe_stunde ?? 0),
      Number(row?.ausgabe_stunde ?? 0),
      Number(row?.suche_stunde ?? 0),
    ),
    tagUsd: kostenUsd(
      Number(row?.eingabe_tag ?? 0),
      Number(row?.ausgabe_tag ?? 0),
      Number(row?.suche_tag ?? 0),
    ),
    wocheUsd: kostenUsd(
      Number(row?.eingabe_woche ?? 0),
      Number(row?.ausgabe_woche ?? 0),
      Number(row?.suche_woche ?? 0),
    ),
  };
}

/**
 * Zählt die Kosten des Kindes im Actor-Kontext von `tx` und entscheidet.
 * Räumt dabei alte Zeilen weg. Muss **vor** dem Modellaufruf laufen.
 */
export async function pruefeUndZaehle(
  tx: Transaction,
  endpoint: "tutor" | "vision",
): Promise<LimitEntscheidung> {
  await tx.execute(
    sql`delete from ai_usage where created_at < now() - make_interval(days => ${AUFBEWAHRUNG_TAGE})`,
  );
  return pruefeLimit(await leseKosten(tx, endpoint));
}

/** Bucht einen Aufruf. Nach dem Streamende `ergaenzeTokenzahl()` aufrufen, um Ein-/Ausgabe nachzutragen. */
export async function bucheNutzung(tx: Transaction, endpoint: "tutor" | "vision"): Promise<string> {
  const [row] = await tx.execute<{ id: string }>(sql`
    insert into ai_usage (student_id, endpoint)
    values (app.student_id(), ${endpoint})
    returning id`);
  return row!.id;
}

/**
 * Trägt Ein- und Ausgabe-Tokens nach, sobald der Aufruf fertig ist.
 * `searchRequests` (Standard 0) ist nur bei einem Aufruf mit Websuche-Tool
 * ungleich null (L-01, „Claude sucht das Lehrwerk") – für alle anderen
 * Endpunkte bleibt die Spalte auf ihrem Default.
 */
export async function ergaenzeTokenzahl(
  tx: Transaction,
  usageId: string,
  inputTokens: number,
  outputTokens: number,
  searchRequests = 0,
): Promise<void> {
  await tx.execute(
    sql`update ai_usage
        set input_tokens = ${inputTokens}, output_tokens = ${outputTokens},
            search_requests = ${searchRequests}
        where id = ${usageId}`,
  );
}

// --- Fortschrittsanzeige ---------------------------------------------------
// Freigegeben fürs Kind, keine Elternsicht (dieselbe Richtung wie
// `tutor_session`/`homework_task`): Kosten hängen direkt an der eigenen
// Nutzungsintensität. Bewusst **ohne** US-$-Beträge in der Oberfläche – nur
// die Auslastung je Fenster, als Anteil 0–1. Das ist der Punkt, an dem sich
// diese Anzeige von einem Kontostand unterscheidet: Es geht darum, ob gleich
// eine Pause ansteht, nicht darum, wie viel „übrig" ist.

/** Auslastung je Fenster, als Anteil 0–1 (gedeckelt – mehr als „voll" gibt es nicht). */
export type Auslastung = { stunde: number; tag: number; woche: number };

/** Reine Umrechnung Kosten → Anteil am jeweiligen Deckel (`AI_LIMITS`). */
export function auslastungAusKosten(kosten: Fensterkosten): Auslastung {
  return {
    stunde: Math.min(1, kosten.stundeUsd / AI_LIMITS.stundeUsd),
    tag: Math.min(1, kosten.tagUsd / AI_LIMITS.tagUsd),
    woche: Math.min(1, kosten.wocheUsd / AI_LIMITS.wocheUsd),
  };
}

/**
 * Der ungünstigere der beiden Werte je Fenster.
 *
 * `tutor` und `vision` haben **eigene**, unabhängige Deckel (`pruefeUndZaehle()`
 * prüft je Endpunkt) – wer diese Stunde schon viele Fotos eingelesen hat,
 * kann trotzdem noch mit dem Tutor schreiben, und umgekehrt. Eine einzelne
 * Zahl für „die Auslastung" gibt es deshalb streng genommen nicht; das
 * Maximum ist trotzdem die ehrliche Vereinfachung dafür, weil genau der
 * Kanal, der zuerst voll ist, auch zuerst pausiert.
 */
export function kombiniereAuslastung(a: Auslastung, b: Auslastung): Auslastung {
  return {
    stunde: Math.max(a.stunde, b.stunde),
    tag: Math.max(a.tag, b.tag),
    woche: Math.max(a.woche, b.woche),
  };
}

/**
 * Die Auslastung über beide Endpunkte für die Anzeige (Tutor-Übersicht,
 * Einstellungen). Reiner Lesezugriff, kein Aufräumen, kein Entscheid – das
 * Blockieren selbst bleibt `pruefeUndZaehle()` vorbehalten, das **vor** dem
 * Modellaufruf läuft. Zwei Abfragen statt einer größeren mit Spalten je
 * Endpunkt: leichter zu lesen, und diese Funktion läuft nur beim Aufrufen
 * einer Seite, nicht im heißen Pfad eines Modellaufrufs.
 */
export async function ladeGesamtauslastung(tx: Transaction): Promise<Auslastung> {
  const tutor = await leseKosten(tx, "tutor");
  const vision = await leseKosten(tx, "vision");
  return kombiniereAuslastung(auslastungAusKosten(tutor), auslastungAusKosten(vision));
}

/**
 * Die Fenster, die der Oberfläche etwas sagen (S-03e).
 *
 * **Die Stunde ist bewusst nicht dabei**, obwohl `pruefeLimit()` sie
 * weiterhin prüft: Sie ist ein technischer Schutz gegen eine festhängende
 * Schleife, kein Zeitraum, in dem jemand plant. Handlungsleitend sind
 * **heute** („reicht es noch für die Hausaufgaben?") und **diese Woche**
 * (Montag bis Freitag, der Horizont, in dem eine Schulwoche gedacht wird).
 * Greift der Stundendeckel doch einmal, sagt die Meldung von
 * `pruefeLimit()` ohnehin, dass es in der nächsten Stunde weitergeht – eine
 * Dauer-Anzeige dafür bräuchte es selbst dann nicht.
 */
export type Fenster = "tag" | "woche";

/** Deutsches Label je Fenster – eine Stelle, damit Composer und Einstellungen dasselbe Wort benutzen. */
export const FENSTER_LABEL: Record<Fenster, string> = {
  tag: "Heute",
  woche: "Diese Woche",
};

/**
 * Das straffere der beiden sichtbaren Fenster – für den Pegel im Composer,
 * der nur eine Zahl zeigt statt beider. Bei Gleichstand gewinnt der Tag: Er
 * füllt sich schneller wieder auf und ist damit die aktuellere Auskunft.
 */
export function anzeigeFenster(auslastung: Auslastung): { fenster: Fenster; anteil: number } {
  return auslastung.tag >= auslastung.woche
    ? { fenster: "tag", anteil: auslastung.tag }
    : { fenster: "woche", anteil: auslastung.woche };
}
