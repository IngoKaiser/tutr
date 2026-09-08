# ADR 0008: Ein Fach ist ein Raum, kein Filter

Status: **Vorschlag** · Datum: 2026-09-09 · Bezug: docs/konzept.md §6 M4, §10
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

## Abgelehnte Alternative

**Das Fach rein ableiten, ohne Spalte.** Wäre die reinere Lesart von ADR 0006 D7 und
käme ohne Migration aus. Scheitert an zwei Stellen: Die Ableitung ist über n:m mehrdeutig,
und für eine Vokabel ohne Set gibt es sie gar nicht. Beide Fälle müsste Anwendungscode
auflösen — genau das, was ADR 0004 D3 für die Fachbindung von Themen schon einmal
abgelehnt hat.
