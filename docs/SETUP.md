# Setup und Entwicklungsstart

Zielgruppe: du, einmalig auf deinem Mac/PC. Dauer ca. 45 Minuten inkl. GitHub- und Supabase-Anlage.

## Teil A – Lokal einrichten (10 Min)

1. **ZIP entpacken**
   ```bash
   mkdir -p ~/dev && cd ~/dev
   unzip ~/Downloads/tutr-repo.zip     # erzeugt ~/dev/tutr
   cd tutr
   git log --oneline                   # 4 Commits sichtbar → Repo ist bereits initialisiert
   ```
2. **Node 22**
   ```bash
   nvm install 22 && nvm use           # oder: node -v muss 22.x zeigen
   ```
3. **Bootstrap**
   ```bash
   ./scripts/bootstrap.sh
   ```
   Installiert Abhängigkeiten aus dem Lockfile, aktiviert Git-Hooks, lädt Chromium + WebKit für Playwright (WebKit deckt iOS-Safari ab, das Ziel-Umfeld), führt `npm run check` aus. Endet mit ✔.
4. **Einmal starten**
   ```bash
   SKIP_ENV_VALIDATION=1 npm run dev   # http://localhost:3000 zeigt „tutr"
   ```

## Teil B – GitHub (10 Min)

5. Auf github.com ein **privates, leeres** Repo `tutr` anlegen (kein README, keine .gitignore).
6. **Handle eintragen und pushen**
   ```bash
   sed -i '' 's/DEIN-GITHUB-HANDLE/deinhandle/' .github/CODEOWNERS   # macOS; Linux ohne ''
   git commit -am "chore: CODEOWNERS"
   git remote add origin git@github.com:deinhandle/tutr.git
   git push -u origin main
   ```
   Unter „Actions" laufen jetzt CI und Security. CodeQL braucht beim ersten Mal einige Minuten.
7. **Repo-Einstellungen**
   - Settings → Branches → Add rule für `main`: „Require a pull request" und „Require status checks": `check`, `e2e`, `secrets`, `dependencies`, `codeql`
   - Settings → Code security: Dependabot alerts, Secret scanning, Push protection aktivieren

## Teil C – Dienste und Schlüssel (15 Min)

8. **Supabase**: supabase.com → New project → Region **Frankfurt (eu-central-1)**. Unter Project Settings → API: URL, `anon` Key, `service_role` Key. Unter Database → Connection string (URI, Transaction Mode für Serverless).
9. **Anthropic**: console.anthropic.com → API Keys → neuen Key für „tutr".
10. **.env.local**
    ```bash
    cp .env.example .env.local
    openssl rand -base64 32    # → INVITE_TOKEN_SECRET
    ```
    Werte eintragen. Die Datei ist in `.gitignore` und für Claude Code per `.claude/settings.json` gesperrt.
11. **Vercel** (kann warten bis Ticket D-01): vercel.com → Import Git Repository → Environment Variables aus `.env.local` übernehmen, Region Frankfurt (fra1).

## Teil D – Claude Code (5 Min)

12. **Installieren**, falls nötig: https://docs.claude.com/en/docs/claude-code/overview (npm-Paket `@anthropic-ai/claude-code` oder Desktop-App). Dann im Repo:
    ```bash
    cd ~/dev/tutr
    claude
    ```
13. **Anmelden und prüfen**
    ```
    /login                 # Pro-Konto
    /model                 # Sonnet 5 sollte Default sein
    /context               # CLAUDE.md + AGENTS.md geladen, docs/konzept.md NICHT komplett
    ```
14. **Rauchtest**
    ```
    Fasse in fünf Sätzen zusammen, was tutr ist und welche drei Domänenregeln du beachten musst.
    ```
    Antwortet Claude sinnvoll aus CLAUDE.md und docs/konzept.md, ist der Kontext richtig verdrahtet.

## Teil E – Erste Entwicklungssession (Datenmodell)

15. ```
    /model opusplan
    /plan-session Datenmodell
    ```
    Claude liest §8–§10 des Konzepts, schreibt `docs/adr/0003-datenmodell.md` als Entwurf und schneidet Tickets. **Kein Code.**
16. ADR lesen. Prüfen: Hängen Karten/Vokabeln an LearningObjective und nicht an SchoolYear? Ist `tutor_sessions` für Eltern per RLS gesperrt? Gibt es Niveaustufen am Lernziel? Korrekturen im Chat, dann „ADR freigegeben".
17. ```
    /feature F-03
    ```
    Plan mit Dateiliste freigeben → Umsetzung → `npm run check` grün → `/review` → commit:
    ```bash
    git add -A && git commit -m "feat(db): Kern-Schema und RLS-Strategie (F-03)"
    git push
    ```
18. `docs/PLAN.md` und `CHANGELOG.md` sind Teil des Tickets – Claude aktualisiert beide, du kontrollierst.

## Rhythmus danach

- Pro Session ein Ticket: `/clear` → `/feature K-01` → Plan → Umsetzung → `/review` → Commit → Push.
- Architektur-Tickets (im Plan mit **[opusplan]** markiert) mit `/model opusplan` starten, danach `/model sonnet`.
- Vor Merges an Auth, RLS, Uploads oder KI-Endpunkten: `/security-review`.
- Bei Problemen mit Next.js 16: Claude soll `node_modules/next/dist/docs/` lesen (steht in AGENTS.md), nicht raten.
- Wochenlimit im Blick: schwere Sessions an den Anfang eines 5-Stunden-Fensters, UI-Arbeit auf `/effort medium`.
