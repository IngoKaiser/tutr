# ADR 0007: Vokabeln kommen aus drei Türen in einen Raum

Status: **akzeptiert** · Datum: 2026-09-08 · Bezug: docs/konzept.md §6 M4
Baut auf dem Schema aus V-01 auf ([ADR 0004](0004-datenmodell-rls.md) D5, ADR 0006 D2).

## Kontext

V-01 hat das Schema gebaut, V-02 baut die Übungssession — dazwischen steht die Frage, die
beides erst nützlich macht: **Wie kommen die Vokabeln überhaupt hinein, und was passiert,
wenn etwas falsch drin steht?**

§6 M4 nennt den Foto-Import und einen „Review-Screen mit Duplikaterkennung", lässt aber
offen, welche Eingabewege es sonst gibt und wie später korrigiert wird. Genau daran
entscheidet sich, ob die App im Alltag benutzt wird: Eine Vokabelliste hat 40 Zeilen, und
niemand tippt die ab.

## Die entscheidende Beobachtung

**Es sind nicht vier Eingabewege, sondern drei Türen in denselben Raum.** Foto, Einfügen
und manuelle Eingabe unterscheiden sich nur darin, wie die Zeilen entstehen. Danach ist
die Aufgabe identisch: durchsehen, korrigieren, speichern. Der Raum — die Liste — ist das
eigentliche Stück Arbeit; die Vision-Anbindung ist der kleinere Teil.

Daraus folgt der Rest fast von selbst.

## Entscheidung

### D1 · Drei Eingabewege, kein Datei-Import

| Weg           | Wie                                                                  |
| ------------- | -------------------------------------------------------------------- |
| Foto / Kamera | `<input type="file" accept="image/*">`, mit `capture` für die Kamera |
| Einfügen      | Textfeld, Trennzeichen automatisch erkannt                           |
| Manuell       | eine leere Zeile in derselben Liste                                  |

**Foto und Kamera sind ein Weg, nicht zwei:** Dasselbe Eingabefeld, einmal mit und einmal
ohne `capture="environment"`. Am Handy öffnet das eine direkt die Kamera, das andere die
Mediathek; am Rechner ist `capture` wirkungslos. Mehrere Bilder auf einmal sind erlaubt —
eine Vokabelliste geht oft über eine Doppelseite.

**CSV- und XLSX-Import entfallen.** Wer eine Tabelle hat, markiert die Zellen und kopiert
sie; im Clipboard liegt tabgetrennter Text. Ein Einfügefeld, das Tab, Semikolon, Komma
und „ – " versteht, deckt damit Excel, Google Sheets, Word-Tabellen und getippte Listen
ab — ohne Datei-Upload, ohne Spaltenzuordnung, ohne neue Abhängigkeit (XLSX bräuchte
eine). Wer die Datei-Variante je vermisst, bekommt ein eigenes kleines Ticket; bis dahin
ist sie Aufwand ohne Abnehmer.

**Handschrift ist der schwere Fall, nicht das Buchfoto.** Ein Vokabelheft wird schlechter
erkannt als eine gedruckte Seite. Das ist kein Grund gegen den Foto-Weg, sondern der
Grund, warum D2 so aussieht, wie es aussieht.

### D2 · Eine Liste, kein Review-Screen — und keine Tabelle

Nach dem Import gibt es **keine eigene Prüfansicht**. Es gibt die Set-Ansicht, in der die
neuen Zeilen als ungeprüft markiert sind. Eine Ansicht, ein Denkmodell; Korrigieren
funktioniert drei Wochen später genauso wie am Importtag.

Und es ist **keine Tabelle**. Ein vierspaltiges Bearbeitungsraster ist auf dem Handy —
dem Hauptgerät der Zielgruppe — schlecht bedienbar: winzige Tippziele, Querscrollen.
Vor allem beschreibt „Tabelle" die falsche Aufgabe. Die Aufgabe ist nicht „40 Zeilen
bearbeiten", sondern **„die drei kaputten finden"**; bei einem sauberen Buchfoto sind 37
von 40 richtig. Also:

- vertikale Liste, eine Vokabel je Zeile, zweizeilig (Wort / Übersetzung);
- **unsichere Zeilen stehen oben und sind markiert** — leeres Feld, seltsame Zeichen,
  niedrige Konfidenz der Erkennung. Dahin gehört der Blick, nicht auf die 37 richtigen;
- Antippen klappt die Zeile zum Bearbeiten auf, Verlassen speichert;
- eine ehrliche Ansage statt einer Pflichtdurchsicht: „3 Zeilen solltest du prüfen", und
  ein Knopf, der den Rest in einem Schritt übernimmt.

Löschen ist nur für Zeilen, die gar keine Vokabel sind (Seitenzahl, Überschrift). Der
Normalfall ist Bearbeiten an Ort und Stelle.

### D3 · Eine Korrektur am Inhalt rührt den Lernstand nicht an

`vocab_item` ist der **Inhalt**, `card` die **Terminplanung** (V-01). Wer einen Tippfehler
korrigiert, macht die bisherigen Wiederholungen nicht wertlos — der FSRS-Zustand bleibt
unverändert.

Die Alternative wäre, bei Änderungen den Fortschritt zurückzusetzen. Sie müsste raten, was
„nur ein Tippfehler" und was „ein anderes Wort" ist, und würde im Zweifel stillschweigend
Lernhistorie vernichten. Wer wirklich neu anfangen will, löscht den Eintrag.

**Eine Ausnahme:** Werden Wort und Übersetzung **vertauscht**, tauschen die beiden Karten
ihre FSRS-Zustände mit. Sonst säße der Fortschritt von „FR→DE" anschließend auf „DE→FR".

### D4 · Duplikat heißt „zweimal derselbe Eintrag", nicht „in zwei Sets"

Eine Vokabel in mehreren Sets ist der Normalfall und der Grund für die n:m-Tabelle
`vocab_set_item` aus V-01. Ein Duplikat ist nur derselbe Eintrag als zwei Zeilen.

- **Wort und Übersetzung identisch** → nichts Neues anlegen, der bestehende Eintrag
  bekommt die zusätzliche Set-Mitgliedschaft. Sein Lernstand bleibt vollständig erhalten.
- **Wort gleich, Übersetzung anders** („la fenêtre → das Fenster" vs. „→ Fenster") → nicht
  automatisch zusammenführen, sondern in der Liste anzeigen und den Menschen entscheiden
  lassen.

Die Erkennung läuft automatisch vor der Durchsicht; die Entscheidung nicht.

### D5 · Richtung ist wählbar, Reihenfolge ist zufällig

V-01 legt je Vokabel zwei Karten an (`vorwaerts`/`rueckwaerts`), deshalb kostet das kaum
etwas: Eine Session läuft wahlweise nur FR→DE, nur DE→FR oder gemischt. **Gemischt ist
die Voreinstellung** — „fällig heute" mischt ohnehin, weil FSRS beide Richtungen
unabhängig terminiert.

**Die Reihenfolge wird bei jedem Session-Start neu gemischt.** Eine feste Reihenfolge
führt zu Serienlernen: Man merkt sich die Position in der Liste statt das Wort, und in der
Klassenarbeit steht es woanders.

**Die beiden Richtungen derselben Vokabel halten Abstand.** Wer gerade „la fenêtre → das
Fenster" beantwortet hat und unmittelbar danach „das Fenster → ?" bekommt, wird nicht
geprüft, sondern schreibt ab.

### D6 · Das Foto wird nicht gespeichert

Erkennen, durchsehen, verwerfen. Das hält den Import frei von der Storage-Abhängigkeit
(M-01) und ist die datensparsamere Voreinstellung — ein Foto aus dem Vokabelheft eines
Kindes soll nicht ohne Not liegen bleiben. Ist die Erkennung schlecht, kostet ein neues
Foto zehn Sekunden.

## Konsequenzen

- **V-03 wird geteilt:** V-03a (Sets und Vokabelverwaltung, ohne KI) und V-03b (Foto und
  Kamera über Vision in dieselbe Liste). Die Liste aus D2 ist die Grundlage für beides.
- **V-02 bekommt D5 dazu:** Richtungswahl, Mischen, Geschwisterabstand.
- **Kein neues Schema.** D1–D6 kommen mit `vocab_set`, `vocab_item`, `vocab_set_item`,
  `card` und `review` aus V-01 aus. Die Konfidenz-Markierung aus D2 ist ein Zustand der
  Ansicht nach dem Import, keine Spalte — sie wäre nach der ersten Durchsicht ohnehin
  wertlos (ADR 0006 D7: was sich ableiten lässt, wird nicht gespeichert).
- **Bewusst nicht gebaut:** Vokabeln zwischen Sets verschieben, Massen-Bearbeitung
  einzelner Felder, Datei-Import. Alle drei sind nachrüstbar, wenn sich zeigt, dass sie
  fehlen; keiner von ihnen hat heute einen Abnehmer.
