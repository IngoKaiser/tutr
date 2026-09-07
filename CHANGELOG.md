# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach SemVer. Jedes Ticket trägt sich unter **Unreleased** ein; beim Release wird der Block umbenannt.

## [Unreleased]

### Added

- `src/db/index.ts` baut die Verbindung erst beim ersten Zugriff auf (`getSql()` / `getDb()` statt Modul-Konstanten). Vorher scheiterte jeder Import einer Datei, die davon abhängt, ohne gesetzte `DATABASE_URL` – in CI, im Build und in Tests, die die Datenbank nicht anfassen
- `npm run db:doctor` meldet ein abweichendes Passwort ohne Längenangabe – CodeQL hatte die Ausgabe der Zeichenzahl zu Recht als Klartext-Logging eines Geheimnisses gemeldet
- Schema Lehrwerk-Registry (F-04d): `textbook`, `chapter`, `school_year_textbook` in `src/db/schema/textbook.ts`, `school_profile` in `src/db/schema/school-profile.ts`. Erstmals das kuratiert-oder-eigen-Muster (ADR 0004 D7): `family_id` nullable, NULL = kuratiert. Pro Schuljahr und Fach genau ein Lehrwerk (§8 `lehrwerke{fach→id}` als Join-Tabelle mit Unique-Constraint). Enum `textbook_source` unterscheidet Foto / manuell / Claude-Vorwissen / Verlags-PDF – nötig, weil Claudes Vorschläge laut §10 in der UI markiert werden müssen. 29 Tests
- **Sicherheitskorrektur in ADR 0004 D7:** Die dort skizzierte einzelne Policy `using (family_id is null or family_id = app.family_id())` war angreifbar – bei `UPDATE` passiert eine kuratierte Zeile den `USING`-Filter, und dasselbe Update kann ihr `family_id` auf die eigene Familie setzen. Eine Familie hätte geteilte Referenzdaten für alle anderen kapern können. Jetzt zwei getrennte Policies (Lesen: kuratiert oder eigen; Schreiben: nur eigen, in `USING` _und_ `WITH CHECK`). Die Lücke wurde vor dem Fix reproduziert und der Fix danach gegengeprüft
- ADR 0004 D4: `school_profile` stand in der Matrix fälschlich bei den familieneigenen Tabellen und folgt jetzt D7 – mehrere Familien können dieselbe Schule besuchen
- F-04d halbiert: `curriculum_pack`/`curriculum_node` haben vor dem 25. 9. keinen Konsumenten (erst T-05, Meilenstein 2) und würden ohne ein echtes Bildungsplan-PDF geraten. Als F-04g direkt vor T-05 vertagt
- Schema Schuljahr/Fach/Thema/Lernziel (F-04c): `school_year`, `subject`, `topic`, `learning_objective`, `objective_prerequisite` in `src/db/schema/curriculum.ts` mit drei neuen Enums (`school_year_status`, `topic_status`, `pathway_stage`, `self_assessment_level`). Fachbindung als DB-Constraint (§15 Fehler 2, ADR 0004 D3): `topic` referenziert `subject` über einen zusammengesetzten Fremdschlüssel auf `(id, student_id)`, ein Insert mit fachfremdem Fach scheitert an der Datenbank statt an Anwendungscode – per Test bewiesen. Genau ein `aktiv`-Schuljahr pro Schüler als partieller Unique-Index (§9). Zeitscheibe endet bei `topic` (ADR 0004 D6): `card`/`review`/`vocab_*` bekommen `school_year_id` bewusst nicht. `objective_prerequisite` als Selbstreferenz mit CHECK gegen Zirkularität (ein Lernziel kann nicht sein eigener Vorläufer sein). `learning_objective.title` und die drei Niveaubeschreibungs-Spalten (`description_grundlegend/regel/erhoeht`) sind Ergänzungen über die reine §8-Feldliste hinaus. `topic.source`/`curriculum_node_ref`/`textbook_ref` und `school_year.school_profile_id`/`curriculum_pack_id` bewusst ohne Fremdschlüssel, bis F-04d die Referenzdaten anlegt. 21 Policy- und Constraint-Tests
- `drizzle.config.ts` schließt jetzt auch `objective_prerequisite`-lange Fremdschlüsselnamen ein: zwei Constraint-Namen überschritten Postgres' 63-Zeichen-Grenze für Identifier und wurden explizit gekürzt benannt (`objective_prerequisite_student_fk`, `objective_prerequisite_prerequisite_fk`)
- Naming-Korrektur (vor F-04c): Bezeichner durchgängig englisch statt eines einzigen deutschen Ausreißers. `student.vorname/jahrgang/klasse` → `first_name/grade_level/class_name`; geplant `thema` → `topic`, `lehrwerk` → `textbook`, `kapitel` → `chapter` (ADR 0004 D8, CLAUDE.md-Kernkette). Migrationshistorie neu erzeugt (Produktiv-DB war noch leer, kein Datenverlust). Domänen-_Werte_ (Enum-Werte wie `erhoeht`) bleiben unverändert deutsch – nur Bezeichner ändern sich. Nebenbei: `drizzle.config.ts` schließt `*.test.ts` per Extglob vom Schema-Scan aus (drizzle-kit unioniert sonst alle `*.ts`-Treffer ohne Ausschluss-Semantik und versucht Testdateien als Schema zu laden)
- Schema Familie/Identität (F-04b): `family`, `parent_user`, `student` in `src/db/schema/family.ts` mit `family_id` und zusammengesetzten Fremdschlüsseln (ADR 0004 D2), erste Drizzle-Migration, Policies in `src/db/policies/0010-family.sql` und sieben Policy-Tests – Eltern sehen die ganze Familie, ein Kind nur sein eigenes Profil und ändert es nicht. Kind-Profile bleiben pseudonym (Vorname, Jahrgang, Klasse)
- `npm run db:migrate` wendet Migrationen **und** Policies an (vorher nur Policies); `db:migrate:test` macht dasselbe für die Test-Datenbank. Die Rolle `tutr_app` bekommt ihr Passwort nur beim Anlegen – ein `alter role ... password` vor jedem Lauf ließ den Pooler die nächste Anmeldung sporadisch mit 28P01 abweisen und war die Ursache eines flaky CI-Jobs. Rotation jetzt bewusst über `-- --rotate-password`
- RLS-Fundament (F-04a): Laufzeit-Rolle `tutr_app` (NOBYPASSRLS) und Helper `app.family_id()` / `app.student_id()` / `app.actor_role()` in `src/db/policies/0000-setup.sql`; `withActor()` in `src/db/actor.ts` setzt Rolle und Request-Kontext per `SET LOCAL`; Runner `scripts/db-apply-sql.mts` (`npm run db:policies`, in `db:migrate` verdrahtet); Test-Datenbank-Anbindung mit Wächter gegen Läufe auf dem Produktivprojekt; Tests für Fail-closed, Familientrennung und Transaktionsende; RLS-Metatest über alle Tabellen in `public`; CI-Job für die DB-Tests; `npm run db:doctor` prüft Rolle, Port, `sslmode` und Passwort einer Umgebung, ohne Geheimnisse auszugeben
- ADR 0004 (F-03): Datenmodell und RLS-Strategie – Actor-Kontext über eigene DB-Rolle `tutr_app` statt `auth.uid()` (Kind hat keinen Auth-Account, ADR 0002), `family_id` per zusammengesetztem Fremdschlüssel, Fachbindung als DB-Constraint (§15), Join-Tabellen statt ID-Arrays, Eltern-Sicht über getrennte Zusammenfassungstabellen, RLS-Metatest. Am Projekt gemessen: PG 17.6, `SET LOCAL ROLE` und Custom-GUCs über den Transaction Pooler bestätigt
- Tickets F-04a–f (Schema in Sessions geschnitten) und L-01 (Lehrwerk pro Fach erfassen)
- Supabase-Anbindung (F-02): Projekt in Frankfurt (`eu-central-1`), Browser- und Server-Client (`src/lib/supabase/`), Drizzle-Verbindung über postgres.js (`src/db/index.ts`, `prepare:false` für den Transaction Pooler), `drizzle.config.ts`, `dbEnv()` in `src/lib/env.ts`, Verbindungstest `npm run db:check` (grün)
- Projektgerüst: Next.js 16, TypeScript strict, Tailwind 4
- CLAUDE.md mit Domänen-, Stack- und Prozessregeln; Slash-Commands und Subagenten unter `.claude/`
- Tests: Vitest + Testing Library, Playwright (mobile + desktop), erstes Modul `src/lib/grades.ts`
- Git-Hooks (lint-staged, typecheck + Tests, Conventional Commits)
- CI (lint, typecheck, tests, build, e2e) und Security-Pipeline (gitleaks, npm audit, CodeQL), Dependabot
- Security-Header, Zod-validierte Umgebungsvariablen
- Docs: Konzept v2, Backlog, ADR 0001/0002/0003, SECURITY.md, SETUP.md
- Konzept §15: Ergänzungen aus Astra-Walkthrough (Selbsteinschätzung, Hook-Szenario, Zielnote, Prüfungsvorbereitungs-Seite, Anschlussfragen, Spracheingabe in V2); Tickets P-01, T-02a/b

### Changed

- Supabase auf das neue API-Key-System umgestellt (ADR 0003): `NEXT_PUBLIC_SUPABASE_ANON_KEY` → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` → `SUPABASE_SECRET_KEY`; betrifft `src/lib/env.ts`, `.env.example`, `docs/SETUP.md`
- Datenmodell-ADR verschiebt sich auf 0004 (F-03), da 0003 nun die API-Keys dokumentiert
- `tsconfig.json` schließt iCloud-Sync-Dubletten (`* 2.ts` u. ä.) vom Typecheck aus, damit `npm run check` lokal im iCloud-Ordner grün bleibt
- Dependabot-Major-PRs (eslint 10, TypeScript 7, @types/node 26) geschlossen; als Ticket F-08 vertagt
- Playwright-Setup deckt jetzt WebKit (iOS-Safari) ab, nicht nur Chromium – CI und `scripts/bootstrap.sh`
- GitHub Actions auf aktuelle Majors gehoben (`checkout`/`setup-node`/`upload-artifact` v7, `codeql-action` v4), weg von Node-20-Runnern
- `gitleaks-action` v2 → v3

### Fixed

- CI-Job `e2e` schlug fehl, weil das `mobile`-Playwright-Projekt (iPhone 14 → WebKit) ohne installierten WebKit lief
- CI-Job `secrets` schlug beim ersten Push fehl (gitleaks-action v2, fehlerhafte Commit-Range)
- `.env.example` fehlte im Repo, obwohl `bootstrap.sh`/`SETUP.md` sie voraussetzen (+ `.gitignore`-Ausnahme)
- `.gitignore` ignoriert jetzt Playwright-Artefakte (`test-results/`, `playwright-report/` u. a.)
- `.prettierignore`: kaputte erste Zeile `-e .next` → `.next`

### Security

- `browserslist` per `overrides` auf 4.28.9 gehoben (2× High, GHSA-c83g-rgw3-j3cx / GHSA-73wf-gq98-2v4g); `@serwist/next` pinnt die verwundbare 4.28.6 fest
- GitHub-Repo auf public umgestellt; Secret Scanning + Push Protection und Branch-Ruleset für `main` aktiviert
