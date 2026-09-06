# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach SemVer. Jedes Ticket trägt sich unter **Unreleased** ein; beim Release wird der Block umbenannt.

## [Unreleased]

### Added

- Supabase-Anbindung (F-02): Browser- und Server-Client (`src/lib/supabase/`), Drizzle-Verbindung über postgres.js (`src/db/index.ts`, `prepare:false` für den Transaction Pooler), `drizzle.config.ts`, `dbEnv()` in `src/lib/env.ts`, Verbindungstest `npm run db:check`
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
