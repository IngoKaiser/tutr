# RLS-Policies

Eine Datei je Aggregat, lexikalisch angewandt von `scripts/db-apply.mts`
(`npm run db:migrate`, für die Test-DB `npm run db:migrate:test`). Die
Dateien müssen **idempotent** sein: `drop policy if exists` vor jedem
`create policy`.

Grundlage: [ADR 0004](../../../docs/adr/0004-datenmodell-rls.md) für die
Muster, [ADR 0006](../../../docs/adr/0006-student-als-mandant.md) für den
Mandanten. **Das Kind ist der Mandant**: Jede Policy vergleicht
`student_id = app.student_id()`, und die Rolle entscheidet nur noch über lesen
oder schreiben. Der Actor trägt dafür immer eine `studentId` – auch als
Elternteil, denn eine Elternansicht zeigt ein Kind zur Zeit.

## Checkliste für jede neue Tabelle

1. **`student_id`-Spalte.** Policies vergleichen genau diese Spalte, ohne
   Join. Zwei Ausprägungen:
   - Eigene Daten: `not null`, plus Fremdschlüssel auf `student(id)` mit
     `on delete cascade`, damit ein gelöschtes Kind seine Daten mitnimmt.
   - Referenzdaten: `nullable`, `NULL` = kuratiert (D7).
2. **Unique-Anker,** wenn spätere Tabellen zusammengesetzt referenzieren
   sollen: `unique (id, student_id)`, bei Bedarf auch `(id, subject_id)` –
   siehe `topic` in `curriculum.ts`.
3. **Policy-Datei hier** mit `grant` für `tutr_app` und `enable row level
security`.
4. **Policy-Test** in der Testdatei des Aggregats. Mindestens: fremde
   Mandant sieht nichts, und die Schreibrechte stimmen.
5. **Zeile in der RLS-Matrix** in ADR 0004 D4.

## Die drei Muster

**Eigene Daten, beide schreiben** (`school_year`, `subject`,
`school_year_subject`, ADR 0009 D1; `school_year_textbook`, L-01, Nachtrag zu
ADR 0009): beide Rollen `for all`, unterschieden nur durch
`app.actor_role()`. Ein Kind ohne Elternkonto (ADR 0006 D1: „funktioniert
ohne") muss ein Fach, ein Schuljahr und – seit L-01 – auch sein Lehrwerk
selbst anlegen/zuordnen können – bei `for select` fürs Kind käme es dazu nie.
Ursprünglich „Eltern schreiben, Kind liest" (siehe ADR 0004 D4); für
`school_year` und `subject` mit ADR 0009 D1 korrigiert, für
`school_year_textbook` erst später mit L-01 (die Tabelle kam nach ADR 0009
dazu und wurde beim Schreiben von ADR 0009 übersehen).

**Eigene Daten, Kind schreibt** (`topic`, `learning_objective`, `vocab_*`):
umgekehrt – Kind `for all`, Eltern `for select`.

**Kuratiert oder eigen** (`textbook`, `chapter`, `school_profile`): braucht
**zwei** Policies, keine einzige.

```sql
for select using (student_id is null or student_id = app.student_id())
for all    using (student_id = app.student_id())
       with check (student_id = app.student_id());
```

Eine einzelne `for all`-Policy, deren `USING` auch `NULL` zulässt, wäre
angreifbar: Bei `UPDATE` filtert `USING` die Zielzeilen, eine kuratierte
Zeile passiert diesen Filter, und `WITH CHECK` ist durch dasselbe Update
erfüllbar, das `student_id` auf das eigene Kind setzt. Die Zeile wäre für
alle anderen gekapert. Kuratierte Daten schreibt deshalb ausschließlich die
Migrationsrolle.

## Anmeldung: die drei Schleusen

Drei Stellen lesen ohne Actor-Kontext (ADR 0006 D3): `parent_account_self`
(0010) sowie die beiden Anmelde-Policies in 0020. Sie folgen alle demselben
Zuschnitt, und wer eine vierte braucht, sollte ihn einhalten:

- eine eigene Session-Variable (`tutr.auth_user_id`, `tutr.credential_id`,
  `tutr.session_token_hash`), gesetzt über `runWithLoginKey` in
  `src/db/actor.ts` – nie über `withActor()`;
- der Wert muss unratbar sein und von außen bestätigt (Supabase) oder
  serverseitig erzeugt;
- **nur `for select`**, und die Bedingung gibt genau eine Zeile frei;
- ein Test, der belegt, dass der Weg keine andere Tabelle öffnet.

Zu beachten: Ein `update` ohne passende Policy wirft **keinen** Fehler, es
trifft null Zeilen. Ein Test, der nur eine Ausnahme erwartet, beweist hier
nichts – er muss die Zeile danach nachlesen.

## Entstehung eines Kindes

`student` hat eine INSERT-Policy, die auf die ID des eigenen Actor-Kontexts
prüft (`id = app.student_id()`). Das sieht nach einem Loch aus, ist aber der
Boden: So entsteht nach ADR 0005 die Kind-Registrierung. Die ID erzeugt der
Server unmittelbar davor, wählbar ist sie von außen nicht, und ein zweiter
Versuch läuft in den Primärschlüssel.

## Spaltenweite Enge lebt in der Server Action, nicht in der Policy

`student_update_self` (F-06c) erlaubt dem Kind, seine eigene Zeile per `update`
zu ändern – die **ganze** Zeile, nicht nur Vorname/Jahrgang/Klasse. Das ist
Absicht: Postgres kennt keine spaltenweise Sichtbarkeit innerhalb einer
Policy (siehe unten), eine engere Fassung bräuchte entweder einen Trigger
(gibt es in diesem Projekt bewusst nirgends, vgl. ADR 0004 „`updated_at` …
keine Trigger") oder eine zweite Tabelle nur für die sensiblen Spalten
(`recovery_token_hash`, `recovery_expires_at`). Beides wäre für drei Felder
unverhältnismäßig gewesen.

Die tatsächliche Enge liegt deshalb in `updateOwnProfile()`
(`src/app/(app)/einstellungen/actions.ts`): Nur diese drei Felder erscheinen
je im `SET`. Das funktioniert, weil Mutationen ausschließlich über
Server Actions mit einem festen, handgeschriebenen Eingabetyp laufen
(CLAUDE.md) – ein Browser kann kein beliebiges SQL nachschieben. Wer eine
Tabelle mit einer echten spaltenweisen Bedrohung baut (ein anderer
_Actor-Kontext_ derselben DB-Rolle soll dieselbe Zeile nur teilweise ändern
dürfen), braucht die Tabellen-Trennung aus „Eltern sehen nie Tutor-Verläufe"
unten, nicht dieses Muster.

## Rekursion zwischen Policies

Liest die Policy von A die Tabelle B, und B liest wieder A, bricht Postgres
mit `infinite recursion detected in policy` ab. Genau das passierte zwischen
`parent_account` und `parent_student`. Der Ausweg sind die `security
definer`-Helfer in `0000-setup.sql` (`app.parents_of`,
`app.account_of_auth_user`, `app.parent_may_link`): Sie lösen eine Beziehung
auf, ohne erneut durch RLS zu gehen. Jeder ist auf genau eine Frage
beschränkt und gibt nur IDs oder ein `boolean` zurück.

## Was der Metatest erzwingt

`src/db/rls.test.ts` lässt CI fehlschlagen, sobald eine Tabelle in `public`
ohne RLS oder ohne Policy bleibt. Er ersetzt kein Nachdenken über die
Richtung der Policy – nur über ihr Vorhandensein.

## Eltern sehen nie Tutor-Verläufe

`tutor_session` und `tutor_message` bekommen **keine** Eltern-Policy. Die
Zusammenfassung für Eltern ist eine eigene Tabelle
(`tutor_session_summary`), weil Postgres keine spaltenweise Sichtbarkeit
innerhalb einer Policy kennt (D4).
