# tutr

Lern-PWA für Schülerinnen und Schüler: Prüfungskalender, Vokabeln und Karten mit Spaced Repetition, Material-Upload, sokratischer Tutor mit Hausaufgaben-Support. Konzept in `docs/konzept.md`.

## Start

```bash
git clone <repo> && cd tutr
nvm use                      # Node 22
./scripts/bootstrap.sh       # installiert Tooling + Laufzeit, aktiviert Hooks, führt Checks aus
cp .env.example .env.local   # Supabase- und Anthropic-Schlüssel eintragen
npm run dev
```

## Entwicklung mit Claude Code

```bash
claude                       # liest CLAUDE.md
/feature F-03                # Ticket aus docs/PLAN.md umsetzen
/review                      # Diff gegen Definition of Done
/security-review             # vor Merges an Auth/RLS/Uploads/KI
/plan-session Datenmodell    # mit /model opusplan
```

Modell-Strategie und Limit-Tipps: `docs/claude-code-setup.md`.

## Qualität

- `npm run check` = lint + typecheck + Unit-Tests (Pflicht vor Commit; Hooks erzwingen lint-staged, typecheck, Tests, Conventional Commits)
- `npm run test:e2e` = Playwright (mobile + desktop)
- CI: `.github/workflows/ci.yml` · Security: `.github/workflows/security.yml` (gitleaks, npm audit, CodeQL) · Dependabot wöchentlich

## Struktur

```
src/app          Routen (App Router)
src/components   UI
src/lib          Reine Logik (getestet)
src/db/schema    Drizzle-Schema, eine Datei pro Aggregat
src/db/policies  RLS-Policies (SQL)
src/ai/schemas   Zod-Schemas für Structured Outputs
src/ai/prompts   Prompt-Funktionen
tests/e2e        Playwright
docs/            Konzept, Backlog, ADRs, Fixtures
```

## Repo-Einstellungen auf GitHub (einmalig)

- Branch Protection für `main`: PR erforderlich, Status-Checks `check`, `e2e`, `secrets`, `dependencies`, `codeql` müssen grün sein
- Security → Secret scanning + Push protection aktivieren, Dependabot alerts aktivieren
- `.github/CODEOWNERS`: eigenen Handle eintragen
