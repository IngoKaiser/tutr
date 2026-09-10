# Feature-Übersicht

**Stand: 10. September 2026** · Bezug: `docs/PLAN.md` (Backlog mit Begründung je Ticket),
`docs/roadmap.md` (Arbeitsreihenfolge), `docs/konzept.md` (Spezifikation).

Diese Tabelle ist der schnelle Blick von oben: wo steht welcher Bereich. Sie wird mit
**jedem Feature-PR** mitgezogen (steht so in `CLAUDE.md`, Definition of Done). Die
Begründung, warum etwas so geschnitten ist, steht in `docs/PLAN.md` – hier nur der Status.

## Legende

| Symbol | Bedeutung                                           |
| ------ | --------------------------------------------------- |
| ✅     | fertig und live                                     |
| 🌔     | fast fertig – im PR oder im Review                  |
| 🌓     | schmale Fassung steht, Vertiefung offen             |
| 🌒     | begonnen / Vorarbeit gelegt (Schema, ADR, Attrappe) |
| 🌑     | offen – noch nicht begonnen                         |

---

## Bereiche

| Bereich                  | Funktion                                                            | Stand | Ticket    |
| ------------------------ | ------------------------------------------------------------------- | ----- | --------- |
| **Fundament**            |                                                                     | ✅    |           |
|                          | Repo, CI, Security-Pipelines, Hooks                                 | ✅    | F-01      |
|                          | Supabase (EU/Frankfurt), Drizzle-Verbindung                         | ✅    | F-02      |
|                          | Datenmodell + RLS-Strategie (ADR 0004)                              | ✅    | F-03      |
|                          | `withActor()`, `app.*`-Helper, RLS-Metatest                         | ✅    | F-04a     |
|                          | Schema Identität, Kurrikulum, Lehrwerk-Registry                     | ✅    | F-04b–d   |
|                          | App-Shell: fünf Bereiche, Mobile-First                              | ✅    | F-07      |
|                          | Modell-Neuschnitt: Kind ist Mandant (ADR 0006)                      | ✅    | F-11      |
|                          | Seed-Skript                                                         | ✅    | F-04e     |
| **Anmeldung**            |                                                                     | ✅    |           |
|                          | Eltern: Magic Link (Supabase + Resend-SMTP)                         | ✅    | F-05      |
|                          | Kind: Passkey, auffindbar, ohne Kennung wiederkommen                | ✅    | F-06      |
|                          | Passkey auf fremdem Gerät → Registrierung statt Systemdialog        | ✅    | F-14      |
|                          | Elternbeitritt, Kindliste, Geräteliste                              | ✅    | F-06b     |
|                          | Wiederherstellung über die Kindliste                                | ✅    | F-06d     |
|                          | Kontolöschung (Kind, Kind durch Eltern, Elternkonto)                | ✅    | F-06e     |
|                          | Wiederherstellung vom Anmeldebildschirm aus                         | 🌑    | F-06f     |
|                          | Kind bearbeitet sein Profil (Einstellungen)                         | 🌑    | F-06c     |
|                          | Kontomenü hinter einem Avatar                                       | 🌑    | F-15      |
| **Fächer & Schuljahr**   |                                                                     | 🌓    |           |
|                          | Kind legt Fach + Schuljahr selbst an (ADR 0009)                     | ✅    | F-16a     |
|                          | Fach umbenennen, löschen mit Riegel                                 | ✅    | F-16a     |
|                          | `subject.language` – Grundlage für Sprachrichtung                   | ✅    | F-16a     |
|                          | Schuljahr umschalten, Historie, Sommer-Rollover                     | 🌑    | F-16b     |
|                          | Lehrwerk pro Fach erfassen                                          | 🌑    | L-01      |
| **Vokabeln**             |                                                                     | 🌓    |           |
|                          | Schema: Set, Item (beide Richtungen), FSRS-Karten                   | ✅    | V-01      |
|                          | Sets + Vokabelverwaltung, Bearbeiten an Ort und Stelle              | ✅    | V-03a     |
|                          | Einfügen mit Trennzeichen-Erkennung, Duplikaterkennung              | ✅    | V-03a     |
|                          | Foto & Kamera → Vision → dieselbe Liste                             | ✅    | V-03b     |
|                          | Foto-Import als Minigalerie, echte Fehlerursachen                   | ✅    | V-03c     |
|                          | Fachbindung im Modell (ADR 0008)                                    | ✅    | V-05      |
|                          | Vokabeln ohne Set sichtbar/löschbar machen                          | 🌑    | V-03d     |
|                          | Set-Modus: ein Set gezielt vor der Arbeit üben                      | 🌑    | V-04      |
|                          | Offline-Sessions (Service Worker)                                   | 🌑    | F-09      |
| **Üben**                 |                                                                     | 🌓    |           |
|                          | Session: drei Stapel, MC + Tippen, Tippfehlertoleranz               | ✅    | V-02      |
|                          | Rückmeldung richtig/fast/falsch, Ausstiegsknopf                     | ✅    | V-02      |
|                          | Fachgebundenes Üben, fällige Karten je Fach                         | ✅    | V-06      |
|                          | Zahl zeigt Vokabeln statt Karten; Richtung aus `subject.language`   | 🌑    | V-06a     |
|                          | Prüfungsmodus, Schwachstellen, Mix                                  | 🌑    | V-04      |
| **Heute**                |                                                                     | 🌒    |           |
|                          | Attrappe mit Platzhalter-Zahlen (F-07)                              | 🌒    | F-07      |
|                          | Echte Zahlen: fällige Karten je Fach, nächster Termin               | 🌑    | H-01      |
|                          | Countdown, Kamera-Knopf, Lernplan-Vorschlag                         | 🌑    | H-01      |
| **Prüfungskalender**     |                                                                     | 🌑    |           |
|                          | Termin von Hand anlegen, Liste, bearbeiten, absagen                 | 🌑    | K-01      |
|                          | Themen an einen Termin hängen, Countdown, Prüfungsseite             | 🌑    | P-01      |
|                          | Klausurplan per Foto einlesen                                       | 🌑    | K-03      |
|                          | Datei-Import CSV/XLSX (SchulDock) + ICS                             | 🌑    | K-04      |
| **Tutor & Hausaufgaben** |                                                                     | 🌑    |           |
|                          | Chatfenster, Kontext-Chip, freie Frage + „Verstehen"                | 🌑    | T-01/T-02 |
|                          | Sprachwächter (Tutor antwortet auf Deutsch)                         | 🌑    | T-02a     |
|                          | Rate Limits + CSP auf KI-Endpunkten                                 | 🌑    | S-03      |
|                          | Hausaufgabe: Foto → Aufgabenliste → Hinweisleiter                   | 🌑    | T-03      |
|                          | Einstieg Vorschau (Selbsteinschätzung → Hook)                       | 🌑    | T-04      |
|                          | Spracheingabe im Tutor                                              | 🌑    | T-02b     |
| **Material & Karten**    |                                                                     | 🌑    |           |
|                          | Material-Upload zu Thema (Foto/PDF/Link/Notiz)                      | 🌑    | M-01      |
|                          | Vision-Extraktion + Lernziel-Zuordnung                              | 🌑    | M-02      |
|                          | Generisches Karten-Schema + FSRS-Session                            | 🌑    | M-03      |
|                          | Karten aus Material erzeugen                                        | 🌑    | M-04      |
| **Kurrikulum**           |                                                                     | 🌑    |           |
|                          | Schema Kurrikulum-Pack                                              | 🌑    | F-04g     |
|                          | Pack `de-hh-gym-2023` importieren                                   | 🌑    | T-05      |
| **Betrieb**              |                                                                     | 🌓    |           |
|                          | Deploy `mytutr.de`, Domain, Preview/Production getrennt             | ✅    | D-01      |
|                          | E2E gegen die Test-Datenbank                                        | ✅    | F-13      |
|                          | Web Analytics (aggregiert, ohne Kennung)                            | ✅    | —         |
|                          | Datenbankrunden je Seite: >30 → <10; Funktionsregion Frankfurt      | ✅    | #44/#46   |
|                          | Ladezeit-Untersuchung (Region war `iad1` – im Dashboard umgestellt) | 🌔    | —         |
|                          | E2E gegen den Produktions-Build (echte Anmeldung)                   | 🌑    | F-10      |
|                          | Dev-Tooling-Bumps (eslint 10, TS 7)                                 | 🌑    | F-08      |

---

## Nächste Reihenfolge (aus `docs/roadmap.md`)

1. **V-03d + V-06a** — Vokabeln ohne Set aufräumbar machen; Übungszahl und Richtung stimmen
2. **K-01** — Prüfungskalender, Termine von Hand
3. **T-01/T-02 schmal + T-02a + S-03** — Tutor-Chat, mit Sprachwächter und Rate Limit von Anfang an
4. **T-03 schmal** — Hausaufgabe mit Hinweisleiter
5. **H-01 schmal** — Heute mit echten Daten
6. **V-04** — Set-Modus

Danach entscheidet die Rückmeldung aus echter Nutzung.

## Prüfungstermin

**25. September 2026: Französischarbeit.** Der prüfungskritische Weg (Vokabeln aufnehmen,
fachgebunden üben) steht live. Klemmt in den Tagen davor etwas, hat das Vorrang vor jeder
Roadmap.
