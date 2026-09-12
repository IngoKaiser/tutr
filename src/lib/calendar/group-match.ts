/**
 * Gruppenfilter für den Kalender-Import (K-02b, ADR 0016 D3).
 *
 * Rein: kennt keine Datenbank. `ownGroups` kommt aus `school_year.own_groups`
 * (oder, solange das noch leer ist, aus der Einrichtung in K-02c) –
 * `matchesOwnGroups()` trifft dazu keine Annahme, sie vergleicht nur zwei
 * Listen von Strings.
 *
 * Liefert nur die Gruppen-Hälfte von `CalendarImportDraft.relevant` (siehe
 * dort): Ob eine Zeile trotz passender Gruppe überhaupt Lernbezug hat (§6 M7:
 * „Tag der offenen Tür" trifft niemandes Gruppe nicht, hat aber trotzdem
 * keinen), entscheidet die Erkennung, nicht diese Funktion.
 */

function normalizeToken(token: string): string {
  return token.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Ein Rohtoken kann eine Liste („8.1, 8.3") oder einen Bereich („8.1-8.5",
 * „8.1–8.5") enthalten. Vision neigt dazu, Bereiche schon beim Erkennen
 * auszuschreiben (siehe `docs/fixtures/beispiel-import-klausurplan.json` –
 * dort stehen `gruppen` immer schon als einzelne Klassen), aber der
 * Datei-Kanal (K-04) liest eine CSV-Zelle wörtlich. Alles andere (z. B.
 * „8.5 Eng") bleibt unverändert – nur ein exaktes `Zahl.Zahl-Zahl.Zahl"-
 * Muster mit gleicher Klassenzahl auf beiden Seiten gilt als Bereich.
 */
export function expandGroupToken(raw: string): string[] {
  return raw
    .split(",")
    .map((teil) => teil.trim())
    .filter((teil) => teil.length > 0)
    .flatMap((teil) => {
      const bereich = /^(\d+)\.(\d+)\s*[-–]\s*(\d+)\.(\d+)$/.exec(teil);
      if (!bereich) return [teil];
      const [, klasse, vonStr, klasseBis, bisStr] = bereich as unknown as [
        string,
        string,
        string,
        string,
        string,
      ];
      if (klasse !== klasseBis) return [teil]; // "8.1-9.2" ergibt keinen Sinn, unverändert lassen
      const von = Number(vonStr);
      const bis = Number(bisStr);
      if (!(von <= bis)) return [teil];
      return Array.from({ length: bis - von + 1 }, (_, i) => `${klasse}.${von + i}`);
    });
}

/**
 * Betrifft eine Zeile mit diesen Gruppentokens das Kind? Leere `rawGroups`
 * heißen „betrifft alle" (z. B. Blocker ohne Klassenbezug), nicht „betrifft
 * niemanden".
 */
export function matchesOwnGroups(rawGroups: string[], ownGroups: string[]): boolean {
  if (rawGroups.length === 0) return true;
  const eigene = new Set(ownGroups.flatMap(expandGroupToken).map(normalizeToken));
  return rawGroups
    .flatMap(expandGroupToken)
    .map(normalizeToken)
    .some((token) => eigene.has(token));
}
