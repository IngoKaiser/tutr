/**
 * Gleichmäßiger Textfluss beim Streamen (T-07).
 *
 * Das Modell liefert seine Antwort in Schüben: mal fünf Zeichen, mal
 * fünfzig. Direkt gerendert ruckelt das, und der Blick springt mit. Statt
 * die Ausgabe künstlich zu **bremsen** – das würde die Wartezeit bis zur
 * fertigen Antwort verlängern, für ein Kind mit einer Frage das falsche
 * Geschenk – wird sie **geglättet**: Der sichtbare Text holt den bereits
 * angekommenen mit einer festen Rate ein, immer schneller als der Nachschub.
 *
 * Rein und deshalb testbar: eine Funktion, die aus „was ist da" und „was ist
 * sichtbar" die nächste sichtbare Länge ausrechnet. Der Takt kommt aus dem
 * Hook, der sie aufruft.
 */

/** Anteil des Rückstands, der je Bild aufgeholt wird (60 fps → ~12 % pro 16 ms). */
const AUFHOLRATE = 0.12;
/** Mindestens so viele Zeichen je Bild, damit auch kurze Reste zügig durchlaufen. */
const MINDESTSCHRITT = 2;
/** Ist der Stream fertig, wird der Rest schneller nachgezogen – niemand wartet gern auf Nachzügler. */
const SCHLUSSRATE = 0.35;

/**
 * Die nächste sichtbare Länge.
 *
 * @param sichtbar wie viele Zeichen gerade stehen
 * @param ziel wie viele Zeichen angekommen sind
 * @param fertig ob der Stream abgeschlossen ist
 */
export function naechsteLaenge(sichtbar: number, ziel: number, fertig: boolean): number {
  // Ein Neustart (neue Antwort) oder eine Korrektur nach unten: sofort folgen.
  if (ziel <= sichtbar) return ziel;

  const rueckstand = ziel - sichtbar;
  const rate = fertig ? SCHLUSSRATE : AUFHOLRATE;
  const schritt = Math.max(MINDESTSCHRITT, Math.ceil(rueckstand * rate));
  return Math.min(ziel, sichtbar + schritt);
}

/** Steht alles, was angekommen ist? Dann darf die Schleife schlafen. */
export function istEingeholt(sichtbar: number, ziel: number): boolean {
  return sichtbar >= ziel;
}
