# Feature-Übersicht

**Stand: 11. September 2026** · Bezug: `docs/PLAN.md` (Backlog mit Begründung je Ticket),
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

| Bereich                  | Funktion                                                                           | Stand | Ticket  |
| ------------------------ | ---------------------------------------------------------------------------------- | ----- | ------- |
| **Fundament**            |                                                                                    | ✅    |         |
|                          | Repo, CI, Security-Pipelines, Hooks                                                | ✅    | F-01    |
|                          | Supabase (EU/Frankfurt), Drizzle-Verbindung                                        | ✅    | F-02    |
|                          | Datenmodell + RLS-Strategie (ADR 0004)                                             | ✅    | F-03    |
|                          | `withActor()`, `app.*`-Helper, RLS-Metatest                                        | ✅    | F-04a   |
|                          | Schema Identität, Kurrikulum, Lehrwerk-Registry                                    | ✅    | F-04b–d |
|                          | App-Shell: fünf Bereiche, Mobile-First                                             | ✅    | F-07    |
|                          | Rahmen steht fest: kein Body-Scroll, kein Zoom beim Feld-Fokus                     | ✅    | F-18    |
|                          | Modell-Neuschnitt: Kind ist Mandant (ADR 0006)                                     | ✅    | F-11    |
|                          | Seed-Skript                                                                        | ✅    | F-04e   |
| **Anmeldung**            |                                                                                    | ✅    |         |
|                          | Eltern: Magic Link (Supabase + Resend-SMTP)                                        | ✅    | F-05    |
|                          | Kind: Passkey, auffindbar, ohne Kennung wiederkommen                               | ✅    | F-06    |
|                          | Passkey auf fremdem Gerät → Registrierung statt Systemdialog                       | ✅    | F-14    |
|                          | Elternbeitritt, Kindliste, Geräteliste                                             | ✅    | F-06b   |
|                          | Wiederherstellung über die Kindliste                                               | ✅    | F-06d   |
|                          | Kontolöschung (Kind, Kind durch Eltern, Elternkonto)                               | ✅    | F-06e   |
|                          | Wiederherstellung vom Anmeldebildschirm aus                                        | 🌑    | F-06f   |
|                          | Kind bearbeitet sein Profil (Einstellungen)                                        | 🌑    | F-06c   |
|                          | Kontomenü hinter einem Avatar                                                      | 🌑    | F-15    |
| **Fächer & Schuljahr**   |                                                                                    | 🌓    |         |
|                          | Kind legt Fach + Schuljahr selbst an (ADR 0009)                                    | ✅    | F-16a   |
|                          | Fach umbenennen, löschen mit Riegel                                                | ✅    | F-16a   |
|                          | `subject.language` – Grundlage für Sprachrichtung                                  | ✅    | F-16a   |
|                          | Schuljahr umschalten, Historie, Sommer-Rollover                                    | 🌑    | F-16b   |
|                          | Lehrwerk pro Fach erfassen                                                         | 🌑    | L-01    |
| **Vokabeln**             |                                                                                    | 🌓    |         |
|                          | Schema: Set, Item (beide Richtungen), FSRS-Karten                                  | ✅    | V-01    |
|                          | Sets + Vokabelverwaltung, Bearbeiten an Ort und Stelle                             | ✅    | V-03a   |
|                          | Einfügen mit Trennzeichen-Erkennung, Duplikaterkennung                             | ✅    | V-03a   |
|                          | Foto & Kamera → Vision → dieselbe Liste                                            | ✅    | V-03b   |
|                          | Foto-Import als Minigalerie, echte Fehlerursachen                                  | ✅    | V-03c   |
|                          | Foto-Import: erst sammeln dann „Einlesen“, drehen, einzeln entfernen               | ✅    | V-10    |
|                          | Wischen zum Löschen mit Rückgängig-Fenster (Liste + Waisen)                        | ✅    | V-11    |
|                          | Erklärung des Lernrhythmus für Kinder (aufklappbar, SVG)                           | ✅    | V-13    |
|                          | „Geprüft“-Zustand: akzeptierte Zeilen normal, Ungeprüftes nicht im Üben            | ✅    | V-09    |
|                          | Fachbindung im Modell (ADR 0008)                                                   | ✅    | V-05    |
|                          | Vokabeln ohne Set sichtbar/löschbar machen                                         | ✅    | V-03d   |
|                          | Set-Modus: ein Set gezielt vor der Arbeit üben                                     | 🌑    | V-04    |
|                          | Offline-Sessions (Service Worker)                                                  | 🌑    | F-09    |
| **Üben**                 |                                                                                    | 🌓    |         |
|                          | Session: drei Stapel, MC + Tippen, Tippfehlertoleranz                              | ✅    | V-02    |
|                          | Rückmeldung richtig/fast/falsch, Ausstiegsknopf                                    | ✅    | V-02    |
|                          | Fachgebundenes Üben, fällige Karten je Fach                                        | ✅    | V-06    |
|                          | Zahl zeigt Vokabeln statt Karten; Richtung aus `subject.language`                  | ✅    | V-06a   |
|                          | „Gemischt“ mischt die Richtungen wirklich; EXIF-Drehung beim Foto                  | ✅    | V-07    |
|                          | Lernstand über den ganzen Wortschatz; Antwortart wählbar (Auswahl/Tippen)          | ✅    | V-08    |
|                          | Prüfungsmodus, Schwachstellen, Mix                                                 | 🌑    | V-04    |
| **Heute**                |                                                                                    | 🌓    |         |
|                          | Echte Zahlen: fällige Vokabeln je Fach, nächster Termin mit Countdown              | ✅    | H-01    |
|                          | Kamera-Knopf für die Hausaufgabe (führt in den Hausaufgaben-Tutor)                 | ✅    | H-01    |
|                          | Lernplan-Slot des Tages, Fördern-/Fordern-Karte                                    | 🌑    | M7/M1   |
| **Prüfungskalender**     |                                                                                    | 🌓    |         |
|                          | Termin von Hand anlegen, Liste (4 Wochen / später / Historie), bearbeiten, absagen | ✅    | K-01    |
|                          | Themen an einen Termin hängen, Countdown, Prüfungsseite                            | 🌑    | P-01    |
|                          | Klausurplan per Foto einlesen                                                      | 🌑    | K-03    |
|                          | Datei-Import CSV/XLSX (SchulDock) + ICS                                            | 🌑    | K-04    |
| **Tutor & Hausaufgaben** |                                                                                    | 🌓    |         |
|                          | Architektur entschieden (ADR 0010: Streaming, Schema, Deckel)                      | ✅    | T-01a   |
|                          | Chatfenster, Kontext-Chip (Fach), freie Frage + „Verstehen“, Streaming             | ✅    | T-02    |
|                          | Kein Formular mehr: Fach wird aus der ersten Nachricht/dem Foto erkannt (ADR 0013) | ✅    | T-13    |
|                          | Sprachwächter (Tutor antwortet auf Deutsch, Fach-Ausnahme)                         | ✅    | T-02a   |
|                          | Rate Limits auf KI-Endpunkten (`ai_usage`, 20/h · 60/Tag)                          | ✅    | S-03b   |
|                          | Kostendeckel in echtem Geld statt Anfragenzahl, plus Wochenfenster                 | ✅    | S-03c   |
|                          | Kostendeckel-Anzeige (Heute/Woche), Pegel im Eingabefeld statt auf der Übersicht   | ✅    | S-03d/e |
|                          | Chat-Shell: Übersicht + Gespräch, nur der Verlauf scrollt, ↓-Knopf                 | ✅    | T-12a   |
|                          | Frühere Gespräche wischend löschen, mit Rückgängig-Fenster                         | ✅    | T-15    |
|                          | Gesprächstitel vom Modell statt abgeschnittener erster Frage (ADR 0014)            | ✅    | T-19a   |
|                          | Nächste Frage setzt dasselbe Gespräch fort (30 min, gleiches Fach)                 | ✅    | T-19b   |
|                          | „Zuletzt“ auf der Startseite, Archiv „Alle Gespräche“ mit Suche                    | ✅    | T-19c   |
|                          | Sichtbares Aufräum-Angebot im Archiv (nie automatisch)                             | 🌑    | T-19d   |
|                          | Antworten als Markdown lesbar (Fettung, Listen)                                    | ✅    | T-08    |
|                          | Formelsatz (KaTeX/mhchem), ein Rechenschritt je Zeile, echte Zeilenumbrüche        | ✅    | T-14    |
|                          | Altersgerechte Ansprache nach Jahrgang                                             | ✅    | T-09    |
|                          | Kontextpaket, Schichten mit Quellenangabe, Prompt Caching                          | 🌑    | T-01    |
|                          | „Erklär es anders“, Verständnischeck, Anschlussfragen-Chips                        | 🌑    | T-02c   |
|                          | Elternsicht entschieden (ADR 0012: was, nicht wie gut)                             | ✅    | T-01c   |
|                          | Hausaufgabe: Foto → Aufgabenliste → Hinweisleiter → Lösung, Zweizeiler zum Schluss | ✅    | T-03    |
|                          | Aufgabe aussortieren („Gehört nicht dazu“) per Wisch, mit Rückgängig               | ✅    | T-17    |
|                          | Einstieg Vorschau (Selbsteinschätzung → Hook)                                      | 🌑    | T-04    |
| **Sprache im Tutor**     |                                                                                    | 🌓    |         |
|                          | Weg entschieden (ADR 0011: Diktat + Vorlesen, Echtzeit vertagt)                    | ✅    | T-01b   |
|                          | Diktat (Web Speech API), Text vor dem Senden korrigierbar                          | ✅    | T-02b   |
|                          | Antwort vorlesen (`speechSynthesis`), abschaltbar                                  | ✅    | T-02d   |
|                          | Echtzeit-Sprachdialog (zweiter Anbieter, an Bedingungen geknüpft)                  | 🌑    | T-06    |
| **Material & Karten**    |                                                                                    | 🌑    |         |
|                          | Material-Upload zu Thema (Foto/PDF/Link/Notiz)                                     | 🌑    | M-01    |
|                          | Vision-Extraktion + Lernziel-Zuordnung                                             | 🌑    | M-02    |
|                          | Generisches Karten-Schema + FSRS-Session                                           | 🌑    | M-03    |
|                          | Karten aus Material erzeugen                                                       | 🌑    | M-04    |
| **Kurrikulum**           |                                                                                    | 🌑    |         |
|                          | Schema Kurrikulum-Pack                                                             | 🌑    | F-04g   |
|                          | Pack `de-hh-gym-2023` importieren                                                  | 🌑    | T-05    |
|                          | Chat-Leiste: Kopieren, Play/Pause, öffnet am Ende, Systemstimme                    | ✅    | T-10    |
|                          | Textfeld wächst mit dem Text, keine Stimmenauswahl mehr im Chat                    | ✅    | T-11    |
|                          | Ein Eingabefeld für alle Dialoge: 1–3 Zeilen, Knöpfe unten, Foto per Plus-Menü     | ✅    | T-12    |
| **Betrieb**              |                                                                                    | 🌓    |         |
|                          | Deploy `mytutr.de`, Domain, Preview/Production getrennt                            | ✅    | D-01    |
|                          | E2E gegen die Test-Datenbank                                                       | ✅    | F-13    |
|                          | Web Analytics (aggregiert, ohne Kennung)                                           | ✅    | —       |
|                          | Datenbankrunden je Seite: >30 → <10; Funktionsregion Frankfurt                     | ✅    | #44/#46 |
|                          | Ladezeit-Untersuchung (Region war `iad1` – im Dashboard umgestellt)                | 🌔    | —       |
|                          | Content-Security-Policy mit nonce, ohne `unsafe-inline` für Skripte                | ✅    | S-03a   |
|                          | E2E gegen den Produktions-Build (echte Anmeldung)                                  | 🌑    | F-10    |
|                          | Dev-Tooling-Bumps (eslint 10, TS 7)                                                | 🌑    | F-08    |

---

## Nächste Reihenfolge (aus `docs/roadmap.md`)

1. ~~**V-03d + V-06a**~~ — erledigt (Vokabeln ohne Set aufräumbar; Übungszahl + Richtung stimmen)
2. ~~**K-01**~~ — erledigt (Prüfungskalender, Termine von Hand: anlegen, bearbeiten, absagen, Historie)
3. ~~**T-01a + T-01b**~~ — erledigt (ADR 0010 Tutor-Architektur, ADR 0011 Sprachweg; beide akzeptiert)
4. ~~**T-02 + T-02a + S-03b**~~ — erledigt (Tutor-Chat schmal, streamend, mit Sprachwächter und Rate Limit von Anfang an)
5. ~~**T-02b + T-02d**~~ — erledigt (Diktat und Vorlesen; die gesprochene Schleife, ohne neuen Dienst)
6. ~~**T-07**~~ — erledigt (Chat-Shell: Übersicht + Gespräch, klebendes Eingabefeld, ↓-Knopf)
7. ~~**T-08 + T-09**~~ — erledigt (Markdown-Rendering; Ansprache nach `student.grade_level`)
8. ~~**T-01c**~~ — erledigt (ADR 0012 Elternsicht, akzeptiert); **F-17** räumt die Alt-Policies auf
9. ~~**T-03 schmal**~~ — erledigt (Hausaufgabe mit Hinweisleiter, in zwei PRs: Fundament, dann Backend + Oberfläche)
10. ~~**H-01 schmal**~~ — erledigt (Heute mit echten Zahlen: Fälliges je Fach, nächster Termin, Kamera-Knopf)
11. **V-04** — Set-Modus

Danach entscheidet die Rückmeldung aus echter Nutzung.

## Prüfungstermin

**25. September 2026: Französischarbeit.** Der prüfungskritische Weg (Vokabeln aufnehmen,
fachgebunden üben) steht live. Klemmt in den Tagen davor etwas, hat das Vorrang vor jeder
Roadmap.
