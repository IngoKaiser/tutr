# tutr – Backlog

Status: `todo` · `doing` · `done` · `blocked`. Ein Ticket = maximal eine Claude-Code-Session. Reihenfolge = Priorität. Ziel Meilenstein 1: Französisch-Arbeit 25. 9. 2026 mit tutr vorbereitet.

## Meilenstein 0 – Fundament (Woche 1)

| ID    | Ticket                                                                                                                                                                                   | Konzept     | Status | Notizen                                                                       |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------ | ----------------------------------------------------------------------------- |
| F-01  | Repo-Setup prüfen: `npm run check` grün, Hooks aktiv, CI grün auf GitHub                                                                                                                 | –           | done   | `scripts/bootstrap.sh`                                                        |
| F-08  | Dev-Tooling: eslint 10 / TypeScript 7 / @types/node 26 evaluieren (Major-Bumps, Dependabot-PRs #4–#6 geschlossen)                                                                        | –           | todo   | einzeln, Flat-Config + tsc-Breaking prüfen                                    |
| F-02  | Supabase-Projekt (EU/Frankfurt) anlegen, `.env.local`, Verbindung testen                                                                                                                 | §11         | done   | Region Frankfurt (`eu-central-1`); Clients + Drizzle; `npm run db:check` grün |
| F-03  | **[opusplan]** ADR 0004: Datenmodell + RLS-Strategie                                                                                                                                     | §8, §9, §10 | done   | ADR 0004 akzeptiert; Schema-Arbeit in F-04a–f geschnitten                     |
| F-04a | Rolle `tutr_app` (Anmeldung über Supavisor verifizieren), `MIGRATION_DATABASE_URL` trennen, `app.*`-Helper, `withActor()`, Policy-Runner in `db:migrate`, RLS-Metatest, Test-DB anbinden | §8, §11     | todo   | ADR 0004 D1/D9; Fallback Session-Pooler                                       |
| F-04b | Schema Familie/Identität: `family`, `parent_user`, `student` + Policies + Tests                                                                                                          | §8          | todo   | ADR 0004 D2/D4                                                                |
| F-04c | Schema `school_year`, `subject`, `school_year_textbook`, `thema`, `learning_objective`, `objective_prerequisite` inkl. Fachbindungs-Constraint + Policies + Tests                        | §8, §9, §10 | todo   | ADR 0004 D3/D6; Test für §15 Fehler 2                                         |
| F-04d | Schema Referenzdaten: `curriculum_pack`, `curriculum_node`, `lehrwerk`, `kapitel`, `school_profile` + Shared-Read-Policy                                                                 | §7          | todo   | ADR 0004 D7                                                                   |
| F-04e | Seed-Skript `npm run db:seed`: zwei Familien, Geschwisterkind, Fächer, ein Thema mit Lernzielen – Basis aller Policy-Tests                                                               | §8          | todo   | nach F-04c/F-04d                                                              |
| F-04f | CLAUDE.md + `src/db/policies/README.md`: Actor-Regel und Checkliste je neuer Tabelle                                                                                                     | –           | todo   | nach F-04a                                                                    |
| F-05  | Auth Eltern: Magic Link (Supabase Auth), Session-Handling, geschützte Routen                                                                                                             | §11 Auth    | todo   | E2E: Login-Flow                                                               |
| F-06  | Auth Kind: Einladungslink (signierter Token, 24 h), Profilwahl, Passkey-Registrierung (WebAuthn), PIN-Fallback, 90-Tage-Session                                                          | §11 Auth    | todo   | ADR 0002                                                                      |
| F-07  | App-Shell: 5 Bereiche (Heute, Fächer, Üben, Prüfungen, Tutor), Mobile-Navigation, PWA-Manifest, Serwist                                                                                  | §5, §11     | todo   | Lighthouse PWA-Check                                                          |

## Meilenstein 1 – Kalender + Vokabeln (Woche 2–3)

| ID   | Ticket                                                                                                                                                                         | Konzept       | Status | Notizen                                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ------ | ------------------------------------------------------- |
| K-01 | CalendarEvent-Schema + manuelle Eingabe (Formular, Liste 4 Wochen, Bearbeiten, Absagen, Historie)                                                                              | §6 M7, §7c/7d | todo   |                                                         |
| K-02 | **[opusplan]** Import-Pipeline planen: Zod-Schema für Klausurplan-Import, Review-Screen, Re-Import-Matching                                                                    | §6 M7 7a/7b   | todo   | Fixture: docs/fixtures                                  |
| K-03 | Bild-Import Klausurplan (Vision → Structured Output → Review → Speichern), Gruppenfilter, Blocker-Typen                                                                        | §6 M7         | todo   | Test gegen Fixture                                      |
| K-04 | Datei-Import CSV/XLSX (SchulDock-Export) + ICS                                                                                                                                 | §6 M7         | todo   |                                                         |
| L-01 | Lehrwerk pro Fach erfassen: Einstellungen → Schuljahr → Fach; Foto vom Inhaltsverzeichnis (Vision → Review) · manuell · Claude-Vorschlag (markiert)                            | §7, §10       | todo   | Voraussetzung für V-01; Eingabe nach Elternabend 15. 9. |
| V-01 | Vokabel-Schema: Lehrwerk, Unit, Set, VocabItem (beide Richtungen), FSRS-State via ts-fsrs                                                                                      | §6 M4         | todo   |                                                         |
| V-02 | Vokabel-Session: Stapel Sitzt/Fast/Nochmal, Modi MC + Tippen, Antwortzeit, Tippfehlertoleranz                                                                                  | §6 M4         | todo   | Unit-Tests für Session-Queue                            |
| V-03 | Foto-Import Vokabelseite (Vision → Review-Screen mit Duplikaten → Set)                                                                                                         | §6 M4         | todo   |                                                         |
| V-04 | Modi: Fällig heute (setübergreifend), Prüfungsmodus (Sets der nächsten Arbeit), Schwachstellen                                                                                 | §6 M4         | todo   |                                                         |
| H-01 | Heute-Screen: fällige Karten, nächste Prüfung mit Countdown, Kamera-Button                                                                                                     | §5            | todo   |                                                         |
| P-01 | Prüfungsvorbereitungs-Seite: Event + Themen (nur gleiches Fach!) + Zielnote + Fortschritt (Sicherheit vs. Ziel) + verknüpfte Vokabelsets; Ladezustände mit benannten Schritten | §15, §6 M7    | todo   | Constraint + Test: Thema.fach == Event.fach             |
| D-01 | Vercel-Deploy, Domain, erste Nutzung mit Tochter, Feedback-Runde                                                                                                               | –             | todo   |                                                         |

## Meilenstein 2 – Material + Tutor (V2 im Konzept)

| ID    | Ticket                                                                                                            | Konzept | Status |
| ----- | ----------------------------------------------------------------------------------------------------------------- | ------- | ------ |
| M-01  | Material-Upload zu Thema (Foto/PDF/Buchangabe/Link/Notiz), Storage-Pfade pro Familie, signierte URLs              | §10     | todo   |
| M-02  | Vision-Extraktion + Lernziel-Zuordnung                                                                            | §6 M2   | todo   |
| M-03  | Karten-Schema + FSRS-Session (generisch, nicht nur Vokabeln)                                                      | §6 M3   | todo   |
| M-04  | Karten-Generierung aus Material                                                                                   | §6 M2   | todo   |
| T-01  | **[opusplan]** Tutor-Architektur: Kontextpaket pro Thema, Schichten, Prompt Caching, Einstiegs-Router             | §4, §10 | todo   |
| T-02  | Einstieg Verstehen (Text, Erklär-es-anders, Verständnischeck, Anschlussfragen-Chips, Kontext-Chip Fach › Thema)   | §4, §15 | todo   |
| T-02a | Sprachwächter: Systemprompt-Sprache + Unit-Test, dass Tutor-Antworten deutsch sind (Ausnahme Fremdsprachenfächer) | §15     | todo   |
| T-02b | Spracheingabe (Web Speech API) im Tutor mit sichtbarem Zustand „tutr hört zu“                                     | §15     | todo   |
| T-03  | Einstieg Hausaufgabe (Foto → Aufgabenliste → Hinweisleiter → Lösung nach 2 Versuchen)                             | §4a     | todo   |
| T-04  | Einstieg Vorschau: Selbsteinschätzung (5 Stufen) → Hook-Szenario → Landkarte → Vorwissens-Check                   | §4, §15 | todo   |
| T-05  | Kurrikulum-Pack `de-hh-gym-2023` importieren (manuell geladene PDFs → JSON)                                       | §7      | todo   |
| S-03  | Content-Security-Policy, Rate Limits auf KI-Endpunkten                                                            | §11     | todo   |

## Meilenstein 3 – Prüfen + Lernplan (V3) · Meilenstein 4 – Audio/Visuals/Eltern (V4)

Siehe docs/konzept.md §12. Tickets werden nach Meilenstein 2 geschnitten.

## Entscheidungen / Offen

- Pilotfach: Französisch oder Englisch? (Elternabend 15. 9.: Lehrwerke erfragen → Eingabe über L-01, nicht per Hand in die DB)
- Zeitbudget pro Tag für Lernplan: ?
