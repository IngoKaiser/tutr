import { classifyEventType, resolveSubjectGuess, splitGroupsText } from "./row-import";
import type { CalendarImportDraft } from "./import-draft";

/**
 * ICS-Import Klausurplan (K-04, §6 M7, ADR 0016). Anders als CSV/XLSX gibt
 * es hier keine getrennten Fach-/Art-Spalten – ein Termin ist ein
 * `VEVENT`-Block mit `SUMMARY` als einzigem Freitext. `classifyEventType()`
 * und `resolveSubjectGuess()` (`row-import.ts`) suchen dort dieselben
 * Wörter, die sie sonst in einer eigenen Spalte fänden – „Präfix in einem
 * kurzen Feld" und „Präfix irgendwo im Satz" sind dieselbe Regel, nur mit
 * einem längeren Heuhaufen.
 *
 * Kein RRULE-Support (wiederkehrende Termine) – ein Klausurplan-Export
 * listet jeden Termin einzeln, ADR 0016 nennt dafür keinen Anwendungsfall.
 */

/** RFC-5545-Zeilenfaltung rückgängig machen: eine Fortsetzungszeile beginnt mit Leerzeichen/Tab. */
function entfalte(text: string): string[] {
  const zeilen = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const entfaltet: string[] = [];
  for (const zeile of zeilen) {
    if ((zeile.startsWith(" ") || zeile.startsWith("\t")) && entfaltet.length > 0) {
      entfaltet[entfaltet.length - 1] += zeile.slice(1);
    } else {
      entfaltet.push(zeile);
    }
  }
  return entfaltet;
}

/** `"DTSTART;VALUE=DATE:20260925"` → `{ name: "DTSTART", value: "20260925" }`. Parameter (vor `:`) werden verworfen. */
function parseZeile(zeile: string): { name: string; value: string } | null {
  const doppelpunkt = zeile.indexOf(":");
  if (doppelpunkt < 0) return null;
  const name = zeile.slice(0, doppelpunkt).split(";")[0]!.toUpperCase();
  const value = zeile.slice(doppelpunkt + 1);
  return { name, value };
}

/** `"20260925"` oder `"20260925T085000Z"` → ISO `YYYY-MM-DD`. `null` bei allem anderen. */
function parseIcsDatum(value: string): string | null {
  const treffer = /^(\d{4})(\d{2})(\d{2})/.exec(value);
  if (!treffer) return null;
  const [, y, m, d] = treffer;
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    dt.getUTCFullYear() !== Number(y) ||
    dt.getUTCMonth() !== Number(m) - 1 ||
    dt.getUTCDate() !== Number(d)
  ) {
    return null;
  }
  return `${y}-${m}-${d}`;
}

/** `\n`, `\,`, `\;` entschärfen (RFC 5545 Text-Escaping). */
function entschaerfe(value: string): string {
  return value.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").trim();
}

export type IcsImportErgebnis = { drafts: CalendarImportDraft[]; fehler: string[] };

/** ICS-Text → Entwürfe. Ignoriert alles außerhalb von `VEVENT`-Blöcken (Zeitzonen-Definitionen u. Ä.). */
export function icsToDrafts(text: string, subjectNames: readonly string[]): IcsImportErgebnis {
  const zeilen = entfalte(text);
  if (!zeilen.some((z) => z.trim().toUpperCase() === "BEGIN:VEVENT")) {
    return { drafts: [], fehler: ["Die Datei enthält keine Termine (kein VEVENT gefunden)."] };
  }

  const drafts: CalendarImportDraft[] = [];
  const fehler: string[] = [];
  let aktuell: Record<string, string> | null = null;
  let index = 0;

  for (const zeile of zeilen) {
    const getrimmt = zeile.trim();
    if (getrimmt.toUpperCase() === "BEGIN:VEVENT") {
      aktuell = {};
      continue;
    }
    if (getrimmt.toUpperCase() === "END:VEVENT") {
      if (aktuell) {
        index++;
        const draft = eventZuDraft(aktuell, subjectNames);
        if (draft) {
          drafts.push(draft);
        } else {
          fehler.push(`Termin ${index}: Datum oder Titel fehlt oder ist ungültig.`);
        }
      }
      aktuell = null;
      continue;
    }
    if (!aktuell) continue;
    const feld = parseZeile(getrimmt);
    if (feld) aktuell[feld.name] = feld.value;
  }

  return { drafts, fehler };
}

function eventZuDraft(
  event: Record<string, string>,
  subjectNames: readonly string[],
): CalendarImportDraft | null {
  const date = event.DTSTART ? parseIcsDatum(event.DTSTART) : null;
  const summary = event.SUMMARY ? entschaerfe(event.SUMMARY) : null;
  if (!date || !summary) return null;

  const type = classifyEventType(summary);
  const subjectGuess = type === "blocker" ? null : resolveSubjectGuess(summary, subjectNames);
  const categories = event.CATEGORIES ? entschaerfe(event.CATEGORIES) : null;

  return {
    type,
    subjectGuess,
    title: summary,
    displayName: null,
    date,
    groups: splitGroupsText(categories),
    relevant: type !== "sonstiges",
    confidence: "hoch",
    note: event.DESCRIPTION ? entschaerfe(event.DESCRIPTION) : null,
  };
}
