import { sql } from "drizzle-orm";

import {
  klassifiziereVersuch,
  ordneFachZu,
  streamTutorReply,
  type InlineImage,
  type TutorTurn,
} from "@/ai/client";
import { hausaufgabeSystemPrompt } from "@/ai/prompts/hausaufgabe";
import { tutorSystemPrompt } from "@/ai/prompts/tutor";
import { withActor, type Actor, type Transaction } from "@/db/actor";
import { loginStatus } from "@/lib/auth/actor";
import { bucheNutzung, ergaenzeTokenzahl, pruefeUndZaehle } from "@/lib/ai/rate-limit";
import { anthropicConfigured, databaseConfigured } from "@/lib/env";
import { loeseFachZuordnungAuf, type FachOption } from "@/lib/tutor/fach-zuordnung";
import { pruefeUndErzeugeAbschluss } from "@/lib/tutor/hausaufgabe-abschluss";
import { istDeutsch } from "@/lib/tutor/language-guard";
import {
  folgeZustand,
  istAbgeschlossen,
  naechsterZug,
  zustandNachVersuchUrteil,
  type AufgabenZustand,
  type Bahn,
  type Zug,
} from "@/lib/tutor/hint-ladder";

/**
 * Der einzige streamende Endpunkt im Projekt (T-02, ADR 0010 D1).
 *
 * Route Handler statt Server Action, weil eine Server Action einen Wert
 * zurückgibt und keine `Response` – und damit keinen Stream. Die Abweichung
 * von der Stack-Regel (CLAUDE.md) gilt **nur** hier; alles andere am Tutor
 * (laden, löschen) bleibt Server Action.
 *
 * Was eine Server Action geschenkt bekommt, steht hier von Hand:
 * `loginStatus()` für den Actor, die Rollenprüfung (403 für Eltern, nicht
 * bloß eine leere Liste), der Rate-Limit-Check **vor** dem Modellaufruf.
 *
 * Reihenfolge des Schreibens (ADR 0010 D1):
 * 1. Session anlegen, falls neu.
 * 2. Nutzernachricht schreiben – **vor** dem Modellaufruf. Bricht der Stream
 *    ab, steht die Frage trotzdem im Verlauf.
 * 3. Streamen.
 * 4. Antwort nach dem Stream als eine Zeile schreiben, mit Tokenzahl und
 *    dem Sprachwächter-Urteil. Ein abgebrochener Stream hinterlässt eine
 *    Frage ohne Antwort – ein ehrlicher Zustand.
 */

const EINSTIEGE = new Set(["freie_frage", "verstehen"]);
const BILDTYPEN = new Set(["image/jpeg", "image/png", "image/webp"]);

type Eingang = {
  sessionId: string | null;
  subjectId: string | null;
  entryPoint: string;
  message: string;
  /** Gesetzt heißt: dieser Zug gehört zu einer Hausaufgabe (T-03 PR 2). */
  taskId: string | null;
  /** Nur bei `taskId` von Bedeutung – welche der zwei Bahnen aus §4a. */
  bahn: Bahn;
  /** „Zeig mir die Lösung" ausdrücklich verlangt (nur mit `taskId`). */
  loesungVerlangt: boolean;
  /** Foto des Lösungswegs – zählt immer als Versuch (§4a Schritt 2). */
  image: InlineImage | null;
};

function liesEingang(body: unknown): Eingang | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const message = typeof b.message === "string" ? b.message.trim() : "";

  const bildRoh = b.image;
  let image: InlineImage | null = null;
  if (typeof bildRoh === "object" && bildRoh !== null) {
    const r = bildRoh as Record<string, unknown>;
    if (
      typeof r.base64 === "string" &&
      r.base64.length > 0 &&
      typeof r.mediaType === "string" &&
      BILDTYPEN.has(r.mediaType)
    ) {
      image = { base64: r.base64, mediaType: r.mediaType as InlineImage["mediaType"] };
    }
  }

  // Ein Foto allein ist eine gültige Eingabe (§4a: „Foto ihres Lösungswegs
  // oder tippt das Ergebnis") – nur „gar nichts" wird abgelehnt.
  if ((message.length === 0 && !image) || message.length > 4000) return null;

  return {
    sessionId: typeof b.sessionId === "string" && b.sessionId.length > 0 ? b.sessionId : null,
    subjectId: typeof b.subjectId === "string" && b.subjectId.length > 0 ? b.subjectId : null,
    entryPoint: typeof b.entryPoint === "string" ? b.entryPoint : "freie_frage",
    message,
    taskId: typeof b.taskId === "string" && b.taskId.length > 0 ? b.taskId : null,
    bahn: b.bahn === "verstehen" ? "verstehen" : "versuch",
    loesungVerlangt: b.loesungVerlangt === true,
    image,
  };
}

/** Titel aus der ersten Frage kürzen (ADR 0010, „Konsequenzen"). */
function kuerzeTitel(text: string): string {
  const eine = text.replace(/\s+/g, " ").trim();
  return eine.length <= 60 ? eine : `${eine.slice(0, 57)}…`;
}

function textAntwort(inhalt: string, status: number): Response {
  return new Response(inhalt, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

type Vorarbeit =
  | { ok: false; status: number; nachricht: string }
  | {
      ok: true;
      sessionId: string;
      system: string;
      verlauf: TutorTurn[];
      usageId: string;
      /**
       * Tokens der Fach-Zuordnung (T-13, ADR 0013 D2), die zusammen mit der
       * Streaming-Antwort in `ai_usage` gebucht werden – derselbe Kniff wie
       * bei `klassifiziereVersuch()` unten: eine Zeile, ein Zug, aber zwei
       * Modellaufrufe. `tutor_message.token_count` bekommt nur die
       * Streaming-Tokens, `ai_usage` beide zusammen. `null`, wenn keine
       * Zuordnung nötig war (bestehendes Gespräch, explizite Fachwahl, keine
       * Fächer vorhanden, oder die Zuordnung selbst ist ausgefallen).
       */
      zuordnungTokens: { input: number; output: number } | null;
      /** Nur bei einem Hausaufgaben-Zug gesetzt (T-03 PR 2) – steuert das Schreiben nach dem Stream. */
      hausaufgabe: {
        taskId: string;
        sessionId: string;
        aufgabe: string;
        zug: Zug;
        zustandVorher: AufgabenZustand;
      } | null;
    };

export async function POST(request: Request): Promise<Response> {
  if (!databaseConfigured() || !anthropicConfigured()) {
    return textAntwort("Der Tutor ist gerade nicht verfügbar.", 503);
  }

  const { actor } = await loginStatus();
  if (!actor || actor.role !== "student") {
    // 403, nicht bloß eine leere Antwort: Für den Tutor gibt es keine
    // Elternsicht (ADR 0010 D2), und das soll sichtbar so sein.
    return textAntwort("Den Tutor nutzt die Schülerin selbst.", 403);
  }

  const eingang = liesEingang(await request.json().catch(() => null));
  if (!eingang) {
    return textAntwort("Die Frage fehlt oder ist zu lang.", 400);
  }

  const vor = await bereiteVor(actor, eingang);
  if (!vor.ok) {
    return textAntwort(vor.nachricht, vor.status);
  }

  const stream = streamTutorReply(vor.system, [
    ...vor.verlauf,
    { role: "user", content: eingang.message, image: eingang.image ?? undefined },
  ]);

  const encoder = new TextEncoder();
  let volltext = "";

  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      stream.on("text", (delta) => {
        volltext += delta;
        controller.enqueue(encoder.encode(delta));
      });

      stream
        .finalMessage()
        .then(async (final) => {
          // `tutor_message.token_count` bleibt die addierte Zahl – ein
          // Anzeigewert je Nachricht, keine Abrechnungsgrundlage. Der
          // Kostendeckel in `ai_usage` braucht seit S-03c beide Zahlen
          // getrennt, weil Ausgabe-Tokens fünfmal so teuer sind.
          const tokens = final.usage.input_tokens + final.usage.output_tokens;
          const deutsch = istDeutsch(volltext);

          if (vor.hausaufgabe) {
            await schreibeHausaufgabenZug(
              actor,
              vor.hausaufgabe,
              vor.usageId,
              volltext,
              final.usage,
            );
          } else {
            // ADR 0013 D2: Fiel bei der ersten Nachricht dieses Gesprächs
            // eine Fach-Zuordnung an, zählt sie in `ai_usage` mit – aber
            // nicht in `tutor_message.token_count`, das bleibt der reine
            // Verbrauch der Antwort selbst.
            const eingabeGesamt = final.usage.input_tokens + (vor.zuordnungTokens?.input ?? 0);
            const ausgabeGesamt = final.usage.output_tokens + (vor.zuordnungTokens?.output ?? 0);
            await withActor(actor, async (tx) => {
              await tx.execute(sql`
                insert into tutor_message (student_id, session_id, role, content, token_count, language_ok)
                values (app.student_id(), ${vor.sessionId}, 'tutor', ${volltext}, ${tokens}, ${deutsch})`);
              await ergaenzeTokenzahl(tx, vor.usageId, eingabeGesamt, ausgabeGesamt);
              await tx.execute(
                sql`update tutor_session set updated_at = now() where id = ${vor.sessionId}`,
              );
            });
          }
          controller.close();
        })
        .catch((fehler: unknown) => {
          // Die Nutzernachricht steht schon; ohne Antwortzeile zeigt die
          // Oberfläche das Gespräch als abgebrochen.
          controller.error(fehler);
        });
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-tutor-session": vor.sessionId,
    },
  });
}

/** Die Fächer des Kindes im aktuellen Schuljahr – die Auswahl für die Fach-Zuordnung (ADR 0013 D2). */
async function ladeFaecherFuerZuordnung(tx: Transaction): Promise<FachOption[]> {
  return tx.execute<FachOption>(sql`
    select s.id, s.name, s.language from subject s
    join school_year_subject sys on sys.subject_id = s.id
    join school_year sy on sy.id = sys.school_year_id and sy.status = 'aktiv'`);
}

/**
 * Schritte 1 und 2 in einer Transaktion: Limit prüfen, Session auflösen
 * oder anlegen, bisherige Nachrichten laden, Nutzernachricht schreiben,
 * Nutzung buchen. Gibt alles zurück, was das Streamen danach braucht.
 *
 * Zweigt bei `eingang.taskId` in den Hausaufgaben-Weg ab (T-03 PR 2) –
 * eigener Systemprompt aus dem `Zug`, Verlauf nur der einen Aufgabe, kein
 * `subjectId`/`entryPoint` aus der Anfrage (die Aufgabe kennt ihr Fach
 * schon über ihre Session).
 *
 * **ADR 0013 D1/D2:** Ein neues Gespräch ohne mitgeschicktes Fach löst vor
 * der eigentlichen Transaktion eine Fach-Zuordnung aus – ein Modellaufruf
 * gehört nicht in eine offen gehaltene Transaktion (dasselbe Muster wie bei
 * `fotoZuAufgaben()`, `hausaufgabe/actions.ts`). Deshalb zwei kurze
 * `withActor()`-Aufrufe statt einem: erst Limit prüfen und Fächer laden,
 * dann – außerhalb jeder Transaktion – die Zuordnung, dann die eigentliche
 * Transaktion mit dem Ergebnis. Eine explizite Fachwahl (`eingang.subjectId`,
 * der Übergangspfad, solange die Oberfläche ihn noch anbietet) oder ein
 * bestehendes Gespräch brauchen das nicht und bleiben bei der einen
 * Transaktion wie zuvor.
 */
async function bereiteVor(actor: Actor, eingang: Eingang): Promise<Vorarbeit> {
  if (eingang.taskId) {
    return bereiteHausaufgabeVor(actor, eingang.taskId, eingang);
  }

  let zuordnung: FachOption | null = null;
  let zuordnungTokens: { input: number; output: number } | null = null;

  if (!eingang.sessionId && !eingang.subjectId) {
    // Limit **vor** dem Zuordnungsaufruf prüfen (wie vor jedem
    // Modellaufruf) – die Zuordnung selbst ist schon ein bezahlter Aufruf.
    // Die eigentliche Transaktion unten prüft ein zweites Mal, das ist die
    // reguläre Prüfung vor dem Streamen.
    const vorab = await withActor(actor, async (tx) => {
      const limit = await pruefeUndZaehle(tx, "tutor");
      if (!limit.erlaubt) return { ok: false as const, status: 429, nachricht: limit.nachricht };
      return { ok: true as const, faecher: await ladeFaecherFuerZuordnung(tx) };
    });
    if (!vorab.ok) return vorab;

    if (vorab.faecher.length > 0) {
      try {
        const antwort = await ordneFachZu({
          faecher: vorab.faecher.map((f) => f.name),
          nachricht: eingang.message,
        });
        zuordnungTokens = { input: antwort.inputTokens, output: antwort.outputTokens };
        zuordnung = loeseFachZuordnungAuf(antwort.fach, vorab.faecher);
      } catch {
        // Netzwerk, Timeout, keine verwertbare Antwort: Das Gespräch
        // startet ohne Fach (strengste Sprachregel, ADR 0013 D5) statt am
        // ersten Wort zu scheitern.
      }
    }
  }

  return withActor(actor, async (tx): Promise<Vorarbeit> => {
    const limit = await pruefeUndZaehle(tx, "tutor");
    if (!limit.erlaubt) {
      return { ok: false, status: 429, nachricht: limit.nachricht };
    }

    let sessionId: string;
    let subjectName: string | null;
    let subjectLanguage: string | null;
    let topicTitle: string | null;
    let entryPoint: "freie_frage" | "verstehen";

    if (eingang.sessionId) {
      // `left join`, nicht `join`: Ein Gespräch ohne Fach (noch nicht
      // zugeordnet, ADR 0013 D3) hat kein `subject_id` – ein `join` fände
      // dann keine Zeile und meldete fälschlich „gibt es nicht".
      const [row] = await tx.execute<{
        subject_name: string | null;
        subject_language: string | null;
        topic_title: string | null;
        entry_point: string;
      }>(sql`
        select s.name as subject_name, s.language as subject_language,
               t.title as topic_title, ts.entry_point
        from tutor_session ts
        left join subject s on s.id = ts.subject_id
        left join topic t on t.id = ts.topic_id
        where ts.id = ${eingang.sessionId}`);
      if (!row) return { ok: false, status: 404, nachricht: "Dieses Gespräch gibt es nicht." };

      sessionId = eingang.sessionId;
      subjectName = row.subject_name;
      subjectLanguage = row.subject_language;
      topicTitle = row.topic_title;
      entryPoint = row.entry_point === "verstehen" ? "verstehen" : "freie_frage";
    } else if (eingang.subjectId) {
      // Explizite Fachwahl – der Übergangspfad, solange die Oberfläche sie
      // noch anbietet (bis T-13 PR 2). Unverändert gegenüber vorher.
      if (!EINSTIEGE.has(eingang.entryPoint)) {
        return { ok: false, status: 400, nachricht: "Wähle zuerst ein Fach und einen Einstieg." };
      }
      const [subject] = await tx.execute<{ name: string; language: string | null }>(sql`
        select s.name, s.language from subject s
        join school_year_subject sys on sys.subject_id = s.id
        join school_year sy on sy.id = sys.school_year_id and sy.status = 'aktiv'
        where s.id = ${eingang.subjectId}`);
      if (!subject) {
        return {
          ok: false,
          status: 400,
          nachricht: "Dieses Fach gibt es in deinem Schuljahr nicht.",
        };
      }

      entryPoint = eingang.entryPoint === "verstehen" ? "verstehen" : "freie_frage";
      subjectName = subject.name;
      subjectLanguage = subject.language;
      topicTitle = null;

      const [neu] = await tx.execute<{ id: string }>(sql`
        insert into tutor_session (student_id, subject_id, title, entry_point)
        values (app.student_id(), ${eingang.subjectId}, ${kuerzeTitel(eingang.message)}, ${entryPoint})
        returning id`);
      sessionId = neu!.id;
    } else {
      // Kein Fach mitgeschickt (ADR 0013 D1): das Ergebnis der Zuordnung von
      // oben, oder `null` (keine Fächer vorhanden, „unklar", oder die
      // Zuordnung ist ausgefallen). „Verstehen" ist keine eigene Wahl mehr –
      // die Kachel dafür entfällt mit der Fachwahl (D1).
      entryPoint = "freie_frage";
      subjectName = zuordnung?.name ?? null;
      subjectLanguage = zuordnung?.language ?? null;
      topicTitle = null;

      const [neu] = await tx.execute<{ id: string }>(sql`
        insert into tutor_session (student_id, subject_id, title, entry_point)
        values (app.student_id(), ${zuordnung?.id ?? null}, ${kuerzeTitel(eingang.message)}, ${entryPoint})
        returning id`);
      sessionId = neu!.id;
    }

    const verlaufRows = await tx.execute<{ role: "nutzer" | "tutor"; content: string }>(sql`
      select role, content from tutor_message
      where session_id = ${sessionId}
      order by created_at asc, id asc`);

    await tx.execute(sql`
      insert into tutor_message (student_id, session_id, role, content)
      values (app.student_id(), ${sessionId}, 'nutzer', ${eingang.message})`);

    const usageId = await bucheNutzung(tx, "tutor");

    // Jahrgang für die Tonlage (T-09). `grade_level` ist `not null`; der
    // Fallback 8 greift nur, falls die Zeile wider Erwarten fehlt.
    const [kind] = await tx.execute<{ grade_level: number }>(
      sql`select grade_level from student where id = app.student_id()`,
    );

    return {
      ok: true,
      sessionId,
      usageId,
      zuordnungTokens,
      system: tutorSystemPrompt({
        subjectName,
        subjectLanguage,
        topicTitle,
        entryPoint,
        gradeLevel: kind?.grade_level ?? 8,
      }),
      verlauf: verlaufRows.map((r) => ({
        role: r.role === "tutor" ? "assistant" : "user",
        content: r.content,
      })),
      hausaufgabe: null,
    };
  });
}

/**
 * Der Hausaufgaben-Zweig von `bereiteVor()` (T-03 PR 2, §4a).
 *
 * `naechsterZug()` (`lib/tutor/hint-ladder.ts`) entscheidet **vor** dem
 * Modellaufruf, was in diesem Zug überhaupt erlaubt ist – der Systemprompt
 * bekommt genau das vorgegeben (ADR 0011 D3: der Zustand liegt in der App).
 *
 * Der Verlauf ist auf **diese eine Aufgabe** begrenzt (`task_id`), nicht auf
 * die ganze Session: Mehrere Aufgaben teilen sich eine `tutor_session` (ein
 * Foto, eine Liste, §4a Schritt 1), und der Tutor soll beim Prüfen von
 * Aufgabe 3 nicht den Verlauf von Aufgabe 1 sehen.
 */
async function bereiteHausaufgabeVor(
  actor: Actor,
  taskId: string,
  eingang: Eingang,
): Promise<Vorarbeit> {
  return withActor(actor, async (tx): Promise<Vorarbeit> => {
    const limit = await pruefeUndZaehle(tx, "tutor");
    if (!limit.erlaubt) {
      return { ok: false, status: 429, nachricht: limit.nachricht };
    }

    const [row] = await tx.execute<{
      session_id: string;
      prompt: string;
      status: "offen" | "in_arbeit" | "geloest" | "loesung_gezeigt" | "uebersprungen";
      attempts: number;
      hint_level: number;
      subject_name: string;
      grade_level: number;
    }>(sql`
      select ht.session_id, ht.prompt, ht.status, ht.attempts, ht.hint_level,
             s.name as subject_name, st.grade_level
      from homework_task ht
      join tutor_session ts on ts.id = ht.session_id
      join subject s on s.id = ts.subject_id
      join student st on st.id = ht.student_id
      where ht.id = ${taskId}`);
    if (!row) return { ok: false, status: 404, nachricht: "Diese Aufgabe gibt es nicht." };

    const zustand: AufgabenZustand = {
      status: row.status,
      attempts: row.attempts,
      hintLevel: row.hint_level,
    };
    const zug = naechsterZug(zustand, {
      bahn: eingang.bahn,
      text: eingang.message,
      hatFoto: eingang.image !== null,
      loesungVerlangt: eingang.loesungVerlangt,
    });

    const verlaufRows = await tx.execute<{ role: "nutzer" | "tutor"; content: string }>(sql`
      select role, content from tutor_message
      where task_id = ${taskId}
      order by created_at asc, id asc`);

    await tx.execute(sql`
      insert into tutor_message (student_id, session_id, task_id, role, content)
      values (app.student_id(), ${row.session_id}, ${taskId}, 'nutzer', ${eingang.message})`);

    // Erster Zug an dieser Aufgabe: Sie geht von „offen" auf „in Arbeit" –
    // und der Zeitbedarf aus §4a („nach 20 Minuten …") bekommt seinen
    // Startpunkt. `coalesce` lässt einen schon gesetzten Wert unangetastet.
    await tx.execute(
      sql`update homework_task set started_at = coalesce(started_at, now()),
            status = case when status = 'offen' then 'in_arbeit' else status end
          where id = ${taskId}`,
    );

    const usageId = await bucheNutzung(tx, "tutor");

    return {
      ok: true,
      sessionId: row.session_id,
      usageId,
      zuordnungTokens: null,
      system: hausaufgabeSystemPrompt({
        subjectName: row.subject_name,
        gradeLevel: row.grade_level,
        aufgabe: row.prompt,
        zug,
      }),
      verlauf: verlaufRows.map((r) => ({
        role: r.role === "tutor" ? "assistant" : "user",
        content: r.content,
      })),
      hausaufgabe: {
        taskId,
        sessionId: row.session_id,
        aufgabe: row.prompt,
        zug,
        zustandVorher: zustand,
      },
    };
  });
}

/**
 * Schreibt einen abgeschlossenen Hausaufgaben-Zug (T-03 PR 2): die
 * Tutor-Nachricht, den neuen Aufgabenzustand, die Kostenbuchung.
 *
 * Nur bei `art: "versuch_pruefen"` läuft die Urteils-Klassifizierung
 * (`klassifiziereVersuch()`) – die anderen drei Zugarten sind vollständig
 * app-bestimmt (`folgeZustand()`), ohne dass das Modell etwas beurteilen
 * müsste (§4a: nur „ist dieser Versuch richtig?" ist seine Entscheidung).
 */
async function schreibeHausaufgabenZug(
  actor: Actor,
  hausaufgabe: NonNullable<Extract<Vorarbeit, { ok: true }>["hausaufgabe"]>,
  usageId: string,
  volltext: string,
  usage: { input_tokens: number; output_tokens: number },
): Promise<void> {
  const { taskId, sessionId, aufgabe, zug, zustandVorher } = hausaufgabe;
  const deutsch = istDeutsch(volltext);
  const tokens = usage.input_tokens + usage.output_tokens;

  let eingabeGesamt = usage.input_tokens;
  let ausgabeGesamt = usage.output_tokens;
  let neuerZustand: AufgabenZustand;

  if (zug.art === "versuch_pruefen") {
    try {
      const urteil = await klassifiziereVersuch({ aufgabe, tutorAntwort: volltext });
      eingabeGesamt += urteil.inputTokens;
      ausgabeGesamt += urteil.outputTokens;
      neuerZustand = zustandNachVersuchUrteil(zustandVorher, zug, urteil.urteil);
    } catch {
      // Die Klassifizierung selbst ist ausgefallen (Netzwerk, Timeout) –
      // der Versuch bleibt dokumentiert (Zeile und Zähler), aber ohne
      // Urteil zählt er konservativ als „falsch": Niemand bekommt eine
      // Aufgabe fälschlich als „gelöst" markiert, weil eine Nebenanfrage
      // scheiterte. Die Tutor-Antwort selbst steht trotzdem im Verlauf.
      neuerZustand = folgeZustand(zustandVorher, zug);
    }
  } else {
    neuerZustand = folgeZustand(zustandVorher, zug);
  }

  await withActor(actor, async (tx) => {
    await tx.execute(sql`
      insert into tutor_message (student_id, session_id, task_id, role, content, token_count, language_ok)
      values (app.student_id(), ${sessionId}, ${taskId}, 'tutor', ${volltext}, ${tokens}, ${deutsch})`);
    await ergaenzeTokenzahl(tx, usageId, eingabeGesamt, ausgabeGesamt);
    await tx.execute(sql`
      update homework_task
      set status = ${neuerZustand.status}, attempts = ${neuerZustand.attempts},
          hint_level = ${neuerZustand.hintLevel},
          finished_at = case when ${istAbgeschlossen(neuerZustand)} then now() else finished_at end
      where id = ${taskId}`);
    await tx.execute(sql`update tutor_session set updated_at = now() where id = ${sessionId}`);
  });

  // Nach der Transaktion, nicht darin: prüft selbst noch einmal (eigene
  // Transaktion) und ruft bei Bedarf das Modell für den Hinweis-Halbsatz –
  // das soll die Transaktion oben nicht offenhalten.
  if (istAbgeschlossen(neuerZustand)) {
    await pruefeUndErzeugeAbschluss(actor, sessionId);
  }
}
