import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { aiEnv } from "@/lib/env";

import {
  fachZuordnungSystemPrompt,
  fachZuordnungUserPrompt,
  type FachZuordnungContext,
} from "./prompts/fach-zuordnung";
import {
  hausaufgabeZusammenfassungSystemPrompt,
  hausaufgabeZusammenfassungUserPrompt,
  type HausaufgabeZusammenfassungContext,
} from "./prompts/hausaufgabe-zusammenfassung";
import {
  homeworkExtractionSystemPrompt,
  homeworkExtractionUserPrompt,
  type HomeworkExtractionContext,
} from "./prompts/homework-extraction";
import {
  versuchUrteilSystemPrompt,
  versuchUrteilUserPrompt,
  type VersuchUrteilContext,
} from "./prompts/versuch-urteil";
import {
  vocabExtractionSystemPrompt,
  vocabExtractionUserPrompt,
  type VocabExtractionContext,
} from "./prompts/vocab-extraction";
import { fachZuordnungSchema, type FachZuordnungErgebnis } from "./schemas/fach-zuordnung";
import {
  hausaufgabenZusammenfassungSchema,
  type HausaufgabenZusammenfassung,
} from "./schemas/hausaufgabe-zusammenfassung";
import { homeworkExtractionSchema, type HomeworkExtraction } from "./schemas/homework-extraction";
import { versuchUrteilSchema, type VersuchUrteil } from "./schemas/versuch-urteil";
import { vocabExtractionSchema, type VocabExtraction } from "./schemas/vocab-extraction";

/**
 * Der Zugang zur Claude API (V-03b, erster KI-Aufruf im Projekt).
 *
 * **Sonnet für Vision** (CLAUDE.md: „Sonnet für Tutor, Vision, Generierung,
 * Bewertung; Haiku für Klassifikation und Vokabel-Checks"). Die Modell-ID
 * steht als eine Konstante, damit ein Wechsel eine Zeile ist.
 *
 * Structured Output über `zodOutputFormat()` und `messages.parse()`: Das SDK
 * schickt das Zod-Schema als JSON Schema mit und liefert die geparste
 * Antwort als `parsed_output`. Kein selbstgebauter Umweg über erzwungenes
 * Tool-Use und kein `JSON.parse` auf einem Textblock – beides wäre eine
 * eigene Fehlerquelle für etwas, das die Bibliothek kann.
 *
 * Der Schlüssel kommt über `aiEnv()`, das im Browser wirft – dieselbe
 * Absicherung wie bei `dbEnv()`/`authEnv()`. Ein `server-only`-Import wäre
 * die schärfere Variante (Build-Fehler statt Laufzeitfehler), ist aber eine
 * zusätzliche Abhängigkeit, die das Projekt bisher nicht hat; erreichbar ist
 * diese Datei ohnehin nur aus einer `"use server"`-Datei.
 */

const VISION_MODEL = "claude-sonnet-5";

/** CLAUDE.md: „Sonnet für Tutor". Eine Konstante, damit ein Wechsel eine Zeile ist. */
const TUTOR_MODEL = "claude-sonnet-5";

/**
 * CLAUDE.md: „Haiku für Klassifikation" (T-03 PR 2). Nur für
 * `klassifiziereVersuch()` – die liest die schon fertige Tutor-Antwort und
 * destilliert ein `enum` daraus, keine eigene fachliche Bewertung.
 */
const KLASSIFIKATION_MODEL = "claude-haiku-4-5-20251001";

/** Ein Bild, wie es aus dem Browser kommt – Base64 ohne `data:`-Präfix. */
export type InlineImage = {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp";
};

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  // Erst beim ersten Aufruf, nicht beim Import: Sonst verlangte schon das
  // Laden dieses Moduls einen Schlüssel, den nur der Foto-Weg braucht.
  client ??= new Anthropic({ apiKey: aiEnv().ANTHROPIC_API_KEY });
  return client;
}

/**
 * Ein Bild → Vokabelzeilen. Wirft, wenn das Modell nichts Verwertbares
 * liefert; der Aufrufer übersetzt das in eine deutsche Fehlermeldung.
 *
 * Das Bild wird **nicht** gespeichert (ADR 0007 D6) – es lebt nur für die
 * Dauer dieses Aufrufs im Speicher.
 */
export async function extractVocabularyFromImage(
  image: InlineImage,
  context: VocabExtractionContext,
): Promise<VocabExtraction> {
  const message = await anthropic().messages.parse({
    model: VISION_MODEL,
    // Großzügig: Eine Doppelseite kann 60 Zeilen tragen, und ein zu knappes
    // Limit schneidet die Liste stumm ab, statt einen Fehler zu werfen.
    max_tokens: 8000,
    system: vocabExtractionSystemPrompt(context),
    // `output_config.format`, nicht das ältere `output_format` – Letzteres
    // weist die API mit 400 zurück („This field is deprecated"), obwohl die
    // Doc-Kommentare im SDK es an einigen Stellen noch zeigen. Gegen die
    // echte API geprüft, nicht aus dem Kommentar übernommen.
    output_config: { format: zodOutputFormat(vocabExtractionSchema) },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: image.mediaType, data: image.base64 },
          },
          { type: "text", text: vocabExtractionUserPrompt() },
        ],
      },
    ],
  });

  if (!message.parsed_output) {
    throw new Error("Die Bilderkennung hat keine verwertbare Antwort geliefert.");
  }
  return message.parsed_output;
}

/** Erkannte Aufgaben plus die verbrauchten Token – T-03 PR 2 bucht sie gegen den Kostendeckel (S-03c). */
export type HomeworkExtractionResult = {
  extraction: HomeworkExtraction;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Ein Foto einer Hausaufgabe → Fach-Zuordnung + Aufgabenliste (T-03, §4a
 * Schritt 1; Fach seit T-13, ADR 0013 D7).
 *
 * Derselbe Weg wie `extractVocabularyFromImage()`: Structured Output über
 * `zodOutputFormat()`, Bild nur im Nutzerteil, Bild wird **nicht**
 * gespeichert. Der Systemprompt verbietet ausdrücklich, die Aufgaben zu
 * lösen – sonst stünde die Lösung schon in der Liste, bevor §4a überhaupt
 * greift.
 *
 * `extraction.fach` kommt **immer** mit zurück – kein zweiter Aufruf nur für
 * die Zuordnung, das Foto geht ohnehin durch Vision. Der Aufrufer
 * (`fotoZuAufgaben()`) übernimmt es nur, solange die Session noch kein Fach
 * hat; bei weiteren Fotos derselben Hausaufgabe wird das Ergebnis verworfen,
 * statt eine schon getroffene Zuordnung erneut zur Diskussion zu stellen.
 *
 * Gibt die Token-Zahlen mit zurück (anders als `extractVocabularyFromImage()`,
 * die vor S-03c entstand): Der Aufrufer bucht sie gegen `ai_usage`, damit ein
 * Hausaufgaben-Foto genauso zum Kostendeckel zählt wie ein Tutor-Zug.
 */
export async function extractHomeworkFromImage(
  image: InlineImage,
  context: HomeworkExtractionContext,
): Promise<HomeworkExtractionResult> {
  const message = await anthropic().messages.parse({
    model: VISION_MODEL,
    max_tokens: 4000,
    system: homeworkExtractionSystemPrompt(context),
    output_config: { format: zodOutputFormat(homeworkExtractionSchema(context.faecher)) },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: image.mediaType, data: image.base64 },
          },
          { type: "text", text: homeworkExtractionUserPrompt() },
        ],
      },
    ],
  });

  if (!message.parsed_output) {
    throw new Error("Die Bilderkennung hat keine verwertbare Antwort geliefert.");
  }
  return {
    extraction: message.parsed_output,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

/**
 * Ein Gesprächsbeitrag, wie ihn das Modell erwartet.
 *
 * `image` nur bei `role: "user"` und nur im **aktuellen** Zug (T-03 PR 2):
 * Ein Foto vom Lösungsweg zählt als Versuch (§4a Schritt 2), aber die
 * Historie früherer Züge wird nie erneut mit Bild verschickt – das wäre bei
 * jedem weiteren Zug dieselben Bild-Tokens noch einmal bezahlt, ohne dass
 * das Modell sie noch bräuchte (es hat die frühere Antwort ja schon
 * gegeben). Der Text der Nutzernachricht bleibt in der Historie stehen,
 * nur das Bild fällt nach diesem einen Zug wieder heraus.
 */
export type TutorTurn =
  { role: "user"; content: string; image?: InlineImage } | { role: "assistant"; content: string };

/**
 * Startet die Tutor-Antwort als Stream (T-02, ADR 0010 D1).
 *
 * Gibt den rohen `MessageStream` des SDK zurück – der Route Handler hängt
 * sich mit `.on("text", …)` an die Wortdeltas und liest nach `.finalMessage()`
 * die verbrauchten Token. **Kein** Structured Output: Streaming und ein
 * Zod-Schema schließen sich aus (ADR 0010 D1). Die Kennzeichnung
 * „Allgemeinwissen" setzt deshalb der Server, nicht das Modell (D5).
 *
 * `max_tokens` großzügig, aber nicht üppig: Eine Erklärung für Jahrgang 8
 * liegt bei 300–600 Tokens; 1200 lässt Luft, ohne zu einem Vortrag
 * einzuladen.
 */
export function streamTutorReply(system: string, verlauf: TutorTurn[]) {
  return anthropic().messages.stream({
    model: TUTOR_MODEL,
    max_tokens: 1200,
    system,
    messages: verlauf.map((turn) => ({
      role: turn.role,
      content:
        turn.role === "user" && turn.image
          ? [
              {
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  media_type: turn.image.mediaType,
                  data: turn.image.base64,
                },
              },
              { type: "text" as const, text: turn.content },
            ]
          : turn.content,
    })),
  });
}

export type VersuchUrteilResult = {
  urteil: VersuchUrteil;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Urteil über einen geprüften Hausaufgaben-Versuch (T-03 PR 2, §4a).
 *
 * Liest **nur** die schon fertige Tutor-Antwort, kein neuer Blick auf
 * Aufgabe oder Versuch (`ai/prompts/versuch-urteil.ts`). Haiku statt Sonnet
 * (CLAUDE.md: „Haiku für Klassifikation") – die fachliche Bewertung ist mit
 * dem Tutor-Zug schon gelaufen, hier wird nur destilliert.
 *
 * Gibt die Token-Zahlen mit zurück, damit der Aufrufer sie zum selben
 * `ai_usage`-Eintrag des Tutor-Zugs dazuzählt (ein Zug, eine Zeile,
 * S-03c) statt eine eigene Zeile für die Klassifizierung anzulegen.
 *
 * Wirft, wenn das Modell nichts Verwertbares liefert; der Aufrufer entscheidet
 * dann konservativ (siehe Route Handler – ein unklares Urteil zählt nie als
 * „richtig").
 */
export async function klassifiziereVersuch(
  context: VersuchUrteilContext,
): Promise<VersuchUrteilResult> {
  const message = await anthropic().messages.parse({
    model: KLASSIFIKATION_MODEL,
    max_tokens: 20,
    system: versuchUrteilSystemPrompt(),
    output_config: { format: zodOutputFormat(versuchUrteilSchema) },
    messages: [{ role: "user", content: versuchUrteilUserPrompt(context) }],
  });

  if (!message.parsed_output) {
    throw new Error("Die Urteils-Klassifizierung hat keine verwertbare Antwort geliefert.");
  }
  return {
    urteil: message.parsed_output.urteil,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

export type FachZuordnungResult = {
  fach: FachZuordnungErgebnis;
  inputTokens: number;
  outputTokens: number;
};

/**
 * Ordnet die erste Nachricht eines neuen Gesprächs einem Fach zu (T-13,
 * ADR 0013 D2). Haiku, nicht Sonnet (CLAUDE.md: „Haiku für Klassifikation") –
 * die Auswahl ist geschlossen (`fachZuordnungSchema()`, aus `faecher`
 * gebaut), keine eigene fachliche Einschätzung.
 *
 * Läuft **vor** dem Streamen, nicht daneben: Der Systemprompt der
 * eigentlichen Antwort braucht `subjectLanguage`, um zu wissen, ob die
 * Zielsprache erlaubt ist (ADR 0010 D3) – parallel liefe ausgerechnet die
 * erste Antwort in einem Sprachenfach ohne ein einziges fremdsprachiges
 * Beispiel (ADR 0013 D2, D5).
 *
 * Wirft, wenn das Modell nichts Verwertbares liefert; der Aufrufer
 * (`api/tutor/route.ts`) fängt das ab und startet das Gespräch konservativ
 * ohne Fach, statt am ersten Wort zu scheitern.
 */
export async function ordneFachZu(context: FachZuordnungContext): Promise<FachZuordnungResult> {
  const message = await anthropic().messages.parse({
    model: KLASSIFIKATION_MODEL,
    max_tokens: 20,
    system: fachZuordnungSystemPrompt(context),
    output_config: { format: zodOutputFormat(fachZuordnungSchema(context.faecher)) },
    messages: [{ role: "user", content: fachZuordnungUserPrompt(context) }],
  });

  if (!message.parsed_output) {
    throw new Error("Die Fach-Zuordnung hat keine verwertbare Antwort geliefert.");
  }
  return {
    fach: message.parsed_output.fach,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}

export type HausaufgabeHinweisResult = HausaufgabenZusammenfassung & {
  inputTokens: number;
  outputTokens: number;
};

/**
 * Der Hinweis-Halbsatz für den Zweizeiler nach Abschluss einer Hausaufgaben-
 * Session (T-03 PR 2, §4a „Ansicht"). Sonnet, nicht Haiku (CLAUDE.md:
 * „Sonnet für … Generierung") – anders als `klassifiziereVersuch()` ist das
 * hier keine Destillation einer schon fertigen Antwort, sondern eine eigene
 * kleine Einschätzung aus der Aufgabenliste.
 *
 * Wirft, wenn das Modell nichts Verwertbares liefert; der Aufrufer
 * (`lib/tutor/hausaufgabe-abschluss.ts`) fällt dann auf einen neutralen
 * Halbsatz zurück statt den ganzen Abschluss scheitern zu lassen.
 */
export async function erzeugeHausaufgabenHinweis(
  context: HausaufgabeZusammenfassungContext,
): Promise<HausaufgabeHinweisResult> {
  const message = await anthropic().messages.parse({
    model: TUTOR_MODEL,
    max_tokens: 60,
    system: hausaufgabeZusammenfassungSystemPrompt(),
    output_config: { format: zodOutputFormat(hausaufgabenZusammenfassungSchema) },
    messages: [{ role: "user", content: hausaufgabeZusammenfassungUserPrompt(context) }],
  });

  if (!message.parsed_output) {
    throw new Error("Die Zusammenfassung hat keine verwertbare Antwort geliefert.");
  }
  return {
    hinweis: message.parsed_output.hinweis,
    inputTokens: message.usage.input_tokens,
    outputTokens: message.usage.output_tokens,
  };
}
