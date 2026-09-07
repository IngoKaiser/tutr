# ADR 0004: Datenmodell und RLS-Strategie

Status: **akzeptiert** · Datum: 2026-09-06 · Bezug: docs/konzept.md §8, §9, §10, §11 · Ticket: F-03
Baut auf: ADR 0001 (Stack), ADR 0002 (Familienmodell), ADR 0003 (API-Keys)

## Kontext

Das Konzept beschreibt in §8 einen Entitätenbaum, aber keine Umsetzung. Vor dem ersten `db:generate` müssen neun Fragen beantwortet sein, weil sie später nur teuer zu ändern sind:

1. Woran hängt Mandantentrennung – und wie erfährt Postgres, _wer_ gerade fragt?
2. Wie kommt ein Kind ohne Supabase-Auth-Account in eine RLS-Policy (ADR 0002)?
3. Wie wird „Eltern sehen nie `tutor_sessions`" strukturell erzwungen?
4. Wie wird „ein Thema gehört zu genau einem Fach" als DB-Constraint erzwungen (§15)?
5. Beziehungen als Arrays (so skizziert §8) oder als Join-Tabellen?
6. Wo endet die Zeitscheibe `SchoolYear` (§9: Karten/Reviews/Mastery hängen _nicht_ daran)?
7. Kuratierte Referenzdaten (Kurrikulum-Pack, Lehrwerk) neben Familiendaten in derselben DB – wie?
8. Schlüssel, Enums, Zeitstempel, Namenssprache.
9. Wie werden Policies versioniert und getestet?

Randbedingungen: Drizzle greift direkt über Postgres zu (`postgres.js`, Transaction Pooler, `prepare: false`), nicht über PostgREST. Mutationen laufen über Server Actions. Das Kind hat laut ADR 0002 eine eigene Session-Tabelle, keinen Supabase-Auth-User.

---

## D1 · Wer fragt? Actor-Kontext statt `auth.uid()`

**Optionen**

|                | A: Supabase Auth für alle                                                              | B: App-Rolle + Request-Kontext                       | C: Kein RLS, nur Server-Layer                            |
| -------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------------------------- |
| Kind-Identität | anonymer Auth-User pro Gerät                                                           | Profil-ID aus eigener Session                        | –                                                        |
| Policy liest   | `auth.uid()` / JWT-Claims                                                              | `current_setting('tutr.*')`                          | –                                                        |
| Zugriffswege   | PostgREST **und** Drizzle                                                              | nur Drizzle                                          | nur Drizzle                                              |
| Kosten         | Custom Access Token Hook, zwei Regelwerke parallel, Kind-Account widerspricht ADR 0002 | eigene DB-Rolle, jede Query muss durch einen Wrapper | ein vergessenes `where` = Datenleck über Familien hinweg |

**Entscheidung: B.** Ein einziger Datenzugriffsweg, ein einziges Regelwerk, Eltern und Kind identisch behandelt.

Umsetzung:

```sql
-- Laufzeit-Rolle: darf sich anmelden, umgeht RLS nicht, besitzt keine Tabelle.
create role tutr_app login password :'pw' nobypassrls;
grant usage on schema public, app to tutr_app;
grant select, insert, update, delete on all tables in schema public to tutr_app;

create schema app;
create function app.family_id()  returns uuid language sql stable
  as $$ select nullif(current_setting('tutr.family_id',  true), '')::uuid $$;
create function app.student_id() returns uuid ... ;
create function app.role()       returns text ... ;   -- 'parent' | 'student'
```

```ts
// src/db/actor.ts – jede Datenoperation läuft hierdurch
withActor(actor, (tx) => tx.select()...)
// intern: db.transaction(async (tx) => {
//   await tx.execute(sql`set local role tutr_app`);            // Gürtel …
//   await tx.execute(sql`select set_config('tutr.family_id', ${actor.familyId}, true)`);
//   ...
// })
```

**Zwei Verbindungen, zwei Rollen** (siehe Messung unten – das ist der sicherheitskritische Teil):

| Env                      | Rolle      | Wofür                                   | RLS      |
| ------------------------ | ---------- | --------------------------------------- | -------- |
| `DATABASE_URL`           | `tutr_app` | Laufzeit: Server Actions, Route Handler | greift   |
| `MIGRATION_DATABASE_URL` | `postgres` | `drizzle-kit`, Policy-Runner, Seed      | umgangen |

- **Die Laufzeit darf nicht als `postgres` verbinden.** `postgres` ist Superuser und umgeht RLS vollständig – ein Zugriff ohne `withActor()` sähe dann alle Familien statt keiner. Erst die eigene Rolle in `DATABASE_URL` macht das System fail-closed: ohne Wrapper ist die GUC leer, `app.family_id()` liefert `NULL`, jede Policy ist falsch → leeres Resultat. Ein vergessener Wrapper wird zum sichtbaren Bug statt zum stillen Leck.
- `SET LOCAL ROLE tutr_app` im Transaktionskopf bleibt trotzdem stehen – Hosenträger zum Gürtel, und der einzige Schutz, falls doch einmal eine Verbindung als `postgres` in die Laufzeit gerät.
- `SET LOCAL` (nicht `SET`) ist im Transaction-Pooling-Modus zwingend.
- Werte immer über `set_config(...,$1,true)` mit gebundenem Parameter – nie per String-Interpolation.
- Supabase Auth bleibt für die _Authentifizierung_ der Eltern zuständig (Magic Link, Session-Cookie). Aus der verifizierten Session baut der Server den Actor. Storage-Zugriff des Kindes läuft über serverseitig signierte URLs, nicht über Storage-RLS (relevant für M-01).

## D2 · `family_id` auf jeder Tabelle, abgesichert per zusammengesetztem Fremdschlüssel

Jede familiengebundene Tabelle trägt `family_id uuid not null`. Policies vergleichen genau diese Spalte – kein Join, keine Rekursion, indexfreundlich.

Damit die denormalisierte Spalte nicht auseinanderlaufen kann, tragen die Fremdschlüssel sie mit:

```sql
student     (id pk, family_id, ..., unique (id, family_id))
school_year (id pk, family_id, student_id,
             foreign key (student_id, family_id) references student (id, family_id) on delete cascade)
```

Damit ist eine familienübergreifende Verknüpfung strukturell unmöglich – kein Trigger, keine Prüfung im Anwendungscode.

## D3 · Fachbindung als Constraint (§15, Fehler 2)

Dasselbe Muster erzwingt „ein Thema gehört zu genau einem Fach; eine Prüfung verknüpft nur Themen ihres Fachs":

```sql
subject (id pk, student_id, unique (id, student_id))
thema   (id pk, subject_id, student_id, school_year_id,
         foreign key (subject_id, student_id) references subject (id, student_id),
         unique (id, subject_id))
calendar_event (id pk, subject_id, unique (id, subject_id))
calendar_event_thema (
  event_id, thema_id, subject_id, primary key (event_id, thema_id),
  foreign key (event_id, subject_id) references calendar_event (id, subject_id),
  foreign key (thema_id,  subject_id) references thema (id, subject_id))
```

Ein Insert mit fachfremdem Thema scheitert an der Datenbank. Der Test in P-01 prüft genau diesen Fehlerfall.

## D4 · Eltern-/Kind-Sicht: Zusammenfassung als eigene Tabelle

Postgres kennt keine spaltenweise Sichtbarkeit innerhalb einer Policy. Statt einer `zusammenfassung`-Spalte auf `tutor_session` gibt es deshalb:

- `tutor_session` + `tutor_message` – Policy: nur `role='student'` und `student_id = app.student_id()`. Für Eltern existiert **keine** Policy, also kein Zugriff.
- `tutor_session_summary` (Titel, Fach, Thema, Dauer, Zweizeiler aus §4a) – für Eltern lesbar, vom Server geschrieben.
- `homework_task` (Status, Versuche, Zeit) – Eltern lesen Status/Zeit, nie den Verlauf → getrennt von `tutor_message`.

RLS-Matrix (Kurzfassung, Detail in `src/db/policies/`):

| Tabellengruppe                                                  | Elternteil        | Kind                     |
| --------------------------------------------------------------- | ----------------- | ------------------------ |
| `family`, `student`, `school_year`, `subject`, `school_profile` | lesen + schreiben | lesen                    |
| `thema`, `learning_objective`, `material`                       | lesen             | lesen + schreiben        |
| `card`, `review`, `vocab_*`, `objective_mastery`                | lesen             | lesen + schreiben        |
| `calendar_event`, `study_plan_slot`                             | lesen + schreiben | lesen + schreiben        |
| `exam`, `exam_attempt`                                          | Ergebnis lesen    | lesen + schreiben        |
| `tutor_session`, `tutor_message`                                | **kein Zugriff**  | eigene lesen + schreiben |
| `tutor_session_summary`, `homework_task`                        | lesen             | lesen + schreiben        |
| `curriculum_pack`, `curriculum_node`, `lehrwerk`, `kapitel`     | lesen             | lesen                    |

Kind-Policies filtern zusätzlich auf `student_id = app.student_id()`, damit Geschwisterprofile getrennt bleiben.

## D5 · Beziehungen als Join-Tabellen, JSONB nur für echte Payloads

§8 skizziert `lernzielIds`, `materialIds`, `themaIds` als Arrays. Arrays haben keine referenzielle Integrität, kein `on delete`, und RLS greift nicht auf Elemente.

- **Join-Tabellen** für alle n:m-Beziehungen: `material_objective`, `calendar_event_thema`, `vocab_set_item`, `objective_prerequisite` (Vorläufer, Selbstreferenz), `school_year_textbook` (ersetzt `lehrwerke{fach→id}`).
- **JSONB** nur dort, wo die Struktur wirklich offen ist: `card.fsrs_state`, `exam.aufgaben`, `exam.rubrik`, `calendar_event_change.diff`, `import_batch.rohdaten`. Jedes JSONB-Feld bekommt ein Zod-Schema in `src/ai/schemas/` bzw. `src/db/types/`, das beim Lesen validiert.
- **Mastery ist abgeleitet**, kein Handfeld: Tabelle `objective_mastery (student_id, objective_id, abdeckung, sicherheit, berechnet_am)` als Cache einer reinen Funktion über Reviews/Checks/Prüfungen. Neuberechnung explizit, nie inkrementell im Request.

## D6 · Zeitscheibe endet bei Thema

`school_year_id` steht ausschließlich auf `thema`, `calendar_event`, `study_plan_slot` und `school_year_textbook`. `card`, `review`, `vocab_*`, `objective_mastery` haben diese Spalte **nicht** – §9 wird damit strukturell erzwungen statt per Konvention. `subject` hängt am Schüler, nicht am Schuljahr (Französisch bleibt Französisch), `thema` hängt an beidem.

## D7 · Referenzdaten: eine Tabelle, `family_id` nullable

`curriculum_pack`, `curriculum_node`, `lehrwerk`, `kapitel`, `school_profile` gibt es in zwei Ausprägungen: kuratiert (`family_id is null`, per Seed/Migration mit dem Secret-Key geschrieben) und selbst angelegt (Foto vom Inhaltsverzeichnis → familieneigenes Lehrwerk). Eine Policy deckt beides:

```sql
using (family_id is null or family_id = app.family_id())
```

Schreibrechte nur auf Zeilen mit eigener `family_id`. Kuratierte Zeilen sind für die App-Rolle read-only.

## D8 · Schlüssel, Enums, Zeit, Namen

- **PK:** `uuid` mit `default gen_random_uuid()` (auf PG 17.6 ohne `pgcrypto` verfügbar, gemessen). `uuidv7()` gibt es dort noch nicht (PG 18) – die Indexlokalität ist bei einer Familie ohnehin irrelevant.
- **Enums:** `pgEnum` für Domänenvokabular (`niveau`, `pfad_stufe`, `thema_status`, `material_art`, `event_typ`, `card_type`, `actor_role`). Die TS-Konstante ist die einzige Quelle, das Zod-Schema wird daraus abgeleitet. Werte in deutscher Domänensprache, ASCII (`erhoeht`, nicht `erhöht`).
- **Zeit:** durchgängig `timestamptz`; reine Kalendertage (`calendar_event.datum`) als `date`. `created_at`/`updated_at` überall, `updated_at` per Drizzle `$onUpdate`, keine Trigger.
- **Namen:** Tabellen/Spalten snake_case, Entitätsnamen 1:1 aus §8 (`thema` bleibt deutsch – „topic" ist im Kurrikulum-Pack bereits anders belegt). UI-Texte deutsch, Identifier ansonsten englisch.
- **Löschen:** `on delete cascade` nur entlang `family → student → …`. `learning_objective → card` ist `restrict`: ein gelöschtes Lernziel darf keine Lernhistorie mitnehmen. Kein Soft-Delete außer wo das Konzept es verlangt (`calendar_event.status = 'abgesagt'` + `calendar_event_change`).

## D9 · Policies versionieren und testen

- Policies bleiben handgeschriebenes SQL in `src/db/policies/<tabelle>.sql` (CLAUDE.md), **idempotent** (`drop policy if exists` + `create policy`), angewandt von `scripts/db-apply-policies.ts`, aufgerufen von `npm run db:migrate`. `pgPolicy` in Drizzle wurde verworfen: die Policies sind ausdrucksstärker als das Drizzle-API und sollen im Review als SQL lesbar sein.
- **Metatest** (Vitest, gegen eine Testdatenbank): jede Tabelle in `public` außer `__drizzle_migrations` hat `relrowsecurity = true` **und** mindestens eine Policy. Damit ist „neue Tabelle ohne Policy = Ticket nicht fertig" automatisch geprüft.
- **Policy-Tests:** zwei Familien, zwei Geschwister, ein Elternteil im Seed; je Tabellengruppe ein Test „Familie B sieht nichts von Familie A", „Elternteil sieht `tutor_message` nicht", „Kind sieht Geschwisterkarten nicht", „ohne Actor-Kontext ist alles leer".

---

## Zielbild der Tabellen

```
family · parent_user · student                        [F-04b]
school_year · subject · school_year_textbook
  · thema · learning_objective · objective_prerequisite  [F-04c]
curriculum_pack · curriculum_node · lehrwerk · kapitel · school_profile  [F-04d]
material · material_objective                          [M-01]
card · review · objective_mastery                      [M-03]
vocab_set · vocab_item · vocab_set_item                [V-01]
calendar_event · calendar_event_thema · calendar_event_change · study_plan_slot  [K-01]
exam · exam_attempt · exam_item_result                 [M6]
tutor_session · tutor_message · tutor_session_summary · homework_task  [T-01]
```

Auth-Tabellen (`student_credential`, `student_session`, `invite_token`) kommen mit F-06 und folgen denselben Regeln.

## Verworfen

- **Supabase Auth für das Kind** (Option A): widerspricht ADR 0002, erzeugt einen zweiten Zugriffsweg mit eigenem Regelwerk.
- **RLS nur als Zierde, Autorisierung im Server-Layer** (Option C): widerspricht §11 und CLAUDE.md; ein vergessenes `where` wäre ein familienübergreifendes Leck.
- **`family_id` per Join in der Policy** statt denormalisiert: rekursive Policy-Auswertung, schlechte Pläne.
- **Trigger zur Konsistenz von `family_id`**: zusammengesetzte Fremdschlüssel leisten dasselbe deklarativ.
- **ID-Arrays wie in §8 skizziert**: keine Integrität, kein RLS auf Elementen.

## Konsequenzen

- Neue Regel für CLAUDE.md: _Jeder Datenbankzugriff läuft durch `withActor()`. Direkter `db.*`-Zugriff ist nur in Migrationen, Seeds und Cron-Jobs erlaubt und dort explizit zu begründen._ Ein Lint-Check kann das später erzwingen.
- Jede neue Tabelle bringt vier Dinge mit: `family_id` + zusammengesetzter FK, Policy-Datei, Policy-Test, Eintrag in der RLS-Matrix.
- Der Metatest schlägt bei jeder policy-losen Tabelle fehl – auch bei Tabellen, die Supabase-Extensions anlegen; solche werden namentlich in die Ausnahmeliste aufgenommen, nie pauschal.
- Elternsichten brauchen serverseitig geschriebene Zusammenfassungen. Der Tutor-Flow (T-01/T-03) muss `tutor_session_summary` beim Sessionende füllen, sonst sieht der Elternteil nichts.
- Policy-Tests sind destruktiv und laufen deshalb gegen ein **zweites, leeres Supabase-Projekt** (EU). Dessen Connection-String steht als `TEST_DATABASE_URL` in `.env.test.local` (gitignored) und als GitHub-Secret für CI. Docker/`supabase start` wurde verworfen: auf dem Entwicklungsrechner ist kein Docker installiert.

## Messung (2026-09-06, `scripts/probe-db.mjs` gegen das Projekt)

| Frage                                               | Ergebnis                                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Postgres-Version                                    | 17.6                                                                                            |
| `gen_random_uuid()` ohne Extension                  | vorhanden                                                                                       |
| `uuidv7()`                                          | nicht vorhanden (erst PG 18)                                                                    |
| `SET LOCAL ROLE` über den Transaction Pooler (6543) | funktioniert, Rolle fällt nach der Transaktion zurück                                           |
| Custom-GUC `tutr.*` über den Pooler                 | funktioniert                                                                                    |
| Verbindungsrolle heute                              | `postgres` – **Superuser, umgeht RLS** → D1 verlangt `tutr_app`                                 |
| TLS ohne `sslmode=require`                          | postgres.js öffnet einen Klartext-Socket – der Parameter ist in jedem Connection-String Pflicht |

Damit sind die Mechanismen aus D1 am realen Projekt bestätigt; offen bleibt nur, ob Supavisor eine Anmeldung als `tutr_app` zulässt (Nutzername `tutr_app.<project-ref>`). Prüfung und Fallback sind Teil von F-04a: greift die Anmeldung nicht, läuft die Laufzeit über den Session-Pooler (Port 5432) als `tutr_app`; als letzte Rückfallebene bleibt `postgres` + `SET LOCAL ROLE`, dann aber mit einem Architektur-Test, der direkten `db.*`-Zugriff außerhalb der erlaubten Dateien verbietet.

## Abgeleitete Tickets (in docs/PLAN.md geschnitten)

| ID    | Ticket                                                                                                                   | Ersetzt | Abhängig von |
| ----- | ------------------------------------------------------------------------------------------------------------------------ | ------- | ------------ |
| F-04a | DB-Rolle `tutr_app`, `app.*`-Helper, `withActor()`, Policy-Runner in `db:migrate`, RLS-Metatest, Test-DB-Setup           | –       | F-03         |
| F-04b | Schema Familie/Identität: `family`, `parent_user`, `student` + Policies + Tests                                          | F-04    | F-04a        |
| F-04c | Schema Schuljahr/Fach/Thema/Lernziel inkl. Fachbindungs-Constraint (D3) + Policies + Tests                               | F-04    | F-04b        |
| F-04d | Schema Referenzdaten: `curriculum_pack`, `curriculum_node`, `lehrwerk`, `kapitel`, `school_profile` + Shared-Read-Policy | F-04    | F-04b        |
| F-04e | Seed-Skript `npm run db:seed`: zwei Familien, Kind Jg. 8, Fächer, ein Thema mit Lernzielen – Basis aller Policy-Tests    | F-04    | F-04c, F-04d |
| F-04f | CLAUDE.md + `src/db/policies/README.md` um Actor-Regel und Tabellen-Checkliste ergänzen                                  | –       | F-04a        |

Jedes Ticket ist eine Session: Schema-Datei(en), Migration, Policy-SQL, Policy-Test, `npm run check` grün.
