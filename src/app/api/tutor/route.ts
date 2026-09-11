import { sql } from "drizzle-orm";

import { streamTutorReply, type TutorTurn } from "@/ai/client";
import { tutorSystemPrompt } from "@/ai/prompts/tutor";
import { withActor, type Actor } from "@/db/actor";
import { loginStatus } from "@/lib/auth/actor";
import { bucheNutzung, ergaenzeTokenzahl, pruefeUndZaehle } from "@/lib/ai/rate-limit";
import { anthropicConfigured, databaseConfigured } from "@/lib/env";
import { istDeutsch } from "@/lib/tutor/language-guard";

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

type Eingang = {
  sessionId: string | null;
  subjectId: string | null;
  entryPoint: string;
  message: string;
};

function liesEingang(body: unknown): Eingang | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const message = typeof b.message === "string" ? b.message.trim() : "";
  if (message.length === 0 || message.length > 4000) return null;
  return {
    sessionId: typeof b.sessionId === "string" && b.sessionId.length > 0 ? b.sessionId : null,
    subjectId: typeof b.subjectId === "string" && b.subjectId.length > 0 ? b.subjectId : null,
    entryPoint: typeof b.entryPoint === "string" ? b.entryPoint : "freie_frage",
    message,
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
    { role: "user", content: eingang.message },
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
          await withActor(actor, async (tx) => {
            await tx.execute(sql`
              insert into tutor_message (student_id, session_id, role, content, token_count, language_ok)
              values (app.student_id(), ${vor.sessionId}, 'tutor', ${volltext}, ${tokens}, ${deutsch})`);
            await ergaenzeTokenzahl(
              tx,
              vor.usageId,
              final.usage.input_tokens,
              final.usage.output_tokens,
            );
            await tx.execute(
              sql`update tutor_session set updated_at = now() where id = ${vor.sessionId}`,
            );
          });
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

/**
 * Schritte 1 und 2 in einer Transaktion: Limit prüfen, Session auflösen
 * oder anlegen, bisherige Nachrichten laden, Nutzernachricht schreiben,
 * Nutzung buchen. Gibt alles zurück, was das Streamen danach braucht.
 */
async function bereiteVor(actor: Actor, eingang: Eingang): Promise<Vorarbeit> {
  return withActor(actor, async (tx): Promise<Vorarbeit> => {
    const limit = await pruefeUndZaehle(tx, "tutor");
    if (!limit.erlaubt) {
      return { ok: false, status: 429, nachricht: limit.nachricht };
    }

    let sessionId: string;
    let subjectName: string;
    let subjectLanguage: string | null;
    let topicTitle: string | null;
    let entryPoint: "freie_frage" | "verstehen";

    if (eingang.sessionId) {
      const [row] = await tx.execute<{
        subject_name: string;
        subject_language: string | null;
        topic_title: string | null;
        entry_point: string;
      }>(sql`
        select s.name as subject_name, s.language as subject_language,
               t.title as topic_title, ts.entry_point
        from tutor_session ts
        join subject s on s.id = ts.subject_id
        left join topic t on t.id = ts.topic_id
        where ts.id = ${eingang.sessionId}`);
      if (!row) return { ok: false, status: 404, nachricht: "Dieses Gespräch gibt es nicht." };

      sessionId = eingang.sessionId;
      subjectName = row.subject_name;
      subjectLanguage = row.subject_language;
      topicTitle = row.topic_title;
      entryPoint = row.entry_point === "verstehen" ? "verstehen" : "freie_frage";
    } else {
      if (!eingang.subjectId || !EINSTIEGE.has(eingang.entryPoint)) {
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
    };
  });
}
