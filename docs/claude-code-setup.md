# tutr mit Claude Code bauen – Modellwahl und Limit-Strategie (Pro-Plan)

Stand: 5. September 2026. Quellen: code.claude.com/docs/en/model-config und support.claude.com (Models, usage, and limits in Claude Code). Modellnamen und Verfügbarkeit ändern sich – `/model` im Terminal ist immer die Wahrheit für deinen Account.

---

## 1. Empfehlung in einem Satz

**Sonnet 5 als Arbeitsmodell (Pro-Standard, 1M Kontext ohne Zusatzkosten), `opusplan` für die wenigen Architektur-Sessions, Haiku für Subagenten und Kleinkram, Effort auf `high` lassen und nur gezielt hoch- oder runterdrehen, kein Fable.**

---

## 2. Was auf Pro gilt

| Punkt                             | Stand                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Standardmodell auf Pro            | **Sonnet 5**                                                                                                |
| Kontext Sonnet 5                  | **1M nativ**, keine Usage Credits nötig, auf keinem Plan                                                    |
| Opus 5                            | verfügbar, verbraucht „meaningfully more" vom Kontingent; 1M-Kontext für Opus auf Pro nur mit Usage Credits |
| Fable 5.1                         | je nach Plan über Usage Credits, nie Account-Default → für tutr nicht nötig                                 |
| Metering                          | rollierendes 5-Stunden-Fenster + Wochenlimit über alle Modelle; Nutzung wird mit der Claude-App geteilt     |
| Effort-Stufen (Sonnet 5 / Opus 5) | `low · medium · high · xhigh · max`; Default `high`                                                         |
| `opusplan`                        | Opus im Plan-Modus, Sonnet in der Ausführung; Kontext bleibt erhalten                                       |

**Was das Kontingent wirklich frisst:** nicht die Zahl der Prompts, sondern Kontext, der auf jedem Turn erneut mitgeschickt wird (Verlauf + gelesene Dateien + CLAUDE.md), Modellwahl und Effort. Ein langer Debugging-Nachmittag ohne `/clear` kostet mehr als zwanzig saubere Kurz-Sessions.

---

## 3. Modell-Routing für tutr

| Arbeit                                                                                                       | Modell                  | Effort                  | Warum                                                                            |
| ------------------------------------------------------------------------------------------------------------ | ----------------------- | ----------------------- | -------------------------------------------------------------------------------- |
| Datenmodell, RLS-Policies, Auth-Flow, FSRS-Integration, Tutor-Prompt-Architektur, Import-Pipelines entwerfen | `opusplan` (Plan-Modus) | high                    | Hier zahlt sich Tiefe aus; Plan wird einmal geschrieben, danach führt Sonnet aus |
| Features bauen: Screens, Server Actions, Drizzle-Schema umsetzen, Tests, bekannte Bugs                       | **Sonnet 5**            | high (Default)          | Deckt >80 % der Arbeit ab, 1M Kontext, günstig                                   |
| Vision-/Structured-Output-Prompts iterieren (Vokabelseite, Klausurplan, Hausaufgabe)                         | Sonnet 5                | high, punktuell `xhigh` | Prompt-Engineering profitiert von Reasoning, aber nicht dauerhaft                |
| Kniffliges Debugging über mehrere Dateien, wenn Sonnet zweimal danebenliegt                                  | Opus 5 für die Session  | high                    | Erst dann – nicht vorbeugend                                                     |
| Renames, Boilerplate, Lint-Fixes, Kommentare, Migrationsdateien anlegen                                      | **Haiku** (Subagent)    | low/medium              | Mechanisch, billig                                                               |
| UI-Politur, Tailwind-Klassen, Copy-Texte                                                                     | Sonnet 5                | medium                  | Kein tiefes Denken nötig                                                         |

**Nie:** `max`-Effort im Alltag (Overthinking, teuer), Fable für Routinearbeit, Opus als Dauer-Default.

---

## 4. Konfiguration

### `~/.claude/settings.json` (User-Ebene)

```json
{
  "model": "sonnet",
  "effortLevel": "high",
  "fallbackModel": ["claude-sonnet-5", "claude-haiku-4-5"],
  "env": {
    "CLAUDE_CODE_SUBAGENT_MODEL": "haiku"
  }
}
```

### Im Projekt `.claude/settings.json`

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run typecheck)",
      "Bash(npm test)",
      "Bash(npx drizzle-kit generate)",
      "Bash(git status)",
      "Bash(git diff)"
    ]
  }
}
```

### Während der Session

- `/model opusplan` zu Beginn einer Architektur-Session, danach `/model sonnet` (oder einfach im Plan-Modus bleiben, opusplan wechselt selbst).
- `/effort medium` für UI-Nachmittage, `/effort high` zurück für Logik.
- `ultrathink` im Prompt für einen einzelnen schweren Turn statt Effort global hochzudrehen.

---

## 5. Zehn Gewohnheiten, die auf Pro den Unterschied machen

1. **`/clear` bei jedem Aufgabenwechsel.** Test: Würde der nächste Prompt in einem frischen Terminal Sinn ergeben? Dann vorher clearen.
2. **Eine Session = ein Feature.** „Vokabel-Foto-Import" ist eine Session, „Kalender-Review-Screen" die nächste.
3. **Plan vor jeder Änderung an mehr als zwei Dateien.** „Liste die Dateien, die du anfasst, und was du in jeder tust" – lesen, korrigieren, dann ausführen. Ein falscher 400-Zeilen-Diff kostet doppelt.
4. **Dateien referenzieren, nicht einfügen.** `src/lib/fsrs.ts` als Pfad nennen; `@` nur, wenn die ganze Datei wirklich rein soll. Logs auf 20–30 Zeilen kürzen.
5. **CLAUDE.md unter 200 Zeilen** (Vorlage unten). Nur Regeln, die du zweimal korrigieren musstest.
6. **Konzept als Datei im Repo, nicht im Prompt.** `docs/konzept.md` = v2-Konzept; im Prompt nur „lies Abschnitt 4a in docs/konzept.md".
7. **Ungenutzte MCP-Server abschalten.** Jeder Server hängt Tool-Definitionen in jeden Turn. Für tutr reichen Dateisystem + ggf. Supabase-MCP.
8. **`/context` alle paar Turns.** Wenn der Verlauf über ~150k liegt, `/compact` – oder besser `/clear` mit kurzem Handover-Prompt.
9. **Schwere Sessions an den Anfang eines 5-Stunden-Fensters legen.** Architektur morgens mit opusplan, Feierabend-Features nachmittags mit Sonnet.
10. **Wenn das Limit kommt:** `/model haiku` für Kleinkram oder Pause – nicht Usage Credits aus Reflex einschalten. Wochenlimit im Blick behalten; es gilt über alle Modelle und wird mit der Claude-App geteilt.

---

## 6. Vorlage `CLAUDE.md` für tutr

```markdown
# tutr – Lern-PWA (Next.js 15 App Router, Supabase, Drizzle, Tailwind, shadcn/ui, Claude API)

## Kontext

- Konzept: docs/konzept.md (v2). Nie ganz laden; Abschnitte gezielt referenzieren.
- Zielnutzerin: Schülerin Jg. 8, deutsches UI, Du-Ansprache, kein Kindergarten-Ton.
- Kernobjekte: Family → Student → SchoolYear → Subject → Thema → LearningObjective. Karten/Vokabeln hängen an LearningObjective, nie am Schuljahr.

## Stack-Regeln

- Server Actions für Mutationen, Route Handler nur für Webhooks/Uploads.
- Drizzle-Schema in src/db/schema/*.ts; Migrationen via drizzle-kit, nie manuell.
- Supabase RLS für jede Tabelle; Eltern sehen nie tutor_sessions.
- Claude API: Sonnet für Tutor/Vision/Generierung, Haiku für Klassifikation. Structured Outputs mit Zod-Schema in src/ai/schemas/. Prompt Caching für Thema-Kontextpakete.
- FSRS über ts-fsrs; nie eigene Intervall-Logik schreiben.
- Formeln: KaTeX. Kein MathJax.
- PWA: @serwist/next; Offline nur für Karten-Sessions.

## Tutor-Regeln (siehe docs/konzept.md §4, §4a)

- Hausaufgaben: nie Lösung vor zwei dokumentierten Versuchen; Hinweisleiter einhalten.
- Schichten: eigenes Material > Lehrwerk > Kurrikulum > Allgemeinwissen; Quelle im Text benennen.
- Prüfungen nur aus Schicht 1+2 generieren.

## Arbeitsweise

- Vor Änderungen an >2 Dateien: Plan mit Dateiliste, dann warten.
- Nach jeder Änderung: npm run typecheck && npm run lint.
- Deutsch in UI-Strings und Kommentaren zu Fachlogik; Code-Bezeichner Englisch.
- Keine neuen Dependencies ohne Rückfrage.
```

---

## 7. Startreihenfolge (erste zwei Wochen)

| Session | Modell                  | Inhalt                                                                                  |
| ------- | ----------------------- | --------------------------------------------------------------------------------------- |
| 1       | opusplan                | Repo anlegen, Datenmodell + RLS aus docs/konzept.md §8/§9/§10 als Drizzle-Schema planen |
| 2–3     | Sonnet                  | Schema umsetzen, Auth-Flow Eltern/Kind (Passkey + Einladungslink), Heute-Screen-Skelett |
| 4       | opusplan                | Import-Pipelines planen (Klausurplan-Bild, Vokabelseite) – Zod-Schemas, Review-Screen   |
| 5–7     | Sonnet                  | Kalender mit Bild-Import + Review; Vokabelsets + FSRS-Session                           |
| 8       | Sonnet, xhigh punktuell | Vision-Prompts gegen echte Fotos iterieren (Fixture: beispiel-import-klausurplan.json)  |
| 9–10    | Sonnet                  | PWA-Manifest, Offline-Karten, Vercel-Deploy, erste Nutzung mit deiner Tochter           |

Ziel: Französisch-Arbeit am 25. 9. mit tutr vorbereitet.
