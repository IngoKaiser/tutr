/**
 * Die Suche im Gesprächs-Archiv (T-19c, ADR 0014 D3).
 *
 * **Läuft im Browser**, nicht über die Datenbank: Die Seite hat die Liste
 * ohnehin schon vollständig (`loadAlleGespraeche()`), und eine Server-Suche
 * bräuchte für dieselbe Antwort einen Rundlauf je Tastendruck.
 *
 * Hier sucht ein Mensch – deshalb wird großzügig verglichen: ohne Rücksicht
 * auf Groß-/Kleinschreibung und diakritische Zeichen. Das ist das Gegenteil
 * von `loeseFachZuordnungAuf()` nebenan, wo genau **nicht** geraten werden
 * darf: Dort entscheidet eine Maschine über eine Zuordnung, hier sucht jemand
 * etwas, das er selbst geschrieben hat.
 */

/** Was die Suche durchsieht – die Felder, die in der Liste auch sichtbar sind. */
export type DurchsuchbaresGespraech = {
  title: string;
  subjectName: string | null;
};

/**
 * Kleinschreibung ohne diakritische Zeichen: „franzosisch" findet
 * „Französisch", „MATHE" findet „Mathematik".
 *
 * `NFD` zerlegt „ö" in „o" plus Trema, `\u0300`–`\u036f` wirft das Trema weg.
 * Für „ß" greift das nicht – das ist ein eigener Buchstabe, keine
 * Zusammensetzung –, deshalb steht es davor von Hand da: Wer „strasse" tippt,
 * meint „Straße".
 */
export function normalisiere(wert: string): string {
  return wert
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Filtert über Titel **und** Fach: „Französisch" findet damit alles aus dem
 * Fach, auch wenn kein einziger Titel das Wort enthält.
 *
 * Ein leerer Begriff gibt alles zurück – „nichts gesucht" ist nicht dasselbe
 * wie „nichts gefunden".
 */
export function filtereGespraeche<T extends DurchsuchbaresGespraech>(
  gespraeche: readonly T[],
  suche: string,
): T[] {
  const begriff = normalisiere(suche);
  if (begriff.length === 0) return [...gespraeche];
  return gespraeche.filter(
    (g) =>
      normalisiere(g.title).includes(begriff) ||
      (g.subjectName !== null && normalisiere(g.subjectName).includes(begriff)),
  );
}
