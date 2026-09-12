/**
 * Der Zweizeiler nach Abschluss einer Hausaufgaben-Session (T-03 PR 2, §4a
 * „Ansicht"): „5 Aufgaben, 4 selbst gelöst, 1 mit Lösung – Ungleichungen
 * üben wir morgen."
 *
 * **Die Bilanz zählt die App, nicht das Modell** (ADR 0011 D3) – jede der
 * drei Zahlen steht schon im `homework_task.status`. Nur der Halbsatz danach
 * kommt vom Modell (`ai/client.ts` `erzeugeHausaufgabenHinweis()`), rein als
 * Text übergeben statt selbst formuliert zu werden.
 */

export type HausaufgabeAusgang = "geloest" | "loesung_gezeigt" | "uebersprungen";

export type AufgabenBilanz = {
  gesamt: number;
  geloest: number;
  loesungGezeigt: number;
  uebersprungen: number;
};

/** Zählt eine abgeschlossene Aufgabenliste aus. Erwartet nur abgeschlossene Status (§4a: der Zweizeiler kommt erst, wenn jede Aufgabe so weit ist). */
export function bilanziere(aufgaben: { status: HausaufgabeAusgang }[]): AufgabenBilanz {
  return aufgaben.reduce<AufgabenBilanz>(
    (bilanz, aufgabe) => ({
      gesamt: bilanz.gesamt + 1,
      geloest: bilanz.geloest + (aufgabe.status === "geloest" ? 1 : 0),
      loesungGezeigt: bilanz.loesungGezeigt + (aufgabe.status === "loesung_gezeigt" ? 1 : 0),
      uebersprungen: bilanz.uebersprungen + (aufgabe.status === "uebersprungen" ? 1 : 0),
    }),
    { gesamt: 0, geloest: 0, loesungGezeigt: 0, uebersprungen: 0 },
  );
}

/**
 * Setzt Bilanz und Hinweis zum fertigen Satz zusammen – das Konzept-Beispiel
 * als Vorlage: „5 Aufgaben, 4 selbst gelöst, 1 mit Lösung – …". Eine Zahl,
 * die 0 ist, fällt aus der Aufzählung, statt „0 mit Lösung" mitzuschleppen.
 *
 * **Aussortierte zählen gar nicht mit** (T-17). Vorher zählten sie zu
 * „gesamt", bekamen aber keine eigene Klausel – aus „5 Aufgaben, 4 selbst
 * gelöst" wurde damit eine stille Lücke. Seit der Wisch „gehört nicht dazu"
 * heißt, ist klar, was so eine Zeile ist: keine Aufgabe, sondern ein
 * Merkkasten oder eine gestrichene Nummer, die Vision mitgelesen hat. Sie
 * gehört nicht in die Bilanz einer Hausaufgabe.
 */
export function zweizeiler(bilanz: AufgabenBilanz, hinweis: string): string {
  const echte = bilanz.gesamt - bilanz.uebersprungen;
  const teile = [`${echte} ${echte === 1 ? "Aufgabe" : "Aufgaben"}`];
  if (bilanz.geloest > 0) teile.push(`${bilanz.geloest} selbst gelöst`);
  if (bilanz.loesungGezeigt > 0) teile.push(`${bilanz.loesungGezeigt} mit Lösung`);

  const bereinigterHinweis = hinweis.trim().replace(/[.\s]+$/, "");
  return `${teile.join(", ")} – ${bereinigterHinweis}.`;
}
