@AGENTS.md

# tutr – Lern-PWA für Schülerinnen und Schüler

Next.js 16 (App Router, `src/`), TypeScript strict, Tailwind 4, Supabase (Postgres + Auth + Storage, EU), Drizzle ORM, Claude API, ts-fsrs, Vitest, Playwright. Hosting: Vercel.

## Zuerst lesen

- `docs/konzept.md` ist die Spezifikation (v2). Nie komplett laden – gezielt nach Abschnitt fragen:
  §3 Lernpfad · §4/§4a Tutor + Hausaufgaben · §6 Module · §8 Datenmodell · §9 Schuljahr · §10 Themen/Schichten · §11 Architektur + Auth
- `docs/PLAN.md` ist der Backlog. Arbeite immer an genau einem Ticket daraus.
- `docs/adr/` enthält getroffene Entscheidungen. Widersprich ihnen nicht stillschweigend – schlag einen neuen ADR vor.

## Domänenregeln (nicht verhandelbar)

- Kernkette: Family → Student → SchoolYear → Subject → Thema → LearningObjective. Karten, Vokabeln, Reviews und Mastery hängen an LearningObjective/Student, **nie** an SchoolYear.
- Eltern sehen Termine, Mastery, Noten, Zusammenfassungen – **nie** `tutor_sessions`. Das wird in RLS erzwungen, nicht nur in der UI.
- Hausaufgaben-Tutor: keine Lösung vor zwei dokumentierten Versuchen; Hinweisleiter §4a einhalten; Fachtabelle §4a beachten.
- Wissensschichten: eigenes Material > Lehrwerk > Kurrikulum-Pack > Allgemeinwissen. Der Tutor benennt die Quelle. Prüfungen nur aus Schicht 1+2.
- Kind-Profile sind pseudonym: kein Geburtsdatum, keine E-Mail, keine Schul-ID. Nur Vorname, Jahrgang, Klasse.
- UI-Sprache Deutsch, Du-Ansprache, Ton für 14-Jährige: respektvoll, nicht kindlich, kein Lob ohne Grund.

## Stack-Regeln

- Mutationen über Server Actions; Route Handler nur für Uploads, Webhooks, Cron.
- Drizzle-Schema in `src/db/schema/*.ts`, eine Datei pro Aggregat. Migrationen nur über `npm run db:generate`. Keine handgeschriebenen SQL-Migrationen außer für RLS-Policies (`src/db/policies/*.sql`).
- Jede Tabelle hat RLS. Neue Tabelle ohne Policy = Ticket nicht fertig.
- Claude API: Sonnet für Tutor, Vision, Generierung, Bewertung; Haiku für Klassifikation und Vokabel-Checks. Alle Modellantworten mit Structured Output gegen ein Zod-Schema in `src/ai/schemas/`. Prompts in `src/ai/prompts/` als Funktionen, nie inline. Prompt Caching für Thema-Kontextpakete.
- Spaced Repetition ausschließlich über `ts-fsrs`. Keine eigene Intervall-Logik.
- Formeln mit KaTeX. Kein MathJax.
- PWA über `@serwist/next`. Offline nur für Karten-/Vokabel-Sessions.
- Keine neue Dependency ohne Rückfrage. Keine `any`. Keine `// eslint-disable` ohne Begründung in derselben Zeile.
- Secrets nur aus `process.env` über `src/lib/env.ts` (Zod-validiert). Nie ins Repo, nie in Logs.

## Arbeitsweise

1. Ticket aus `docs/PLAN.md` nennen. Unklarheiten vor dem Coden klären.
2. Bei Änderungen an mehr als zwei Dateien: erst Plan mit Dateiliste und Begründung, dann warten.
3. Tests gehören zum Feature: Unit (Vitest) für Logik, Integration für Server Actions, E2E (Playwright) für den Nutzerpfad. Ein Feature ohne Test ist nicht fertig.
4. Vor jedem Commit: `npm run check` (lint + typecheck + unit tests) muss grün sein. Hooks erzwingen das.
5. Commits nach Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`), klein und thematisch.
6. Nach dem Feature: `docs/PLAN.md` (Status, offene Punkte) und `CHANGELOG.md` unter Unreleased aktualisieren. Kein Statusbericht im Chat, wenn er im Plan steht.

## Definition of Done

- [ ] Ticket-Ziel erfüllt, kein Scope Creep
- [ ] Tests geschrieben und grün; `npm run check` grün
- [ ] RLS für neue/geänderte Tabellen
- [ ] Keine neuen Lint-Warnungen, keine `any`
- [ ] Nutzerfreundliche Fehlermeldungen auf Deutsch
- [ ] `docs/PLAN.md` und `CHANGELOG.md` (Unreleased) aktualisiert; ADR, falls eine Entscheidung gefallen ist

## Befehle

`npm run dev` · `npm run check` · `npm run test` · `npm run test:e2e` · `npm run db:generate` · `npm run db:migrate` · `npm run security`

## Was du nicht tun sollst

- Keine Dateien in `docs/konzept.md` umschreiben – das ist die Spec, Änderungen laufen über den Menschen.
- Keine `git push --force`, kein Löschen von Migrationen, kein Deaktivieren von Hooks oder CI-Schritten.
- Keine Testdaten mit echten Namen von Lehrkräften oder Mitschülern.
