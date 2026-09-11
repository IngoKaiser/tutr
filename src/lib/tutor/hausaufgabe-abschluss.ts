import { sql } from "drizzle-orm";

import { erzeugeHausaufgabenHinweis } from "@/ai/client";
import { withActor, type Actor } from "@/db/actor";
import { bucheNutzung, ergaenzeTokenzahl, pruefeUndZaehle } from "@/lib/ai/rate-limit";

import { bilanziere, zweizeiler } from "./hausaufgabe-zusammenfassung";

/**
 * Schreibt den Zweizeiler, sobald jede Aufgabe einer Hausaufgaben-Session
 * abgeschlossen ist (T-03 PR 2, §4a „Ansicht").
 *
 * **Aufgerufen von zwei Stellen**, beide nach einer Zustandsänderung, die
 * eine Aufgabe abschließen kann: `POST /api/tutor` nach einem
 * `versuch_pruefen`- oder `loesung_zeigen`-Zug (`route.ts`
 * `schreibeHausaufgabenZug()`) und `ueberspringeAufgabe()`
 * (`app/(app)/tutor/hausaufgabe/actions.ts`). Deshalb hier und nicht in
 * einer der beiden Dateien – eine Server Action kann keine Funktion
 * exportieren, die ein Route Handler importiert, ohne selbst zur Server
 * Action zu werden.
 *
 * **Zwei Transaktionen, kein Modellaufruf dazwischen offen** (dasselbe
 * Muster wie `klassifiziereVersuch()` in `route.ts`): Die erste liest nur
 * und entscheidet, ob überhaupt etwas zu tun ist; der Sonnet-Aufruf läuft
 * außerhalb jeder Transaktion; die zweite schreibt das Ergebnis. Eine
 * offene Transaktion über die Dauer eines Netzwerkaufrufs hinweg hielte eine
 * Postgres-Verbindung unnötig lange fest.
 *
 * Läuft leise durch, wenn noch nicht alle Aufgaben fertig sind, schon eine
 * Zusammenfassung existiert, oder der Kostendeckel gerade zu ist – keiner
 * dieser Fälle ist ein Fehler, den die aufrufende Stelle behandeln müsste.
 */
export async function pruefeUndErzeugeAbschluss(actor: Actor, sessionId: string): Promise<void> {
  const arbeit = await withActor(actor, async (tx) => {
    // `left join`, nicht `join`: eine Hausaufgabe ohne Fach (ADR 0013 D7 –
    // die Zuordnung aus dem Foto ergab „unklar") hat kein `subject_id`.
    const rows = await tx.execute<{
      label: string | null;
      prompt: string;
      status: "offen" | "in_arbeit" | "geloest" | "loesung_gezeigt" | "uebersprungen";
      subject_name: string | null;
    }>(sql`
      select ht.label, ht.prompt, ht.status, s.name as subject_name
      from homework_task ht
      join tutor_session ts on ts.id = ht.session_id
      left join subject s on s.id = ts.subject_id
      where ht.session_id = ${sessionId}
      order by ht.position`);
    if (rows.length === 0) return null;

    const offen = rows.some((r) => r.status === "offen" || r.status === "in_arbeit");
    if (offen) return null;

    const [vorhanden] = await tx.execute<{ id: string }>(
      sql`select id from tutor_session_summary where session_id = ${sessionId}`,
    );
    if (vorhanden) return null;

    const limit = await pruefeUndZaehle(tx, "tutor");
    if (!limit.erlaubt) return null;

    return {
      subjectName: rows[0]!.subject_name,
      aufgaben: rows.map((r) => ({
        label: r.label ?? "",
        prompt: r.prompt,
        status: r.status as "geloest" | "loesung_gezeigt" | "uebersprungen",
      })),
    };
  });
  if (!arbeit) return;

  const bilanz = bilanziere(arbeit.aufgaben);
  let hinweis = "Weiter so";
  let inputTokens = 0;
  let outputTokens = 0;
  try {
    const ergebnis = await erzeugeHausaufgabenHinweis(arbeit);
    hinweis = ergebnis.hinweis;
    inputTokens = ergebnis.inputTokens;
    outputTokens = ergebnis.outputTokens;
  } catch {
    // Der Hinweis-Halbsatz ist ausgefallen (Netzwerk, Timeout) – die Bilanz
    // steht trotzdem, mit einem neutralen Schlusssatz statt gar keinem
    // Zweizeiler. Anders als bei `klassifiziereVersuch()` gibt es hier
    // keinen „konservativen" Fall zu wahren: Die Zahlen sind schon aus dem
    // Zustand bekannt, nur der Halbsatz danach fehlt.
  }
  const text = zweizeiler(bilanz, hinweis);

  await withActor(actor, async (tx) => {
    // `on conflict do nothing`: Ein zweiter, parallel gestarteter Aufruf
    // (Route Handler und `ueberspringeAufgabe()` könnten theoretisch
    // gleichzeitig auf dieselbe letzte Aufgabe treffen) schreibt sonst zwei
    // Zeilen gegen den `unique`-Schlüssel und scheitert unnötig.
    await tx.execute(sql`
      insert into tutor_session_summary (student_id, session_id, summary)
      values (app.student_id(), ${sessionId}, ${text})
      on conflict (session_id) do nothing`);
    const usageId = await bucheNutzung(tx, "tutor");
    await ergaenzeTokenzahl(tx, usageId, inputTokens, outputTokens);
  });
}
