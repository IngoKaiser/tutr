# ADR 0019: Fotos bleiben – verkleinert, und nur dort, wo sie nach der Durchsicht noch etwas bedeuten

Status: **akzeptiert** · Datum: 2026-09-12 · Bezug: docs/konzept.md §10 (Material), §11 (Storage,
Datenschutz), §6 M2
Grenzt [ADR 0007](0007-vokabeleingabe-und-pflege.md) D6 („Das Foto wird nicht gespeichert") auf
den Vokabelweg ein – Nachtrag dort. Setzt [ADR 0012](0012-eltern-sehen-was-nicht-wie-gut.md) für
Bilder um (D4). Baut auf [ADR 0017](0017-materialtiefe-und-kontextpaket.md) D2 (Material entsteht
aus dem, was ohnehin durchläuft). Tickets: M-01, T-22 (neu), K-03/L-01 (unverändert).

## Kontext

ADR 0007 D6 hat für den Vokabel-Import entschieden: „Erkennen, durchsehen, verwerfen." Begründet
mit drei Punkten – keine Storage-Abhängigkeit, Datensparsamkeit, und „ist die Erkennung schlecht,
kostet ein neues Foto zehn Sekunden".

Inzwischen gilt zweierlei anderes:

1. **ADR 0017 D2** macht Fotos zur Quelle von Schicht-1-Material. Ein Foto der Hausaufgabe ist
   nicht mehr nur Eingabe für eine Erkennung, sondern der Gegenstand eines Gesprächs.
2. **`tutor_message` hat keine Bildspalte.** Das Foto geht inline an das Modell und ist weg: Der
   Verlauf, den `bereiteVor()` aus der Datenbank lädt, ist reiner Text. Schon die zweite Frage
   desselben Gesprächs („und was ist mit Aufgabe c?") trifft auf ein Modell, das das Bild nicht
   mehr sieht. Das ist keine Schönheitsfrage, sondern ein Funktionsverlust.

Zugleich ist der Datenschutzgrund von damals weitgehend eingelöst, ohne dass es jemand gemerkt
hat: `prepareImageForUpload()` (`src/lib/image.ts`) zeichnet jedes Bild über ein Canvas neu und
wirft dabei **alle EXIF-Daten weg** – Aufnahmeort und Gerätekennung bleiben auf dem Telefon.

## Die entscheidende Frage

Nicht „Foto aufheben: ja oder nein", sondern:

> **Geht der Informationsgehalt des Bildes nach der Durchsicht restlos in die Daten über?**

Wo ja, ist das Bild Abfall. Wo nein, ist sein Wegwerfen ein Datenverlust.

## Entscheidung

### D1 · Aufgehoben wird, was nicht in Daten aufgeht – oder nicht wiederbeschaffbar ist

| Weg                                    | Was das Bild nach der Durchsicht noch ist                                                              | Entscheidung                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------- |
| **Tutor-Chat mit Foto** (T-13)         | der Gesprächsgegenstand – die Antwort ist ohne das Bild nicht verständlich                             | **aufheben**                            |
| **Hausaufgabe** (T-03)                 | Skizzen, Tabellen, Diagramme, die `homework_task.prompt` nicht trägt                                   | **aufheben**                            |
| **Material am Thema** (M-01)           | Schicht-1-Wahrheit, wird wieder gelesen                                                                | **aufheben**                            |
| **Korrigierte Arbeit** (P-05)          | Beleg der Fehlerklassifikation, Muster der Lehrkraft                                                   | **aufheben**                            |
| **Vokabelfoto** (V-03b)                | nichts – die Liste tritt vollständig an seine Stelle, jede Zeile einzeln korrigierbar                  | **verwerfen** (ADR 0007 D6 gilt weiter) |
| **Klausurplan** (K-03)                 | nichts – die Events sind die Wahrheit und editierbar; dazu stehen fremde Gruppen und Lehrkräfte darauf | **verwerfen**                           |
| **Lehrwerk-Inhaltsverzeichnis** (L-01) | nichts – und ein gedrucktes Buch ist jederzeit neu fotografierbar                                      | **verwerfen**                           |

Die beiden letzten Zeilen sind der klarste Fall: Der Klausurplan ist die Zeile mit dem
schlechtesten Verhältnis überhaupt – **kein Restwert, aber die meisten Daten Dritter**. Beim
Lehrwerk ist der Restwert ebenso null, und anders als ein Hefteintrag vom 9. September lässt sich
eine Buchseite jederzeit erneut aufnehmen.

### D2 · Gespeichert wird nur die verkleinerte Fassung

`prepareImageForUpload()` liefert bereits, was abgelegt werden soll: lange Kante 1568 px,
JPEG q0,8, ohne EXIF – aus 2–5 MB werden 200–400 KB. **Kein Original, kein zweites Format.** Das
OCR passiert einmal beim Import, das Ansehen braucht keine 12 Megapixel.

Größenordnung: großzügig gerechnete 1000 Bilder je Kind und Schuljahr ergeben rund **250 MB pro
Jahr** – im Supabase-Free-Tarif (1 GB) tragbar, im Pro-Tarif (100 GB inklusive, 0,021 $/GB darüber)
belanglos. Unkomprimiert wären es rund 4 GB im Jahr; die Komprimierung ist also die Bedingung,
unter der das Aufheben überhaupt billig ist.

WebP spart gegenüber JPEG noch einmal rund ein Viertel, ändert aber `PreparedImage.mediaType`,
den die Claude-Anbindung mitliest. Vertagt als Notiz an M-01 – ein Pfad ohne Risiko ist jetzt mehr
wert als 25 % weniger Bytes.

### D3 · Bilder werden im Tutor-Verlauf sichtbar – und gehen wieder mit ins Modell

`tutor_message` bekommt einen Verweis auf das abgelegte Bild. Zwei Folgen, die zusammengehören:

- **Sichtbar:** Die Sprechblase zeigt eine Vorschau, ein Tipp öffnet sie groß – so, wie man es von
  jedem Chat kennt, in dem man ein Foto geschickt hat.
- **Wirksam:** Der Verlauf, den `bereiteVor()` zusammenstellt, trägt das Bild wieder mit. Erst
  damit funktioniert die Rückfrage im selben Gespräch.

Ticket **T-22**. Der Deckel aus ADR 0010 gilt weiter: Ein Verlauf mit vielen Bildern wird teuer,
also gehen nur die Bilder der letzten Runden mit, ältere bleiben sichtbar, aber ohne Modellbezug.

### D4 · Die Sichtbarkeit erbt das Bild von seiner Herkunft, nicht von seinem Ablageort

Sonst entsteht ein Leck: Material am Thema ist Stoffplan und damit für Eltern sichtbar
(ADR 0012), ein Foto aus einer Hausaufgabensitzung ist Protokoll und für Eltern **nie** sichtbar
(ADR 0004 D4). Beide landen unter M-01 in derselben Tabelle.

Deshalb trägt jedes Bild ein Herkunftsfeld (`tutor` · `hausaufgabe` · `material` · `arbeit`), und
die Policy entscheidet danach – nicht danach, an welchem Thema es hängt. Im Zweifel gilt die
engere Sicht.

### D5 · Aufbewahrung

- **Über das Schuljahr hinaus**, denn §9 verlangt, dass Materialien für den Tutor durchsuchbar
  bleiben (Grundlagen-Diagnose greift auf Vorjahres-Lernziele zu).
- **Mit dem Gespräch weg:** Löscht sie ein Tutor-Gespräch (T-15), verschwinden seine Bilder mit –
  sonst bleibt sichtbar, was sie gelöscht hat.
- **Mit dem Konto weg:** Kontolöschung (F-06e) nimmt den Storage-Pfad mit, wie sie es heute mit
  den Zeilen tut.
- EU-Bucket (Frankfurt), Pfade je `student_id`, signierte URLs mit kurzer Gültigkeit – wie in
  M-01 ohnehin vorgesehen.

## Konsequenzen

- **M-01** legt die Bilder ab (D1–D2), führt das Herkunftsfeld ein (D4) und entscheidet die
  Storage-Policies.
- **T-22** (neu) macht sie im Chat sichtbar und im Verlauf wieder wirksam.
- **K-03** und **L-01** bleiben unverändert – sie verwerfen weiter, und das ist jetzt begründet
  statt nur vorläufig.
- **ADR 0007 D6** gilt für Vokabeln unverändert weiter; der Nachtrag dort hält fest, dass die
  Regel nicht mehr für alle Wege gilt.

## Abgelehnte Alternativen

**Alles aufheben, auch Klausurplan und Lehrwerk.** Einfacher zu bauen (eine Regel statt einer
Tabelle) und billiger zu erklären. Verworfen: Der Klausurplan trägt die Daten einer ganzen
Jahrgangsstufe, und für beide gibt es nach der Durchsicht keinen Grund, sie noch einmal
anzusehen. Datensparsamkeit ist kein Prinzip, dem man aus Bequemlichkeit widerspricht.

**Original plus Ansichtsgröße.** Das Sechzehnfache an Speicher für einen Fall, den es nicht gibt:
Neu erkannt wird nie, und angesehen wird auf einem Telefonbildschirm.

**Bilder nur im Tutor, nicht als Material.** Hätte die Storage-Frage auf einen Ort begrenzt.
Verworfen, weil ADR 0017 D2 genau davon lebt, dass das Foto der Hausaufgabe am Thema landet – und
weil dieselbe Datei dann zweimal existieren müsste.
