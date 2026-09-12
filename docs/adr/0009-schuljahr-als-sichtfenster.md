# ADR 0009: Das Schuljahr ist ein Sichtfenster, das Fach ein Lernraum

Status: **akzeptiert** · Datum: 2026-09-09 · Bezug: docs/konzept.md §9, §11
Ändert die Schreibrichtung für `school_year` und `subject` aus
[ADR 0004](0004-datenmodell-rls.md) D4 (in der von
[ADR 0006](0006-student-als-mandant.md) D2 auf `student_id` umgestellten Fassung) und
schärft [ADR 0004](0004-datenmodell-rls.md) D6. Setzt
[ADR 0008](0008-fachbindung-von-lernmaterial.md) fort.
Tickets: F-16a (jetzt), F-16b (später).

## Kontext

Zwei Fragen, die beim Vorbereiten von F-16 zusammenfielen. Die erste ist ein Defekt,
die zweite eine offene Modellentscheidung.

### 1. Ein Kind kann sich kein Fach anlegen

`insert into subject` steht heute ausschließlich im Seed-Skript. Das ist nicht nur eine
fehlende Oberfläche, sondern ein fehlendes **Recht** —
`src/db/policies/0030-curriculum.sql`:

```sql
create policy subject_student on subject
  for select to tutr_app                    -- nur lesen
  using (student_id = app.student_id() and app.actor_role() = 'student');

create policy subject_parent on subject
  for all to tutr_app                       -- lesen und schreiben
  using (student_id = app.student_id() and app.actor_role() = 'parent') ...
```

Dasselbe für `school_year`. Nur ein Elternteil darf ein Fach anlegen; das Kind darf es
ansehen. Das kollidiert frontal mit [ADR 0006](0006-student-als-mandant.md) D1: „Ein Kind
funktioniert ohne Elternkonto." Wer sich selbst registriert und keine Eltern verknüpft
hat, kommt nie zu einem Fach — und ohne Fach gibt es kein Vokabelset, keine Vokabel, kein
Üben, kein Thema, keinen Tutor-Kontext, keinen Termin.

**Das ist keine Theorie.** In der Produktivdatenbank stand am 9. September genau ein Kind
(per Passkey selbst registriert) und `subject = 0`. Das Anlege-Formular für Vokabelsets
verschwand dabei kommentarlos — `set-list.tsx` gibt bei null Fächern `null` zurück, ohne
leeren Zustand, ohne Hinweis. Das Fach „Englisch" wurde von Hand über die Migrationsrolle
eingetragen, damit überhaupt etwas ging.

Woher die alte Richtung kommt: ADR 0004 entstand im Familienmodell, in dem ein Elternteil
das Konto einrichtete und das Kind darin lernte. Stammdaten waren Elternsache, weil die
Eltern der Einstieg waren. ADR 0005 hat den Einstieg umgedreht, ADR 0006 die Familie
entfernt — **die Schreibrichtung für Stammdaten ist als Rest stehen geblieben.**

### 2. Was begrenzt das Schuljahr?

Schülerinnen haben je Jahrgang unterschiedliche Fächer, und Inhalte aus dem Vorjahr im
laufenden Jahr zu sehen ist Lärm, kein Nutzen. Nach drei Jahren Französisch stünden vierzig
Vokabelsets in einer Liste. Das Konzept sieht den Jahreswechsel in §9 bereits vor, und das
Schema kennt `geplant` / `aktiv` / `archiviert` samt partiellem Unique-Index
(`school_year_one_active_per_student`) genau dafür.

Der naheliegende Schluss wäre, `subject` an `school_year` zu hängen. **Das wäre falsch**,
und zwar aus einem Grund, der erst seit V-05 gilt: `vocab_item.subject_id` ist `not null`.
Hinge das Fach am Jahr, wären Vokabeln über diese Kette jahresgebunden — und Sprachen sind
kumulativ. Die englischen Wörter aus Klasse 8 stehen in den Texten der Klasse 9 weiter
drin. Sie wären nach dem Wechsel nicht verloren (man könnte ins Vorjahr zurückwechseln),
aber sie kämen nicht mehr von selbst — und niemand wechselt freiwillig ins alte Schuljahr,
um dort zu üben. Der Lernstand verkümmert still, und es fällt erst in der nächsten Arbeit
auf.

Umgekehrt gilt genauso: Ein Geschichtsthema ist nach seiner Arbeit erledigt. Der
Unterschied liegt also nicht am Jahr, sondern **am Material**.

## Die entscheidende Festlegung

> **Das Schuljahr bestimmt, was sie sieht. Das Fach bestimmt, was sie übt.**

Überflutung droht an zwei Stellen, und sie braucht dort zwei verschiedene Antworten:

| Wo                                                            | Antwort                                                                                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Bildschirme zum Blättern** — Fächer, Sets, Themen, Arbeiten | Das Schuljahr filtert. Sammeln ist hier schädlich                                                                                     |
| **Die Übungsschlange** — was FSRS heute fällig stellt         | Der Algorithmus regelt es. Intervalle wachsen von Tagen über Wochen zu Monaten und Jahren; der Bestand wächst, die Tagesschlange kaum |

Eine gut gekonnte Vokabel aus dem Vorjahr auszublenden schafft keine Ruhe — es schaltet
die Wiederholung ab. Genau davor schützt [ADR 0004](0004-datenmodell-rls.md) D6.

## Entscheidung

### D1 · Das Kind legt Fächer und Schuljahr selbst an

`school_year_student` und `subject_student` werden von `for select` auf `for all`
erweitert, mit `with check (student_id = app.student_id() and app.actor_role() =
'student')`. Die Elternpolicies bleiben unverändert.

Es ändert sich die **Richtung**, nicht die **Reichweite**: Ein Kind fasst weiterhin
ausschließlich eigene Zeilen an. Eltern verlieren nichts, es kommt ein Recht dazu.

### D2 · Das Fach behält seine Identität über Jahre, die Zugehörigkeit ist jahresweise

`subject` hängt weiter am Kind, nicht am Schuljahr — Französisch bleibt dieselbe Zeile,
und die Vokabeln bleiben daran hängen (ADR 0004 D6, unverändert).

**Welche Fächer in einem Jahr laufen**, sagt eine eigene Zuordnung:

```
school_year_subject (student_id, school_year_id, subject_id)
  FK (school_year_id, student_id) → school_year (id, student_id)
  FK (subject_id,     student_id) → subject     (id, student_id)
  unique (school_year_id, subject_id)
```

Zusammengesetzte Fremdschlüssel gegen beide Seiten, wie überall seit ADR 0004 D3: Ein Fach
eines fremden Kindes lässt sich nicht zuordnen, und die Datenbank erzwingt das, nicht der
Anwendungscode.

Neues Jahr heißt damit: leere Fächerliste, sie legt an oder wählt aus, was sie belegt.
Wählt sie Englisch wieder, ist der Vokabelstand da, wo er war.

### D3 · Die Übungsschlange folgt dem Fach, nicht dem Jahr

Geübt wird, was zu einem **im aktuellen Jahr aktiven Fach** gehört — über dessen ganze
Geschichte hinweg. Ein Fach, das dieses Jahr nicht läuft, ist still: keine Karten, kein
Rauschen.

Damit entscheidet genau die Angabe aus D2, was geübt wird. Sie sagt, welche Fächer sie
belegt; das System zieht die Konsequenz. Es braucht keinen zweiten Schalter „alte
Vokabeln mitüben ja/nein" — die Frage ist mit der Fächerwahl schon beantwortet.

### D4 · Die Zeitscheibe schützt den Lernstand, nicht den Behälter

ADR 0004 D6 nennt `vocab_*` als Ganzes von `school_year_id` ausgenommen. Das ist **eine
Tabelle zu breit**. Zu schützen ist der Lernstand:

| Zeitlos (Lernstand)                                 | Darf jahresgebunden sein (Behälter) |
| --------------------------------------------------- | ----------------------------------- |
| `vocab_item`, `card`, `review`, `objective_mastery` | `vocab_set`                         |

`vocab_set` trägt keinen Lernstand. V-03a hat das belegt: Ein gelöschtes Set lässt die
Vokabeln und ihre Karten stehen — im E2E-Test direkt in der Datenbank nachgezählt. Ein Set
ist eine Ordnungshilfe, und Ordnungshilfen gehören ins Jahr, in dem geordnet wurde.

Die Regel wird damit **geschärft, nicht gebrochen**: Was gelernt wurde, bleibt zeitlos.
Was nur sortiert, folgt dem Sichtfenster.

## Konsequenzen

- **F-16a baut jetzt:** Policy-Änderung aus D1 · `school_year_subject` samt Policy und
  Migration · `/faecher` zeigt die Fächer des aktiven Jahres, mit Anlegen, Umbenennen und
  Löschen · `createSubject` legt die Jahreszuordnung mit an · die Registrierung erzeugt
  das aktive Schuljahr in derselben Transaktion · eine Nur-Lese-Zeile „Schuljahr 2026/27"
  in den Einstellungen, damit der Begriff sichtbar ist.
- **F-16b hebt sich auf:** Jahr umschalten, Historie ansehen, automatischer Rollover
  (§9 Sommer-Assistent), `vocab_set.school_year_id`. Es gibt genau ein Schuljahr; ein
  Umschalter hätte bis August 2027 nichts zu tun. **Das Modell muss jetzt stimmen, die
  Bedienung nicht** — nachträglich wäre die Zuordnung eine Migration über gewachsene
  Daten, der Umschalter dagegen nur eine Seite.
- **`loadDueBySubject()` und `loadSessionCards()` bekommen mit F-16b einen Filter** auf
  die Fächer des aktiven Jahres (D3). Solange es ein Jahr gibt, ist das ein No-op —
  deshalb dort und nicht hier.
- **Löschen braucht einen Riegel.** `topic.subject_id` hängt mit `on delete cascade` am
  Fach: Ein gelöschtes Fach nähme stillschweigend die Themen mit. `vocab_set` steht auf
  `restrict` und bräche mit einer Datenbankmeldung ab. `deleteSubject()` zählt beides
  vorher und lehnt mit einem deutschen Satz ab — dieselbe Linie wie beim Set-Löschen in
  V-03a.
- **`subject.language`** (nullable, ISO-639-1) kommt mit F-16a, obwohl erst V-06a es
  liest: Das Anlege-Formular entsteht hier, und es zweimal zu bauen wäre teurer als eine
  nullable Spalte. `null` heißt „kein Sprachfach" und schaltet in V-06a die Richtungswahl
  ab — bei Frage-Antwort-Material gibt es keine Rückrichtung.
- **Keine neue Abweichung von der Spec.** `docs/konzept.md` §11 kennt für das Kind „keinen
  eigenen Account-Anlageprozess" — diese Abweichung hat aber bereits ADR 0005 dokumentiert.
  Die Schreibrichtung für Stammdaten stammt nicht aus §11, sondern aus ADR 0004 D4; nur die
  wird hier geändert. Die Spec bleibt unverändert.
- **ADR 0004 D4 gilt unverändert** für `topic`, `learning_objective` und
  `objective_prerequisite`. Nur die beiden Stammdatentabellen wechseln die Seite.
- **Policy-Tests in beide Richtungen** (`src/db/schema/curriculum.test.ts`): Das Kind legt
  eigene Fächer und Schuljahre an — und scheitert an fremden.

## Nachtrag beim Bauen (F-16a, 9.9.2026)

**Die Migration erfindet keine Geschäftsdaten.** `vocab_set.school_year_id` lässt sich beim
Backfill eindeutig aus dem aktiven Schuljahr des jeweiligen Kindes ableiten (dieselbe Art
Backfill wie `vocab_item.subject_id` in 0003) – das steht in der Migration. Ein Kind aber, das
sich **vor** F-16a registriert hat, hat gar kein Schuljahr: Der alte Registrierungsweg legte
keins an. Genau ein Kind betrifft das produktiv (`Ingo`, Fach „Englisch" von Hand nachgetragen
am 9.9., vor diesem Ticket).

Ein Schuljahr für dieses Kind zu erzeugen hieße, ein Label und einen Datumsbereich zu
_erfinden_ – keine Ableitung aus vorhandenen Zeilen mehr, sondern eine neue Tatsachenbehauptung
("das ist gerade 2026/27"), die zufällig richtig ist, aber grundsätzlich eine andere Art
Entscheidung als ein Struktur-Backfill. Das gehört nicht in eine Migration, die unbeaufsichtigt
in jeder Umgebung läuft. Stattdessen: `activeSchoolYearId()` gibt `null` zurück, wenn keins
existiert, jede Stelle, die das Jahr braucht, meldet einen deutschen Fehler statt eines Absturzes
– und der eine betroffene Datensatz bekommt sein Schuljahr über denselben manuellen,
protokollierten Weg wie das Fach „Englisch" selbst.

Löschriegel (`deleteSubject()`) und die Fächerverwaltung insgesamt liefen beim Testen wie
entworfen – keine Abweichung von D1–D4.

## Nachtrag (L-01, 12.9.2026): `school_year_textbook` zieht nach

D1 hatte bewusst nur `school_year` und `subject` umgedreht – `school_year_textbook` gab es
noch nicht (kam mit F-04d, ADR 0004 D7), und ADR 0004s Kopfnotiz hielt fest: „bleibt
unverändert bei Eltern lesen + schreiben, Kind liest". Beim Bauen von L-01 (Lehrwerk pro
Fach erfassen) hat sich das als derselbe Rest erwiesen, den D1 schon einmal korrigiert hat:
Ein Kind ohne Elternkonto (ADR 0006 D1) fotografiert sein Buch selbst, kann die Zuordnung
zum Fach aber nicht speichern – exakt die Situation, die D1 für `subject` behoben hat, nur
an einer Tabelle, die zum damaligen Zeitpunkt noch nicht existierte.

**Entscheidung:** `school_year_textbook_student` wechselt von `for select` auf `for all`,
mit `with check (student_id = app.student_id() and app.actor_role() = 'student')` – wortgleich
zu `school_year_subject_student`. Die Elternpolicy bleibt unverändert; es kommt ein Recht
dazu, keins entfällt. `textbook`/`chapter` selbst durften ohnehin schon beide Rollen
beschreiben (ADR 0004 D7, kuratiert-oder-eigen) – nur die Zuordnungstabelle hinkte hinterher.

Kein Widerspruch zu ADR 0012: Eltern verlieren keinen Einblick, der Stoffplan (worunter das
Lehrwerk fällt) bleibt für sie sichtbar und schreibbar.

## Abgelehnte Alternative: `subject.school_year_id`

Der direkte Weg — jedes Jahr eigene Fachzeilen — scheitert an `vocab_item.subject_id`
(`not null`, V-05). „Englisch Klasse 9" wäre eine andere Zeile als „Englisch Klasse 8", die
Vokabeln hingen an der alten, und beim Rollover müsste der Lernstand wandern. Eine
Datenmigration bei jedem Jahreswechsel, mit dem FSRS-Zustand als Fracht — genau die Art
von beweglichem Teil, die ADR 0004 D6 strukturell vermeiden wollte.

Die Zuordnungstabelle aus D2 leistet dasselbe, ohne dass je eine Zeile umziehen muss.
