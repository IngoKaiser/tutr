# ADR 0001: Stack

Status: akzeptiert · Datum: 2026-09-05

## Kontext

Solo-Entwicklung am Feierabend, Nutzung durch eine Schülerin, später evtl. Geschwister/Familien. Kosten nahe 0 €, EU-Datenhaltung, PWA statt Store-App.

## Entscheidung

- Next.js 16 App Router auf Vercel; PWA via @serwist/next
- Supabase (EU/Frankfurt): Postgres, Auth, Storage, RLS – ein Anbieter für drei Bausteine
- Drizzle ORM + drizzle-kit; RLS-Policies als SQL im Repo
- Claude API (Sonnet für Tutor/Vision/Generierung, Haiku für Klassifikation), Structured Outputs mit Zod
- ts-fsrs für Spaced Repetition; KaTeX für Formeln
- Vitest + Testing Library (Unit/Komponenten), Playwright (E2E, mobile + desktop)
- GitHub Actions: CI (lint, typecheck, test, build, e2e), Security (gitleaks, npm audit, CodeQL), Dependabot

## Verworfen

- Neon via Vercel Marketplace: gleich günstig, aber Auth/Storage/RLS-Integration wären Zusatzarbeit; Scale-to-zero-Cold-Starts bei sporadischer Handy-Nutzung
- Native Apps: Store-Prozess, zwei Codebasen

## Konsequenzen

- Magic-Link-Mails über eigenes SMTP (Resend), da Supabase-Default-SMTP limitiert
- Passkeys (WebAuthn) selbst implementieren, unabhängig vom Auth-Anbieter
