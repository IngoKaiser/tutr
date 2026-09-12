import { normalisiere } from "@/lib/tutor/gespraechs-suche";

import type { CalendarImportDraft } from "./import-draft";
import type { CalendarEventType } from "./upcoming";

/**
 * Geteilter Kern für den Datei-Import (K-04, ADR 0016 D4): Fach- und
 * Typ-Erkennung ohne Modellaufruf. CSV (`csv-import.ts`) und XLSX
 * (`xlsx-import.ts`) rufen `draftFromRow()` direkt (eine Spalte je Feld);
 * ICS (`ics-import.ts`) sucht dieselben Wörter im Freitext der `SUMMARY`,
 * weil dort Fach/Art nicht getrennt stehen.
 *
 * **Kein Modellaufruf, also kein Raten.** `resolveSubjectGuess()` erkennt
 * nur, was sich benennen lässt: der volle Name oder ein eindeutiges
 * Präfix („Eng" → „Englisch" ist ein Abkürzungs-Problem, kein
 * Unschärfe-Problem, ADR 0016 D4). Alles andere bleibt `"unklar"` – nie ein
 * geratener Treffer wie bei `loeseFachZuordnungAuf()`.
 */

/** Eine Zeile, wie sie aus einer Kopfzeilen-Spalte (CSV/XLSX) kommt – noch unaufgelöste Rohtexte. */
export type ImportRow = {
  date: string | null;
  subjectText: string | null;
  typeText: string | null;
  title: string | null;
  displayName: string | null;
  /** Rohtext einer Gruppen-Spalte, z. B. `"8.5, 8.5 Eng"`. `null` = keine Spalte/Angabe. */
  groupsText: string | null;
  note: string | null;
};

/**
 * `"8.5 Eng, 8.5 Mat"` → `["8.5 Eng", "8.5 Mat"]`. Leer/`null` → `[]`
 * (betrifft alle, wie bei den Vision-Drafts, K-02b `matchesOwnGroups()`).
 */
export function splitGroupsText(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** `DD.MM.YYYY` oder `YYYY-MM-DD` → ISO `YYYY-MM-DD`. `null`, wenn beides nicht passt oder das Datum nicht existiert. */
export function parseDate(text: string | null): string | null {
  if (!text) return null;
  const wert = text.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(wert);
  const de = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(wert);
  const [, jahr, monat, tag] = iso
    ? iso
    : de
      ? [de[0], de[3]!, de[2]!, de[1]!]
      : [undefined, undefined, undefined, undefined];
  if (!jahr || !monat || !tag) return null;

  const y = Number(jahr);
  const m = Number(monat);
  const d = Number(tag);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${jahr}-${monat.padStart(2, "0")}-${tag.padStart(2, "0")}`;
}

/**
 * Schlüsselwörter je Art, geprüft in dieser Reihenfolge – Blocker zuerst,
 * weil „Projektwoche" sonst an „woche" vorbeirutschen könnte, dann die
 * spezifischeren vor `sonstiges` als Auffangbecken. Absichtlich schmal statt
 * einer großen, geratenen Liste: Was hier nicht steht, landet ehrlich in
 * `sonstiges` statt falsch in einer Kategorie.
 */
const TYPE_KEYWORDS: { type: CalendarEventType | "blocker"; keywords: string[] }[] = [
  { type: "blocker", keywords: ["ferien", "fahrt", "projektwoche", "projekt", "praktikum"] },
  { type: "klassenarbeit", keywords: ["klassenarbeit", "klausur", "arbeit"] },
  { type: "test", keywords: ["test"] },
  { type: "muendlich", keywords: ["mundlich"] }, // normalisiert: "mündlich" → "mundlich"
  { type: "abgabe", keywords: ["abgabe"] },
];

/**
 * Erkennt die Art aus einem Rohtext (eigene Spalte bei CSV/XLSX, freier
 * `SUMMARY`-Text bei ICS). Kein Treffer → `"sonstiges"` – bewusst dieselbe
 * Kategorie, in die auch unklare Vision-Zeilen wie „Tag der offenen Tür"
 * fallen (ADR 0016), nicht ein erfundener Sonderfall.
 */
export function classifyEventType(text: string | null): CalendarEventType | "blocker" {
  if (!text) return "sonstiges";
  const normal = normalisiere(text);
  for (const { type, keywords } of TYPE_KEYWORDS) {
    if (keywords.some((k) => normal.includes(k))) return type;
  }
  return "sonstiges";
}

/**
 * Sucht den Fachnamen in `text` – volles Wort oder eindeutiges Präfix ab drei
 * Zeichen (ADR 0016 D4). Mehrdeutige Präfixe (träfen auf mehr als ein Fach
 * zu) zählen nicht als Treffer, sonst wäre es wieder Raten.
 */
export function resolveSubjectGuess(text: string | null, subjectNames: readonly string[]): string {
  if (!text) return "unklar";
  const normal = normalisiere(text);
  if (normal.length === 0) return "unklar";

  const namen = subjectNames.map((name) => ({ name, normal: normalisiere(name) }));

  const voll = namen.find((n) => normal.includes(n.normal));
  if (voll) return voll.name;

  const woerter = normal.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
  for (const wort of woerter) {
    const treffer = namen.filter((n) => n.normal.startsWith(wort));
    if (treffer.length === 1) return treffer[0]!.name;
  }
  return "unklar";
}

/**
 * Eine Zeile → ein Entwurf. `null`, wenn Datum oder Titel fehlen – eine
 * solche Zeile lässt sich nicht sinnvoll anzeigen (Aufrufer zählt das als
 * Fehler, statt eine erfundene Lücke zu zeigen).
 *
 * `relevant` (Lernbezug-Hälfte, ADR 0016 D3) ist hier eine Funktion der Art:
 * Blocker und die vier „echten" Typen gelten als Lernbezug, `sonstiges" –
 * der Auffangbecken für unklare Zeilen – nicht. Das ist dieselbe Regel, die
 * bei der Vision-Fixture „Tag der offenen Tür" (unklarer Typ) auf
 * `relevant: false` bringt.
 */
export function draftFromRow(
  row: ImportRow,
  subjectNames: readonly string[],
): CalendarImportDraft | null {
  const date = parseDate(row.date);
  const title = row.title?.trim();
  if (!date || !title) return null;

  const type = classifyEventType(row.typeText ?? row.title);
  const subjectGuess =
    type === "blocker" ? null : resolveSubjectGuess(row.subjectText, subjectNames);

  return {
    type,
    subjectGuess,
    title,
    displayName: nichtLeer(row.displayName),
    date,
    groups: splitGroupsText(row.groupsText),
    relevant: type !== "sonstiges",
    // Kein Kalenderwochen-Abgleich möglich (ADR 0016 D6 ist eine
    // OCR-Idee) – der Datei-Kanal hat keine eigene Unsicherheit zu zeigen.
    confidence: "hoch",
    note: nichtLeer(row.note),
  };
}

function nichtLeer(value: string | null | undefined): string | null {
  if (!value) return null;
  const getrimmt = value.trim();
  return getrimmt.length > 0 ? getrimmt : null;
}

/**
 * Kopfzeilen-Name → Feld, tolerant gegenüber Groß-/Kleinschreibung und
 * Umlauten. Geteilt zwischen `csv-import.ts` und `xlsx-import.ts` – beide
 * liefern am Ende dieselbe Zellenmatrix (`string[][]`), nur der Weg dahin
 * unterscheidet sich (Text parsen vs. Arbeitsblatt lesen).
 */
const SPALTEN: Record<keyof Omit<ImportRow, "note">, string[]> = {
  date: ["datum"],
  subjectText: ["fach", "kurs"],
  typeText: ["art", "typ"],
  title: ["titel", "bezeichnung", "betreff"],
  displayName: ["anzeigename", "kurzname"],
  groupsText: ["gruppe", "gruppen", "klasse"],
};

function findeSpalten(kopfzeile: string[]): Partial<Record<keyof ImportRow, number>> {
  const normalisiert = kopfzeile.map(normalisiere);
  const treffer: Partial<Record<keyof ImportRow, number>> = {};
  for (const [feld, namen] of Object.entries(SPALTEN) as [keyof ImportRow, string[]][]) {
    const index = normalisiert.findIndex((s) => namen.includes(s));
    if (index >= 0) treffer[feld] = index;
  }
  const hinweisIndex = normalisiert.findIndex((s) => ["hinweis", "bemerkung", "notiz"].includes(s));
  if (hinweisIndex >= 0) treffer.note = hinweisIndex;
  return treffer;
}

export type MatrixImportErgebnis = { drafts: CalendarImportDraft[]; fehler: string[] };

/**
 * Eine Zellenmatrix (erste Zeile = Kopfzeile) → Entwürfe. Braucht mindestens
 * `Datum` und `Titel`/`Bezeichnung` in der Kopfzeile – fehlt eine der
 * beiden, bricht der Import mit einer verständlichen Meldung ab, statt zu
 * raten, welche Spalte gemeint war.
 */
export function matrixToDrafts(
  zeilen: readonly string[][],
  subjectNames: readonly string[],
): MatrixImportErgebnis {
  if (zeilen.length === 0) return { drafts: [], fehler: ["Die Datei enthält keine Zeilen."] };

  const [kopfzeile, ...datenzeilen] = zeilen;
  const spalten = findeSpalten(kopfzeile!);
  if (spalten.date === undefined || spalten.title === undefined) {
    return {
      drafts: [],
      fehler: ['Die Kopfzeile braucht mindestens die Spalten "Datum" und "Titel".'],
    };
  }

  const drafts: CalendarImportDraft[] = [];
  const fehler: string[] = [];

  datenzeilen.forEach((zelle, i) => {
    const feld = (index: number | undefined) =>
      index === undefined ? null : (zelle[index]?.trim() ?? null);
    const row: ImportRow = {
      date: feld(spalten.date),
      subjectText: feld(spalten.subjectText),
      typeText: feld(spalten.typeText),
      title: feld(spalten.title),
      displayName: feld(spalten.displayName),
      groupsText: feld(spalten.groupsText),
      note: feld(spalten.note),
    };
    const draft = draftFromRow(row, subjectNames);
    if (draft) {
      drafts.push(draft);
    } else {
      fehler.push(`Zeile ${i + 2}: Datum oder Titel fehlt oder ist ungültig.`);
    }
  });

  return { drafts, fehler };
}
