# Changelog

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), Versionierung nach SemVer. Jedes Ticket trägt sich unter **Unreleased** ein; beim Release wird der Block umbenannt.

## [Unreleased]

### Added

- Projektgerüst: Next.js 16, TypeScript strict, Tailwind 4
- CLAUDE.md mit Domänen-, Stack- und Prozessregeln; Slash-Commands und Subagenten unter `.claude/`
- Tests: Vitest + Testing Library, Playwright (mobile + desktop), erstes Modul `src/lib/grades.ts`
- Git-Hooks (lint-staged, typecheck + Tests, Conventional Commits)
- CI (lint, typecheck, tests, build, e2e) und Security-Pipeline (gitleaks, npm audit, CodeQL), Dependabot
- Security-Header, Zod-validierte Umgebungsvariablen
- Docs: Konzept v2, Backlog, ADR 0001/0002, SECURITY.md, SETUP.md

### Changed

### Fixed

### Security
