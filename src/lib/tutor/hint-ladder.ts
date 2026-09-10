/**
 * Der Hinweisleiter (T-03, Konzept §4a).
 *
 * §4a ist die eigentliche Produktentscheidung von tutr: keine Lösung vor
 * zwei dokumentierten Versuchen, nie zwei Hinweisstufen auf einmal, „Weiß
 * ich nicht" ist kein Versuch. Diese Regeln stehen hier als **Funktionen**,
 * nicht als Bitten im Systemprompt – ein Modell, das man um Zurückhaltung
 * bittet, gibt sie irgendwann auf; eine Rechenregel nicht.
 *
 * Das ist zugleich Bedingung 2 aus
 * [ADR 0011](../../../docs/adr/0011-sprache-im-tutor.md) D3 („Der Zustand
 * liegt in der App, nicht im Modell") – die Voraussetzung dafür, dass ein
 * Sprachdialog später überhaupt in Frage kommt.
 *
 * **Was die App entscheidet:** wie viele Versuche zählen, welche
 * Hinweisstufe erlaubt ist, ob die Lösung gezeigt werden darf.
 * **Was das Modell entscheidet:** ob ein Versuch inhaltlich richtig ist –
 * das kann nur es beurteilen. Deshalb gibt `naechsterZug()` einen
 * *Erlaubnisrahmen* zurück, keine fertige Antwort.
 */

export type HomeworkStatus =
  "offen" | "in_arbeit" | "geloest" | "loesung_gezeigt" | "uebersprungen";

export type AufgabenZustand = {
  status: HomeworkStatus;
  /** Dokumentierte Versuche. */
  attempts: number;
  /** Erreichte Hinweisstufe, 0–4. */
  hintLevel: number;
};

/**
 * Die zwei Bahnen an einer Aufgabe. §4a nennt sie nicht getrennt, aber sie
 * sind verschieden: Wer die Aufgabe nicht *versteht*, hat noch nichts
 * versucht – das darf nicht als Versuch zählen und die Leiter nicht
 * hochtreiben.
 */
export type Bahn = "verstehen" | "versuch";

export type Eingabe = {
  bahn: Bahn;
  /** Was getippt oder diktiert wurde. */
  text: string;
  /** Foto des Lösungswegs aus dem Heft – zählt immer als Versuch (§4a Schritt 2). */
  hatFoto: boolean;
  /** Das Kind hat die Lösung ausdrücklich verlangt. */
  loesungVerlangt: boolean;
};

export type Zug =
  /** Bahn 1: die Aufgabe erklären, ohne das Ergebnis zu nennen. */
  | { art: "aufgabe_erklaeren" }
  /** Bahn 2: Weg **und** Ergebnis prüfen. */
  | { art: "versuch_pruefen"; versuchNr: number; darfLoesungWennFalsch: boolean }
  /** Genau eine Stufe höher, nie zwei. */
  | { art: "hinweis"; stufe: 1 | 2 | 3 | 4 }
  /** Vollständiger Lösungsweg mit Begründung je Schritt. */
  | { art: "loesung_zeigen" };

/** Die höchste Stufe der Leiter (§4a: vier Stufen). */
export const MAX_STUFE = 4;

/**
 * Zählt die Eingabe als dokumentierter Versuch?
 *
 * §4a: „Ein ‚Versuch' zählt nur mit sichtbarem Lösungsweg (Foto oder Text).
 * ‚Weiß ich nicht' ist kein Versuch, sondern führt zur Hinweisleiter
 * Stufe 1." Ohne diese Prüfung wäre die Zwei-Versuche-Regel in zwei Klicks
 * ausgehebelt.
 */
export function zaehltAlsVersuch(text: string): boolean {
  const sauber = text.trim().toLowerCase();
  if (sauber.length < 3) return false;

  // **Wer ausführlich schreibt, hat etwas versucht.** Die Ausweich-Prüfung
  // gilt nur für kurze Eingaben – sonst würde „Ich hab x = 4, aber die
  // Probe geht nicht auf" an einem „nicht“ scheitern, obwohl genau das ein
  // vorbildlicher Versuch ist. Die Wortlisten unten dürfen deshalb locker
  // greifen, ohne echte Rechenwege zu treffen.
  if (sauber.length > AUSFUEHRLICH_AB) return true;

  // Ausweichende Antworten – der häufigste Weg, die Regel zu umgehen.
  const ausweichend = [
    /wei(ss|ß).*\bnicht\b/, // „weiß ich nicht“, „ich weiß es nicht“, „weiß nicht“
    /k(eine)? ?ahnung/,
    /^ka$/,
    /^kp$/,
    /^n(e+|ö|oe|ein)$/,
    /^hilfe[!.]*$/,
    /^\?+$/,
    /^(gar )?nichts?$/,
    /versteh(e)?( ich)? nicht/,
    /kann ich nicht/,
    /^sag('s| es) mir/,
    /^zeig('s| es|) mir/,
  ];
  return !ausweichend.some((muster) => muster.test(sauber));
}

/** Ab dieser Länge gilt eine Eingabe ohne weitere Prüfung als Versuch. */
const AUSFUEHRLICH_AB = 60;

/** Genau eine Stufe höher, gedeckelt bei 4 (§4a: „nie zwei auf einmal“). */
export function naechsteHinweisstufe(zustand: AufgabenZustand): 1 | 2 | 3 | 4 {
  const naechste = Math.min(zustand.hintLevel + 1, MAX_STUFE);
  return Math.max(naechste, 1) as 1 | 2 | 3 | 4;
}

/**
 * Darf der vollständige Lösungsweg gezeigt werden?
 *
 * §4a: „Wenn zwei dokumentierte Versuche daneben liegen (oder sie es nach
 * zwei Hinweisstufen ausdrücklich verlangt)."
 *
 * **Der zweite Teil ist ein Ventil, kein Versehen.** Wer nach zwei
 * Hinweisstufen ausdrücklich nach der Lösung fragt, bekommt sie – auch ohne
 * einen einzigen dokumentierten Versuch. Ohne dieses Ventil würde das
 * Werkzeug bei einem Kind, das wirklich nicht weiterkommt, zur Wand. Der
 * Preis bleibt sichtbar: `attempts` bleibt bei 0, und die Aufgabe wird als
 * **„Lösung gezeigt“** markiert, nie als „gelöst“.
 */
export function darfLoesungZeigen(zustand: AufgabenZustand, ausdruecklich: boolean): boolean {
  if (zustand.attempts >= 2) return true;
  return ausdruecklich && zustand.hintLevel >= 2;
}

/**
 * Was das Modell in diesem Zug tun darf. Der Erlaubnisrahmen, nicht die
 * Antwort selbst.
 */
export function naechsterZug(zustand: AufgabenZustand, eingabe: Eingabe): Zug {
  // Bahn 1 zählt nie als Versuch und treibt die Leiter nicht hoch: Wer die
  // Aufgabe nicht versteht, hat noch nichts probiert.
  if (eingabe.bahn === "verstehen") return { art: "aufgabe_erklaeren" };

  if (eingabe.loesungVerlangt && darfLoesungZeigen(zustand, true)) {
    return { art: "loesung_zeigen" };
  }

  const zaehlt = eingabe.hatFoto || zaehltAlsVersuch(eingabe.text);
  if (!zaehlt) {
    // „Weiß ich nicht“ → Hinweisleiter, nicht Versuchszähler (§4a).
    return { art: "hinweis", stufe: naechsteHinweisstufe(zustand) };
  }

  const versuchNr = zustand.attempts + 1;
  return {
    art: "versuch_pruefen",
    versuchNr,
    // Erst wenn dieser Versuch der zweite ist und danebenliegt, darf die
    // Lösung kommen. Ob er danebenliegt, beurteilt das Modell.
    darfLoesungWennFalsch: versuchNr >= 2,
  };
}

/** Der Zustand nach dem Zug. Reiner Reducer – die Datenbank schreibt das Ergebnis. */
export function folgeZustand(zustand: AufgabenZustand, zug: Zug): AufgabenZustand {
  const inArbeit = zustand.status === "offen" ? "in_arbeit" : zustand.status;

  switch (zug.art) {
    case "aufgabe_erklaeren":
      return { ...zustand, status: inArbeit };
    case "hinweis":
      return { ...zustand, status: inArbeit, hintLevel: zug.stufe };
    case "versuch_pruefen":
      return { ...zustand, status: inArbeit, attempts: zug.versuchNr };
    case "loesung_zeigen":
      // Ausdrücklich **nicht** „geloest“ (§4a): Die Aufgabe wird als
      // „Lösung gezeigt“ markiert, nicht als gelöst.
      return { ...zustand, status: "loesung_gezeigt" };
  }
}

/**
 * Ist die Aufgabe abgeschlossen? Nur das Kind schließt sie ab („gelöst“,
 * „übersprungen“) – oder die gezeigte Lösung tut es.
 */
export function istAbgeschlossen(zustand: AufgabenZustand): boolean {
  return (
    zustand.status === "geloest" ||
    zustand.status === "loesung_gezeigt" ||
    zustand.status === "uebersprungen"
  );
}
