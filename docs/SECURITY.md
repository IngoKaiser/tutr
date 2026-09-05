# Sicherheitsleitlinien tutr

## Grundsätze

1. Daten einer Minderjährigen: nur erheben, was die Funktion braucht. Kind-Profile pseudonym.
2. Jede Tabelle hat RLS. Jede Server Action prüft die Session. Jede Eingabe wird mit Zod validiert.
3. Secrets nur über `src/lib/env.ts`; `NEXT_PUBLIC_` nur für Öffentliches.
4. Uploads: Typ und Größe serverseitig prüfen; Storage-Pfade `families/{familyId}/…`; nur signierte URLs mit Ablauf.
5. KI-Endpunkte: Rate Limit pro Profil; Systemprompt und Nutzereingabe strikt getrennt; Structured Output validiert; keine personenbezogenen Daten im Prompt außer Vorname und Jahrgang.
6. Abhängigkeiten: Dependabot wöchentlich, `npm audit` in CI (Level high), CodeQL bei jedem Push.
7. Secrets im Repo: gitleaks in CI; zusätzlich GitHub Secret Scanning + Push Protection in den Repo-Einstellungen aktivieren.

## Vor jedem Release

- `/security-review` in Claude Code ausführen
- Security-Header prüfen (E2E-Test `smoke.spec.ts`)
- Supabase: RLS auf allen Tabellen aktiv (`select * from pg_tables where rowsecurity = false and schemaname='public'` muss leer sein)

## Meldung

Sicherheitsprobleme bitte per Issue mit Label `security` (privat) oder direkt an den Maintainer.
