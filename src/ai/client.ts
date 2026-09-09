import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { aiEnv } from "@/lib/env";

import {
  vocabExtractionSystemPrompt,
  vocabExtractionUserPrompt,
  type VocabExtractionContext,
} from "./prompts/vocab-extraction";
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
