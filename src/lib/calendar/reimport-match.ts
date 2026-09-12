/**
 * Re-Import-Matching (K-02b, ADR 0016 D8, §6 M7): „Re-Import matcht über
 * (fach, gruppe, datum±7, titel) und zeigt unverändert/verschoben/neu/
 * entfallen."
 *
 * Rein: keine Datenbank, keine Kanal-Kenntnis. `subjectId` muss beim Aufruf
 * schon aufgelöst sein (ADR 0016 D4) – Zeilen mit `subjectGuess: "unklar"`
 * oder `type: "blocker"` filtert der Aufrufer vorher heraus, diese Funktion
 * kennt `CalendarImportDraft` nicht.
 */

export type ExistingCalendarEvent = {
  id: string;
  subjectId: string;
  /** Wie in `calendar_event.groups` gespeichert – `null` bei manueller Eingabe ohne Gruppenbezug. */
  groups: string[] | null;
  /** ISO-Datum `YYYY-MM-DD`. */
  date: string;
  title: string;
};

export type ReimportCandidate = {
  subjectId: string;
  groups: string[];
  /** ISO-Datum `YYYY-MM-DD`. */
  date: string;
  title: string;
};

export type ReimportBucket = "unveraendert" | "verschoben" | "neu";

export type ReimportDraftMatch = {
  /** Index in der übergebenen `drafts`-Liste – der Aufrufer kennt den Rest der Zeile schon. */
  index: number;
  bucket: ReimportBucket;
  matchedId: string | null;
};

export type ReimportResult = {
  drafts: ReimportDraftMatch[];
  /** IDs bestehender Termine, zu denen kein Entwurf mehr passt. */
  entfallen: string[];
};

const TAG_MS = 24 * 60 * 60 * 1000;
const FENSTER_TAGE = 7;

function tageDifferenz(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  const ta = Date.UTC(ay!, am! - 1, ad!);
  const tb = Date.UTC(by!, bm! - 1, bd!);
  return Math.abs(ta - tb) / TAG_MS;
}

/**
 * Groß-/Kleinschreibung und diakritische Zeichen fallen weg – dieselbe
 * Großzügigkeit wie `normalisiere()` in `lib/tutor/gespraechs-suche.ts`
 * (T-19c), nur lokal statt geteilt: Anders als dort geht es hier nicht um
 * eine Menschen-Suche, sondern um eine Maschinen-Entscheidung – die bleibt
 * aber ungefährlich, weil K-02c ohnehin nichts ohne „Übernehmen" schreibt
 * (ADR 0016 D2). Ein Titel, der nur in Groß-/Kleinschreibung abweicht, soll
 * nicht als „neu" durchgehen.
 */
function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .replace(/\s+/g, " ");
}

function sameGroups(a: string[] | null, b: string[]): boolean {
  const na = new Set((a ?? []).map(normalizeText));
  const nb = new Set(b.map(normalizeText));
  if (na.size !== nb.size) return false;
  for (const token of na) if (!nb.has(token)) return false;
  return true;
}

/**
 * Ein Treffer braucht gleiches Fach, gleiche Gruppen als Menge (ADR 0016 D7:
 * andere Gruppen sind ein anderer Termin, kein Update) und einen
 * übereinstimmenden Titel; das Datum darf bis zu sieben Tage abweichen.
 * Gleiches Datum zusätzlich → `unveraendert`, sonst `verschoben`.
 *
 * Jeder bestehende Termin und jeder Entwurf wird höchstens einmal verbraucht
 * – bei mehreren möglichen Treffern gewinnt der zeitlich nächste. Für den
 * hier erwarteten Umfang (wenige Termine desselben Fachs im selben Fenster)
 * reicht diese gierige Zuordnung; ein global optimales Bipartite-Matching
 * hätte hier keinen erkennbaren Abnehmer.
 */
export function matchReimport(
  existing: ExistingCalendarEvent[],
  drafts: ReimportCandidate[],
): ReimportResult {
  const offen = new Set(existing.map((event) => event.id));
  const draftResults: ReimportDraftMatch[] = [];

  for (const [index, draft] of drafts.entries()) {
    let best: { event: ExistingCalendarEvent; diff: number } | null = null;
    for (const event of existing) {
      if (!offen.has(event.id)) continue;
      if (event.subjectId !== draft.subjectId) continue;
      if (!sameGroups(event.groups, draft.groups)) continue;
      if (normalizeText(event.title) !== normalizeText(draft.title)) continue;
      const diff = tageDifferenz(event.date, draft.date);
      if (diff > FENSTER_TAGE) continue;
      if (!best || diff < best.diff) best = { event, diff };
    }
    if (!best) {
      draftResults.push({ index, bucket: "neu", matchedId: null });
      continue;
    }
    offen.delete(best.event.id);
    draftResults.push({
      index,
      bucket: best.diff === 0 ? "unveraendert" : "verschoben",
      matchedId: best.event.id,
    });
  }

  return { drafts: draftResults, entfallen: [...offen] };
}
