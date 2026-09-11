# ADR 0013: Der Tutor beginnt mit dem Dialog, nicht mit einem Formular

Status: **akzeptiert** · Datum: 2026-09-11 · Bezug: docs/konzept.md §4 (Einstieg 7), §5, §15
Ändert [ADR 0010](0010-tutor-architektur.md) D6 (`tutor_session.subject_id` ist `not null`).
Setzt [ADR 0011](0011-sprache-im-tutor.md) D3 fort („der Zustand gehört der App, nicht dem
Modell"). Tickets: T-13.

## Kontext

### 1. Der Auslöser

Aus dem Gerätetest, wörtlich:

> „Was im Tutor sehr cool wäre, wenn man gar keine Fachwahl durchführen müsste, sondern
> wir direkt mit dem Dialog starten und er unterdessen erkennt, in welchem Fach wir sind
> und den Dialog in der Historie ins passende Fach einsortiert – denn ich glaube, die
> Fächerübersicht ist hier schon sehr hilfreich, um etwas Struktur zu behalten."

Zwei Aussagen in einem Satz, und sie ziehen in verschiedene Richtungen: **Die Gruppierung
nach Fach soll bleiben. Die Frage nach dem Fach soll weg.** Das Fach muss also weiterhin
an der Session hängen – nur nicht mehr abgefragt, sondern hergeleitet werden.

### 2. Was heute im Weg steht

`/tutor` ist ein Formular, bevor es ein Gespräch ist:

| Schritt             | Was das Kind tun muss        | Was es dafür wissen muss                        |
| ------------------- | ---------------------------- | ----------------------------------------------- |
| Fach                | aus einer Liste wählen       | zu welchem Fach die Frage gehört                |
| Einstieg            | eine von drei Kacheln wählen | was „Verstehen" von „Freie Frage" unterscheidet |
| „Gespräch beginnen" | tippen                       | –                                               |

Drei Entscheidungen vor dem ersten Wort. Für das eine, das man eigentlich tun will –
fragen –, ist keine davon nötig:

- **Freie Frage und Verstehen** unterscheiden sich in der Umsetzung nur im Platzhaltertext
  und in einer Nuance des Systemprompts. Die Grenze verläuft nicht zwischen zwei
  Absichten des Kindes, sondern zwischen zwei Formulierungen derselben Absicht. Wer „ich
  hab das nicht kapiert" tippt, hat „Verstehen" schon gesagt.
- **Hausaufgabe** ist etwas anderes: ein eigener Ablauf (Foto → Aufgabenliste →
  Hinweisleiter → Lösung nach zwei Versuchen, §4a) mit eigener Route und eigenem Zustand.
  Das ist eine echte Weiche, keine Nuance – sie gehört aber an den Anfang der Handlung
  („ich fotografiere meine Hausaufgaben"), nicht in ein Auswahlfeld davor.

### 3. Warum das Fach trotzdem nicht wegfallen kann

Vier Dinge hängen heute daran, und keines davon ist verzichtbar:

1. **Der Sprachwächter** (ADR 0010 D3): Ob die Zielsprache in einer Antwort erlaubt ist,
   sagt `subject.language`. Ohne Fach keine Zielsprache.
2. **Die Fachtabelle aus §4a** (`lib/tutor/hausaufgabe-fach.ts`): Ein Rechenweg wird anders
   geprüft als ein Aufsatz.
3. **Die Historie**: §15 verlangt „Chatverlauf mit Titeln **pro Fach**" – genau die
   Struktur, die im Auslöser ausdrücklich erhalten bleiben soll.
4. **Die Schichten** (§10, T-01): Lehrwerk und Kurrikulum-Pack hängen am Fach.

Das Fach ist also keine Formalie, die man streichen kann. Es ist eine Angabe, die
**bisher erfragt wurde, weil niemand sie hergeleitet hat.**

### 4. Das Konzept sieht die Herleitung bereits vor

§4 beschreibt sieben Einstiege und sagt dazu: „Was sich ändert, ist der _Einstieg_ – den
bestimmt die Schülerin, nicht die App." Einstieg 7 („Freie Frage") lautet aber wörtlich:

> Antwortet, versucht das Thema zuzuordnen („gehört das zu …?"), sonst allgemeines Wissen
> mit Kennzeichnung.

Und am Ende von §4: „Kein ‚welches Thema meinst du?', wenn die App es schon weiß."

Die Zuordnung durch den Tutor steht also bereits in der Spezifikation – sie war nur als
Sonderfall eines Einstiegs gedacht, nicht als Normalfall der Tür. Dieser ADR dreht das
Verhältnis um: **Der freie Dialog ist die Tür, alles andere ist eine Abkürzung von
woanders her.** Die anderen Einstiege verschwinden nicht; sie kommen künftig aus dem
Kontext (Kamera auf „Heute", später Thema-Seite, Prüfung, Nachbereitung) statt aus einer
Kachelreihe vor dem Gespräch. Damit erfüllt §4 seinen eigenen Schlusssatz besser als
heute: Der Kontext wird übergeben, wenn es einen gibt, und nicht erfragt, wenn es keinen
gibt.

### 5. Der Konflikt mit ADR 0010 D6

ADR 0010 D6 legt `tutor_session.subject_id` als `not null` fest, mit der Begründung: „Ein
Fach ist Pflicht, weil ohne Fach weder Sprache (D3) noch spätere Schichten bestimmbar
sind."

Die Begründung bleibt richtig. Was sich ändert, ist der **Zeitpunkt**: Bisher musste das
Fach vor der ersten Nachricht feststehen, weil es nur eine Quelle dafür gab – die Wahl.
Wird es aus der ersten Nachricht erkannt, steht es erst **nach** der ersten Nachricht
fest. Zwischen „das Kind tippt" und „die Erkennung ist durch" gibt es ein Fenster, in dem
die Zeile existiert, aber noch kein Fach hat. Entweder man macht die Spalte nullbar, oder
man legt die Zeile erst nach der Erkennung an – und verliert damit den Anker, an dem die
erste Nachricht hängt.

## Entscheidung

### D1 · Der Tutor öffnet ein leeres Gespräch, kein Formular

`/tutor` zeigt weiterhin die Historie (nach Fach gruppiert) und darunter ein Eingabefeld.
Wer tippt und abschickt, ist im Gespräch. Keine Fachwahl, keine Einstiegs-Kacheln, kein
„Gespräch beginnen".

Die Kachelreihe entfällt ersatzlos: „Freie Frage" und „Verstehen" werden zu **einem**
Modus (`entry_point = 'freie_frage'`), weil sie sich nie anders verhalten haben.
„Hausaufgabe" bleibt als eigener Ablauf bestehen, erreichbar über die Kamera im Plus-Menü
des Eingabefelds und über den Kamera-Knopf auf „Heute" (H-01) – beides Wege, die mit der
Handlung beginnen statt mit ihrer Ankündigung.

### D2 · Das Fach wird erkannt, nicht geraten

Nach der ersten Nachricht des Kindes läuft ein **zweiter, kleiner Modellaufruf** (Haiku,
Structured Output gegen ein Zod-Schema in `src/ai/schemas/`), genau nach dem Muster von
`versuchUrteilSchema` (T-03).

Drei Eigenschaften, die nicht verhandelbar sind:

- **Die Auswahl ist geschlossen.** Der Aufruf bekommt die Fächer des Kindes im aktuellen
  Schuljahr als Liste und darf nur eine davon zurückgeben – oder `unklar`. Er erfindet
  kein Fach, legt keins an und wählt keins aus einem anderen Schuljahr. Fächer entstehen
  weiter nur dort, wo ADR 0009 sie vorsieht.
- **Die App liest ein Enum, nie einen Fließtext** (ADR 0011 D3). Der Hauptaufruf, der die
  Antwort schreibt, entscheidet nichts über den Zustand.
- **Es gibt einen ehrlichen Ausgang.** `unklar` ist ein erlaubtes Ergebnis, kein Fehler.
  Eine Frage wie „was ist der Unterschied zwischen Masse und Gewicht" gehört in mehrere
  Fächer, und eine erzwungene Entscheidung wäre schlechter als keine.

Kosten: ein Haiku-Aufruf je Gespräch, nur bei der ersten Nachricht, über denselben
`ai_usage`-Weg gezählt und gedeckelt wie alles andere (S-03c).

**Die Erkennung läuft _vor_ dem Streamen, nicht daneben.** Das kostet Wartezeit vor dem
ersten Wort und ist trotzdem richtig: Der Systemprompt braucht das Fach, weil `subject.language`
darüber entscheidet, ob die Zielsprache erlaubt ist. Liefe die Erkennung parallel, wäre
ausgerechnet die erste Antwort in einem Sprachenfach die schlechteste – „wie bilde ich das
passé composé" ohne ein einziges französisches Beispiel, weil D5 die Zielsprache noch
verbietet. Der Aufruf ist klein (ein Enum als Ausgabe) und läuft parallel zur
Datenbank-Vorarbeit derselben Anfrage; bleibt er trotzdem über der Drei-Sekunden-Marke aus
CLAUDE.md, gehört dorthin ein benannter Schritt („ordne das Fach zu"), kein Spinner.
Ab der zweiten Nachricht entfällt er ganz – das Fach steht dann in der Zeile.

### D3 · `tutor_session.subject_id` wird nullbar – als Übergang, nicht als Dauerzustand

Damit ist ADR 0010 D6 in diesem Punkt geändert. `null` heißt **„noch nicht einsortiert"**,
nicht „ohne Fach": ein Zustand für die Dauer einer Erkennung oder bis das Kind selbst
zuordnet (D4).

Der zusammengesetzte Fremdschlüssel `(subject_id, student_id) → subject (id, student_id)`
bleibt und wirkt weiterhin, wenn ein Wert gesetzt ist – `MATCH SIMPLE` lässt genau dann
durch, wenn eine Schlüsselspalte `null` ist; dasselbe Muster wie bei `topic_id` (ADR 0010)
und `vocab_set_item` (V-05). Die Mandantenbindung hängt an `student_id` und ist davon
unberührt.

### D4 · Der Chip ist ein Bedienelement, kein Etikett

Der Kontext-Chip „Fach › Thema" aus §15 zeigt weiterhin, worüber geredet wird – aber er
ist antippbar und ändert die Zuordnung. Drei Zustände:

| Zustand             | Chip zeigt    | Was ein Tippen tut |
| ------------------- | ------------- | ------------------ |
| erkannt             | den Fachnamen | Fach ändern        |
| `unklar`            | „Fach wählen" | Fach wählen        |
| noch nicht gelaufen | nichts        | –                  |

Das ist die Absicherung gegen eine falsche Erkennung, und sie ist billiger als jede
Verbesserung des Klassifikators: Wer die Zuordnung sofort sieht und in einem Tipp
korrigieren kann, verliert nichts. Eine stillschweigend falsche Einsortierung, die man nur
über einen Umweg wieder findet, wäre die schlechtere Variante von beidem.

### D5 · Ohne Fach gilt die strengste Sprachregel

Der Sprachwächter (ADR 0010 D3) erlaubt die Zielsprache nur, wenn `subject.language`
gesetzt ist. Solange kein Fach feststeht, gibt es keine Zielsprache und damit **kein**
Fremdsprachen-Zugeständnis: Die Antwort ist deutsch. Das ist die sichere Richtung – der
Fehler „hätte französische Beispiele bringen dürfen" ist harmlos, der Fehler „hat auf
Englisch geantwortet" ist der aus §15.

Für den Hausaufgaben-Ablauf gilt dasselbe, bis das Foto gelesen ist – siehe D7. Danach
steht das Fach fest, und die Fachtabelle aus §4a greift wie bisher.

### D6 · Die Historie bleibt nach Fach gruppiert

Genau der Teil, der im Auslöser ausdrücklich behalten werden soll. Sessions ohne Fach
stehen unter einer eigenen Überschrift („Noch nicht einsortiert") am Ende der Liste, statt
sich unter ein beliebiges Fach zu mischen. Ist die Gruppe leer – der Normalfall –,
erscheint sie nicht.

### D7 · Bei der Hausaufgabe kommt das Fach aus dem Foto, nicht aus einem zweiten Aufruf

Ohne die Fachwahl auf `/tutor` hätte auch der Hausaufgaben-Weg keine Quelle mehr für sein
Fach: `/tutor/hausaufgabe/neu` bekommt es heute als `?fach=` aus genau dem Auswahlfeld,
das D1 abschafft. Diese Lücke schließt nicht D2, sondern das Foto selbst.

Vision liest das Blatt ohnehin (§4a Schritt 1, `homeworkExtractionSchema`). Das Schema
bekommt ein Feld für das Fach dazu – mit denselben Regeln wie in D2: geschlossene Auswahl
aus den Fächern des Kindes, `unklar` erlaubt, kein Anlegen. **Kein zusätzlicher Aufruf und
keine zusätzlichen Kosten**, denn das Bild geht ohnehin durch das Modell; ein Aufgabenblatt
sagt sein Fach meist schon in der ersten Zeile.

Die Session der Hausaufgabe entsteht damit ebenfalls ohne Fach (D3) und bekommt es beim
ersten eingelesenen Foto. Für `hausaufgabeFachHinweis()` ändert sich nichts: Die Funktion
hat seit T-03 einen Fallback für unbekannte Fachnamen – „vorsichtige Vorgabe statt gar
keiner" –, und genau der greift bei `unklar`.

## Konsequenzen

**Gut:**

- Der Weg von „ich hab eine Frage" zur Frage ist ein Feld statt drei Entscheidungen.
- Das Fach steht weiterhin an jeder Session – die Struktur, die §15 verlangt und die
  gewollt ist, bleibt vollständig erhalten.
- Zwei Einstiege, die sich nie unterschiedlich verhalten haben, sind nicht mehr zwei.
- Der Zustand bleibt bei der App (ADR 0011 D3); die Erkennung ist ein eigener,
  strukturierter Aufruf und im Test einzeln prüfbar.
- Der Kontext-Chip wird von einer Anzeige zu einem Bedienelement – die Korrektur ist da,
  wo der Fehler sichtbar wird.

**Schlecht / Preis:**

- Eine nullbare Spalte mehr. Jeder Lesepfad muss den Fall „noch kein Fach" behandeln; das
  ist der Preis dafür, dass die Erkennung nach der ersten Nachricht kommt.
- Ein zusätzlicher Modellaufruf je Gespräch. Klein (Haiku, ein Enum), aber nicht gratis.
- Eine falsche Erkennung sortiert ein Gespräch ins falsche Fach. D4 macht das
  korrigierbar, nicht unmöglich.
- Migration nötig (`subject_id` von `not null` auf nullbar). Nach D-01 gilt: Migrationen
  werden nicht gelöscht, diese kommt oben drauf.

**Abweichung von der Spezifikation:** §4 beschreibt sieben Einstiege, die „die Schülerin
bestimmt". Nach diesem ADR bestimmt sie weiterhin – nur durch das, was sie schreibt oder
fotografiert, statt durch eine Kachel davor. Die Einstiege bleiben im `tutor_entry_point`-
Enum und als Kontext-Übergabe von anderen Bildschirmen erhalten (§5: „Einstiegs-Chips …
als **Abkürzung**"). `konzept.md` bleibt unverändert; dieser ADR ist die dokumentierte
Abweichung, wie ADR 0006 zur `Family`.

## Abgelehnte Alternativen

**Das Fach aus Schlüsselwörtern im Text raten.** Billig und ohne Modellaufruf – aber
„Integral" steht auch in einem Physiktext, und „Zelle" in Biologie wie in Chemie. Ein
Detektor, der oft danebenliegt, macht den Chip zur Fehlerquelle statt zur Struktur.

**Den Hauptaufruf das Fach mitnennen lassen.** Spart den zweiten Aufruf, verstößt aber
gegen ADR 0011 D3: Die App müsste den Zustand aus einem Fließtext lesen. Genau diese
Frage war bei T-03 schon entschieden, mit derselben Antwort.

**Ganz ohne Fach arbeiten.** Widerspricht §15 (Historie nach Fach), dem Sprachwächter und
dem ausdrücklichen Wunsch aus dem Auslöser, die Fächerstruktur zu behalten.

**Das Fach weiter abfragen, nur vorbelegt.** Etwa mit dem zuletzt benutzten Fach. Nimmt
die Entscheidung nicht weg, sondern macht sie nur unauffälliger – und eine unauffällige
falsche Vorbelegung ist schlechter als eine sichtbare Erkennung, die man antippen kann.

**Die Zeile erst nach der Erkennung anlegen** (und `not null` behalten). Dann hängt die
erste Nachricht an nichts, solange die Erkennung läuft: Entweder man hält sie im
Arbeitsspeicher (verloren bei jedem Abbruch) oder man wartet mit dem Streaming auf den
Klassifikator (der Spinner, den ADR 0010 D1 gerade abgeschafft hat).
