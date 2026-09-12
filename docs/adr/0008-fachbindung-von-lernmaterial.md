# ADR 0008: Ein Fach ist ein Raum, kein Filter

Status: **akzeptiert** · Datum: 2026-09-09 · Bezug: docs/konzept.md §6 M4, §10
Schärft [ADR 0006](0006-student-als-mandant.md) D7 und setzt das Muster aus
[ADR 0004](0004-datenmodell-rls.md) D2/D3 eine Ebene tiefer fort.

## Kontext

V-03a hat die Vokabelverwaltung gebaut und dabei sichtbar gemacht, dass die Fachbindung
nur auf halber Strecke existiert:

| Ebene        | trägt ein Fach?                                                      |
| ------------ | -------------------------------------------------------------------- |
| `vocab_set`  | **ja** — `subject_id not null`, zusammengesetzter FK gegen `subject` |
| `vocab_item` | nein — die Zuordnung ist n:m über `vocab_set_item`                   |
| `card`       | nein — hängt an `vocab_item`                                         |

Die Verwaltung ist also fachsauber, das Üben nicht. `loadQueue()` lädt
`where due_at <= now()` über alle Fächer, die Falschantworten für Multiple Choice ziehen
aus genau diesem gemischten Vorrat, und die Duplikaterkennung aus V-03a vergleicht gegen
alle Vokabeln des Kindes — englisch `sport/Sport` und französisch `sport/Sport` gelten ihr
als derselbe Eintrag.

Heute fällt das nicht auf, weil nur Französisch benutzt wird. Es fällt in dem Moment auf,
in dem die zweite Sprache dazukommt — und das ist bei einem Kind mit Englisch, Französisch
und womöglich Spanisch der Normalfall, nicht der Randfall.

## Die entscheidende Festlegung

**Ein Fachmix ist nie sinnvoll.** Niemand lernt Französisch- und Spanischvokabeln in
derselben Runde; niemand will in einer Übungssession zwischen Biologie und Mathematik
springen. Das gilt über Vokabeln hinaus für jeden Lerninhalt.

Daraus folgt: Das Fach ist **kein Filter, den man abschalten kann, sondern der Raum, in
dem eine Übung stattfindet.** Es gibt keinen Zustand „ohne Fach". Diese Umkehrung ist der
eigentliche Inhalt dieses ADR — alles Weitere ist ihre technische Folge.

## Entscheidung

### D1 · Gespeichert wird das Fach nur dort, wo die Ableitung mehrdeutig wäre

ADR 0006 D7 sagt: Was sich ableiten lässt, wird nicht gespeichert. Das bleibt gültig und
wird hier **geschärft, nicht widerrufen**:

> Das Fach wird abgeleitet, wo die Ableitung eindeutig ist (n:1), und gespeichert, wo sie
> es nicht ist (n:m).

Angewandt auf das bestehende Schema ergibt das genau **eine** neue Spalte:

| Tabelle       | Weg zum Fach                                | Folge                     |
| ------------- | ------------------------------------------- | ------------------------- |
| `vocab_set`   | eigene Spalte (heute schon)                 | unverändert               |
| `vocab_item`  | über `vocab_set_item` → **n:m, mehrdeutig** | **`subject_id not null`** |
| `card`        | über `vocab_item` → n:1                     | keine Spalte              |
| `card` (M-03) | über `objective → topic → subject` → n:1    | keine Spalte              |

`card` bekommt bewusst keine Spalte: Sobald `vocab_item` ein Fach trägt, ist der Weg
dorthin ein einzelner Join über einen indizierten Fremdschlüssel, ohne Mehrdeutigkeit.
Eine Spiegel-Spalte wäre hier Spekulation auf eine Last, die es nicht gibt — anders als
bei `due_at`/`state`, die aus einem JSONB-Feld gespiegelt werden, weil man auf JSONB nicht
sinnvoll indiziert.

**Ein zweites Argument für die Spalte auf `vocab_item`:** `deleteSet()` löscht das Set und
lässt die Vokabeln stehen (V-03a). Eine Vokabel kann also in null Sets stecken — dann gibt
es gar keinen Weg, aus dem sie ihr Fach ableiten könnte. Die reine Ableitung scheitert an
diesem Fall vollständig, nicht nur mehrdeutig.

### D2 · Die Übereinstimmung erzwingt die Datenbank, nicht der Anwendungscode

Eine gespeicherte Wahrheit neben einer ableitbaren driftet — es sei denn, die Struktur
verbietet es. Sie kann es, mit demselben Kniff, der `student_id` mandantensicher macht
(ADR 0004 D2): **Die Verknüpfungstabelle trägt die Unterscheidungsspalte und bindet beide
Seiten dagegen.**

```
vocab_set   unique (id, student_id, subject_id)
vocab_item  unique (id, student_id, subject_id)

vocab_set_item
  subject_id not null
  fk (vocab_set_id,  student_id, subject_id) → vocab_set  (id, student_id, subject_id)
  fk (vocab_item_id, student_id, subject_id) → vocab_item (id, student_id, subject_id)
```

Damit ist eine französische Vokabel in einem spanischen Set **strukturell unmöglich** —
kein Check im Anwendungscode, keine Prüfung, die man vergessen kann. Die beiden bisherigen
Fremdschlüssel auf `vocab_set_item` werden dabei ersetzt, nicht ergänzt: Die neuen tragen
die alte Zusicherung mit.

### D3 · Jede Übungssession läuft in genau einem Fach

- `/ueben` zeigt fällige Karten **je Fach**, nicht eine Zahl über alles.
- Eine Session ohne gewähltes Fach gibt es nicht.
- Die Warteschlangen-Abfrage bekommt das Fach als Bedingung.
- Die Falschantworten für Multiple Choice ziehen aus dem Vorrat der Session — der ist
  damit von selbst einsprachig, ohne eigene Regel.

**„Mix" in V-04 heißt: Kartenarten mischen, nicht Fächer.** Das Ticket ist entsprechend zu
lesen.

### D4 · Duplikat heißt: dasselbe Wort im selben Fach

ADR 0007 D4 bleibt gültig und bekommt seinen Rahmen: „Zweimal derselbe Eintrag" wird
innerhalb eines Fachs beurteilt. `sport/Sport` in Englisch und `sport/Sport` in
Französisch sind zwei Vokabeln mit zwei Lernständen, keine Dublette.

### D5 · Die Regel gilt für alles, was geübt wird

Dieser ADR entscheidet für Vokabeln, weil dort gerade gebaut wird. Die Festlegung gilt
aber für jeden Lerninhalt: M-03 (Karten aus Material) und K-01 (Kalender/Prüfungen) legen
keine fachübergreifenden Übungswege an. Wo dort ein Fach nötig ist, wird es abgeleitet —
`topic` und `learning_objective` hängen bereits eindeutig an einem Fach (ADR 0004 D3).

## Konsequenzen

**Was besser wird**

- Kein Fachmix — nicht als Voreinstellung, sondern als Unmöglichkeit.
- Die Falschantworten überqueren die Sprachgrenze nicht mehr; das war ein echter
  Qualitätsfehler, der beim Üben unmittelbar auffällt.
- Eine Vokabel ohne Set behält ihr Fach.
- Die Duplikaterkennung bekommt einen definierten Rahmen.

**Was es kostet**

- Eine Migration mit Backfill. Nachgemessen am 09.09.2026: 14 Vokabeln, davon **0** in
  keinem Set und **0** in Sets verschiedener Fächer — das Backfill ist heute eindeutig.
  Es soll trotzdem hart scheitern statt zu raten, falls es das einmal nicht ist.
- `vocab_set_item` bekommt eine Spalte, die man beim Einfügen mitschreiben muss. Vergisst
  man sie, schlägt der Fremdschlüssel fehl — der Fehler ist laut, nicht still.
- Ein Bildschirm mehr im Übungsweg: erst Fach, dann Session. Für die Zielgruppe eher
  Gewinn als Verlust — „12 fällig in Französisch" ist eine Aussage, „24 fällig" ist keine.

**Was bewusst offen bleibt**

- Ob ein Kind ein Fach umbenennen oder zusammenlegen kann (heute: nein, `subject` entsteht
  aus dem Seed). Gehört zu F-06c/L-01, nicht hierher.
- Ob `card` später doch eine Spiegel-Spalte braucht. Erst messen, dann entscheiden.

## Nachtrag beim Bauen (V-05)

**D1 und D2 sind umgesetzt**, genau wie oben entworfen: `vocab_item.subject_id` (`not null`,
FK gegen `subject`), `vocab_set_item.subject_id`, und die beiden zusammengesetzten
Fremdschlüssel binden Set und Vokabel gegen dieselbe Fach-Spalte.

Eine Abweichung von der reinen Lehre „Migrationen nur über `db:generate`": Eine
`not null`-Spalte auf einer gefüllten Tabelle braucht drei Schritte (nullbar anlegen,
befüllen, dann erst `set not null`), die `drizzle-kit generate` nicht von selbst erzeugt.
Die generierte Migration wurde um den Backfill und die beiden Härte-Prüfungen ergänzt, mit
Kommentar an der Stelle. Zusätzlich musste die Reihenfolge korrigiert werden: Die neuen
Unique-Constraints (`vocab_item_id_student_id_subject_id_key`,
`vocab_set_id_student_id_subject_id_key`) müssen vor den Fremdschlüsseln stehen, die auf sie
zeigen – `drizzle-kit` erzeugt die Constraints in Schema-Reihenfolge, nicht in
Abhängigkeitsreihenfolge, und die generierte Datei hätte mit „no unique constraint matching
given keys" abgebrochen. Beim Testlauf gefunden, nicht angenommen.

Nachgemessen gegen die echte Produktiv-DB, nicht nur die Test-DB: 14 Vokabeln, 0 ohne Set,
0 mehrdeutig – der Backfill lief ohne die vorgesehenen Ausnahmen durch, und im Browser
funktionierte die vereinfachte Duplikaterkennung (jetzt ein einzelner Vergleich auf
`subject_id` statt eines Joins über `vocab_set_item`/`vocab_set`) unmittelbar danach.

D3–D5 (fachgebundenes Üben, Duplikat-Rahmen in der Anwendung, Geltung für anderes
Lernmaterial) folgen mit V-06 bzw. bei Bedarf.

## Nachtrag beim Bauen (V-06)

**D3 ist umgesetzt.** `/ueben` zeigt einen Block je Fach statt einer Zahl über alles;
`loadSessionCards()` filtert auf `subject_id`, eine Session lädt also nie Karten aus zwei
Fächern. Die Falschantworten für Multiple Choice ziehen unverändert aus dem Vorrat der
Session (`distractors.ts`) – **keine eigene Fach-Regel dort nötig**, weil der Vorrat selbst
längst einsprachig ist. Genau die Vereinfachung, die D3 oben versprochen hat.

`card` selbst bekam dabei keine Spalte, wie in D1 festgelegt: `loadDueBySubject()` leitet
das Fach über `coalesce(vocab_item.subject_id, topic.subject_id)` ab – für Vokabelkarten
über V-05, für Karten aus Lernzielen (M-03, noch nicht gebaut) über
`learning_objective → topic → subject`. Beide sind n:1, `card_exactly_one_source`
garantiert, dass nie beide Joins gleichzeitig treffen. Die Abfrage ist damit schon richtig,
bevor M-03 existiert.

**Kein eigener Auswahl-Bildschirm vor der Session**, entgegen der in D3 genannten Kosten:
Bei realistisch ein bis drei Fächern mit fälligen Karten steht „Französisch · 12 fällig"
direkt neben dem Knopf, der es übt – ein Zwischenschritt hätte nichts hinzugefügt. Diese
Abwägung gilt für den heutigen Umfang; V-04 (Modi) darf sie neu stellen, falls mehr Fächer
gleichzeitig fällig werden, als auf einen Bildschirm passen.

Ein Fund beim Testen, keiner an der Anwendung: Der bestehende E2E-Test wählte das Kind
(„Mia") über eine `<select>`, deren Änderung eine Server Action hinter `useTransition`
auslöst – `selectOption()` wartet darauf nicht, eine anschließende Navigation konnte also
vor dem Setzen des Cookies passieren. Vorher unauffällig, weil „0 fällig" (Bens leerer
Stand, das Cookie-Fallback-Kind) ebenfalls auf `/\d+ fällig/` passte. Seit D3 zeigt ein Fach
ganz ohne fällige Karten gar keinen Block mehr – der Fehlgriff wurde dadurch sichtbar und
im Test behoben (auf das tatsächliche Setzen des Cookies warten, nicht nur auf den Klick).

## Nachtrag beim Bauen (V-04)

D3 hatte offen gelassen, ob V-04 (Modi) den Verzicht auf einen eigenen
Auswahl-Bildschirm neu stellen darf, falls mehr Fächer gleichzeitig fällig
werden. Beim Bauen kam eine andere Frage zuerst: Von den fünf Modi aus §6 M4
(Set-Modus, Fällig heute, Prüfungsmodus, Schwachstellen, Mix) drohten vier
als zusätzliche, gleichrangige Buttons auf `/ueben` zu landen – oben auf die
schon bestehende Richtungswahl und die beiden Platzhalter-Blöcke. Genau das
wurde beim eigenen Testen als überladen empfunden, bevor überhaupt Code dafür
entstand.

**Entscheidung: so wenig Modi wie möglich werden zu sichtbaren Auswahlen.**

- **Fällig heute** und **Mix** waren beim genauen Hinsehen bereits fertig:
  „Fällig heute (setübergreifend)" ist der bestehende Alltagsfluss seit V-06,
  „Mix" (Kartenarten mischen, nicht Fächer – siehe D3 oben) ist seit V-02
  automatisch, weil `modeForCardState()` den Modus aus dem FSRS-Zustand der
  Karte ableitet, nie aus einer Wahl des Kindes. Für beide entstand kein
  neuer Code, nur der Wegfall der „Kommt mit V-04"-Platzhalter, die das
  ehrlich gesagt hatten.
- **Schwachstellen** wird keine eigene Kachel. `loadSessionCards()` füllt
  eine zu kleine Fach-Session (unter `MIN_SESSION_SIZE`) mit den Karten mit
  den meisten Fehlschlägen auf, auch wenn sie noch nicht fällig sind – eine
  zusätzliche Quelle für dieselbe Session, keine zweite Wahrheit über
  Fälligkeit und kein Knopf, den das Kind drücken müsste. „Fehler als Daten"
  (Konzept §3) galt schon vorher als Prinzip; hier wird es zur Standard-
  Reihenfolge statt zu einer Option.
- **Set-Modus** bekommt einen Einstieg, aber nicht auf `/ueben`: „Dieses Set
  üben" steht auf der Set-Seite (`/faecher/vokabeln/[setId]`), wo das Set
  ohnehin schon verwaltet wird. Wer dorthin navigiert, hat die eine
  Entscheidung, die zählt, längst getroffen – ein zweiter Weg zum selben Ziel
  auf `/ueben` hätte nur verdoppelt. Die Richtungswahl (FR→DE/DE→FR/gemischt)
  zieht mit um: Sie stand vorher auf `/ueben` neben „Loslegen", jetzt nur
  noch hier, wo eine gezielte Übung ohnehin schon eine bewusste Wahl ist.
  `/ueben` selbst mischt beim alltäglichen „Loslegen" immer beide Richtungen.
- **Prüfungsmodus** (Sets der nächsten Arbeit) bleibt unentschieden liegen –
  nicht als Kürzung, sondern weil ihm die Grundlage fehlt: K-01 (der
  Kalender) existiert noch nicht, und ohne echte Termine gibt es keine
  „nächste Arbeit", aus der sich Sets ableiten ließen. Ein Behelf ohne
  Kalender (z. B. ein manuelles Prüfungs-Flag an `vocab_set`) wäre Schema für
  eine Übergangslösung, die K-01 vermutlich wieder verwirft – bewusst nicht
  gebaut. Bleibt ein Folgepunkt hinter K-01 (siehe `docs/PLAN.md`).

Damit bleibt `/ueben` bei seiner eigentlichen Frage – was ist heute dran –,
und die Antwort auf D3s offene Frage ist: **kein zusätzlicher
Auswahl-Bildschirm**, sondern weniger sichtbare Auswahl als vorher, nicht
mehr. Die zwei Platzhalter-Blöcke sind ersatzlos gestrichen, nicht durch neue
Kacheln ersetzt.

### Korrektur beim Zusammenführen: es waren zwei Umschalter, nicht einer

Der Abschnitt oben wurde gegen einen **veralteten Stand** geschrieben. Beim
Merge auf `main` zeigte sich, dass zwischenzeitlich V-06a, V-07, V-08 und
V-09 gelandet waren – und dass `/ueben` sich in der Zwischenzeit in die
**Gegenrichtung** entwickelt hatte:

- **V-06a** hat den Richtungs-Umschalter verfeinert statt entfernt: Die
  Beschriftung kommt jetzt aus `subject.language` (`EN → DE` statt fest
  `FR → DE`), und ein Fach ohne Zielsprache zeigt ihn gar nicht erst.
- **V-08** hat einen **zweiten** Umschalter danebengestellt (Antwortart:
  Automatisch / Auswahl / Tippen) und den Lernstand auf den ganzen Wortschatz
  umgestellt.

Die Kritik „zu viele Knöpfe", die V-04 ausgelöst hat, galt damit der Seite
**mit zwei** Umschaltern – nicht der mit einem, gegen die der erste Anlauf
gebaut wurde. Die Verschlankung oben war also nicht falsch, aber gemessen an
der echten Seite **unvollständig**.

**Korrigierte Entscheidung:** Beide Umschalter verlassen den Alltagsfluss,
und beide ziehen in den Set-Modus auf der Set-Seite um – dort ist eine
gezielte Wahl ohnehin schon bewusst getroffen. `/ueben` zeigt je Fach nur
noch Lernstand und „Loslegen"; Richtung mischt `loadSessionCards()` je
Vokabel (V-06a/V-07), die Frageform leitet `modeForCardState()` aus dem
FSRS-Zustand ab.

**Was dabei ausdrücklich nicht passiert ist: Löschen von Funktionalität.**
V-06as sprachabhängige Beschriftungen (`directionLabels()`) und V-08s
erzwingbare Antwortart sind vollständig erhalten und im Set-Modus über
`?richtung=` und `?art=` weiter erreichbar. Verschwunden ist nur ihre
Position im Weg des täglichen Übens. Eine Verschlankung, die eine gerade
bewusst gebaute Fähigkeit ersatzlos wegnimmt, wäre keine gewesen.

## Abgelehnte Alternative

**Das Fach rein ableiten, ohne Spalte.** Wäre die reinere Lesart von ADR 0006 D7 und
käme ohne Migration aus. Scheitert an zwei Stellen: Die Ableitung ist über n:m mehrdeutig,
und für eine Vokabel ohne Set gibt es sie gar nicht. Beide Fälle müsste Anwendungscode
auflösen — genau das, was ADR 0004 D3 für die Fachbindung von Themen schon einmal
abgelehnt hat.
