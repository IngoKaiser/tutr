# tutr – Konzept v2 (Revision)

Stand: 5. September 2026 · Zielnutzerin: deine Tochter, Jg. 8, Gymnasium Hamburg · Betreiber: du (Solo-Dev) · Hosting: Vercel

> v1 ist Stück für Stück gewachsen (Marktcheck → Vokabeln → Kurrikulum → Kalender → Erklären → Schuljahr/Themen). v2 ordnet alles um **einen Lernpfad pro Thema** und **einen Tutor mit mehreren Einstiegen** herum, prüft das Ganze gegen den Anspruch „Verstehen + gute Leistung, Fördern + Fordern" und benennt, was in v1 nicht stimmig war (Abschnitt 13).

---

## 1. Ziel, Anspruch, Abgrenzung

**Ziel:** Eine Lernumgebung, die den vollständigen Zyklus eines Schulthemas trägt – *vorbereiten → verstehen → festigen → anwenden → prüfen → nachbereiten* – entlang des echten Schuljahres (Kurrikulum, Lehrwerk, Klassenarbeiten) und mit dem tatsächlichen Unterrichtsmaterial als Wahrheit.

**Anspruch, in dieser Reihenfolge:**
1. **Verstehen** vor Auswendiglernen – jede Übung hängt an einem Lernziel, jedes Lernziel hat eine Erklärung.
2. **Gute Leistung** ist die Folge, nicht das Ziel – aber sie wird gemessen (Mastery, Probeprüfungen, echte Noten) und rückgekoppelt.
3. **Fördern:** Wer hängt, bekommt Grundlagen-Diagnose, andere Erklärwege, kleinere Schritte – nie dieselbe Erklärung lauter.
4. **Fordern:** Wer kann, bekommt erhöhtes Niveau, Transfer, Zeitdruck, „erklär es mir zurück" – nie nur mehr vom Gleichen.

**Nicht:** Content-Plattform mit Videos für alles (simpleclub/sofatutor), Community (Knowunity), Lösungsautomat.

**Dein Vorteil gegenüber Astra & Co.:** Du kennst Schule, Lehrwerke, Lehrkräfte und Klassenarbeitstermine. Die App baut auf dem *tatsächlichen* Unterricht auf, nicht auf einem generischen Fach-Kurrikulum.

---

## 2. Markt – was bleibt, was fehlt

| Feature | Astra AI | Vaia/StudySmarter | simpleclub | Knowunity | Quizlet/Anki | ANTON |
|---|---|---|---|---|---|---|
| KI-Tutor | ✅ Kern | ✅ | ✅ | ✅ | – | – |
| Upload → Karten/Plan | ✅ | ✅ | teilw. | ✅ | – | – |
| Spaced Repetition | ✅ | ✅ | ✅ | ✅ | ✅ Kern | teilw. |
| Vokabeltrainer | über Fächer | ✅ | – | – | ✅ Kern | ✅ |
| Probeprüfung + Bewertung | ✅ Kern | ✅ | Übungen | Quiz | Test | Übungen |
| Mündliche Prüfung | ✅ | – | – | – | – | – |
| Foto → Schritt für Schritt | ✅ | – | – | ✅ | – | – |
| Lehrplanbezug | grob | grob | Bundesland | ✅ | – | Kl. 1–10 |
| Kalender + Lernplan | ✅ | ✅ | ✅ | – | – | – |
| Themen-Vorschau vor dem Unterricht | – | – | Videos | – | – | – |
| Nachbereitung echter Klassenarbeiten | – | – | – | – | – | – |
| Lehrwerk-Bindung der Erklärungen | – | – | – | – | – | – |

**Was niemand hat:** Kopplung an das eigene Unterrichtsmaterial + Lehrwerk, Vorschau *vor* dem Unterricht, Nachbereitung *nach* der Klassenarbeit, echte Fördern/Fordern-Steuerung. Das sind die vier Dinge, die diese App anders macht.

**Was der Markt lehrt:** KI aus eigenem Material ist Standard; Spaced Repetition überall, aber als Black Box; Kalender wird beworben, ist aber starr; Halluzinationen sind das Hauptrisiko → Material als Ground Truth.

---

## 3. Pädagogisches Fundament: der Lernpfad pro Thema

Jedes Thema (Abschnitt 10) durchläuft sechs Stufen. Die App zeigt auf der Thema-Seite, wo sie steht, und bietet pro Stufe genau die passenden Werkzeuge an. Stufen sind überspringbar, aber sichtbar.

```
 ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
 │ VORSCHAU │ → │ VERSTEHEN│ → │ FESTIGEN │ → │ ANWENDEN │ → │  PRÜFEN  │ → │ NACHBER. │
 └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘   └──────────┘
  Überblick      Erklärung      Karten/       Aufgaben,      Probe-         Fehleranalyse
  vor dem        + Material     Vokabeln      Transfer,      prüfung,       der echten
  Unterricht     + Check        (FSRS)        Hausaufgabe    Lernplan       Arbeit → Karten
```

### Prinzipien, die überall gelten
| Prinzip | Was es heißt | Wo in der App |
|---|---|---|
| **Retrieval Practice** | Abrufen schlägt Wiederlesen | Karten, Vokabeln, Verständnischecks, Probeprüfungen |
| **Spacing** | Wiederholung zum optimalen Zeitpunkt | FSRS für alle Karten und Vokabeln, Lernplan rückwärts vom Termin |
| **Interleaving** | Themen mischen statt blocken | Mix-Modus, Probeprüfungen über mehrere Themen |
| **Mastery-Gates** | Weiter erst, wenn Grundlagen sitzen | Vorwissens-Check in der Vorschau, Diagnose beim Verstehen |
| **Wünschenswerte Schwierigkeit** | Leicht genug zum Weitermachen, schwer genug zum Lernen | Modus-Eskalation bei Vokabeln, Niveaustufen bei Aufgaben |
| **Fehler als Daten** | Jeder Fehler erzeugt eine Karte oder ein Lernziel | Session-Stapel, Probeprüfung, Nachbereitung |
| **Metakognition** | Selbst einschätzen, dann prüfen | „Wie sicher bist du?" vor der Antwort; Abgleich danach |

### Fördern und Fordern – konkret
- **Niveau pro Lernziel:** `grundlegend` (Mindestanforderung aus dem Bildungsplan = Note 4) · `regel` · `erhöht`. Aufgaben, Karten und Probeprüfungen tragen ein Niveau. Startniveau kommt aus der Mastery, ist aber jederzeit von ihr wählbar.
- **Fördern** greift automatisch, wenn: zwei Verständnischecks in Folge scheitern, Probeprüfung < 50 %, oder sie „ich versteh's nicht" sagt → Grundlagen-Diagnose (3 Fragen zu Vorläufer-Lernzielen, auch aus früheren Schuljahren), Erklärstil wechseln, Aufgaben in kleinere Schritte teilen, Niveau `grundlegend`.
- **Fordern** wird angeboten, wenn: Mastery ≥ 85 % und Karten „Leicht" → Transferaufgaben (unbekannter Kontext), Zeitdruck-Modus, „Erklär es mir zurück" (sie erklärt, der Tutor prüft), erhöhtes Niveau, Vorschau auf das nächste Thema. Niemals aufgezwungen – als Karte „Willst du mehr?".
- **Beides sichtbar für Eltern** (read-only): wo gefördert wurde, wo gefordert – ohne Chatverläufe.

---

## 4. Der Tutor: ein Modell, sieben Einstiege

Der Tutor ist **eine** Instanz mit **einem** Kontextpaket pro Thema (Abschnitt 10, Schichten). Was sich ändert, ist der *Einstieg* – den bestimmt die Schülerin, nicht die App. Jeder Einstieg setzt Verhalten, erlaubte Schichten und Ergebnis fest.

| # | Einstieg | Typischer Satz | Verhalten des Tutors | Schichten | Ergebnis |
|---|---|---|---|---|---|
| 1 | **Vorschau** | „Wir fangen nächste Woche mit linearen Funktionen an – gib mir einen Überblick." | Landkarte des Themas: Worum geht es, warum ist es wichtig, 3–5 Kernbegriffe, ein anschauliches Beispiel, welche Grundlagen aus früheren Themen gebraucht werden (+ 3-Fragen-Vorwissens-Check), was in Klassenarbeiten typischerweise drankommt. **Nicht** alles erklären – neugierig machen und Vorwissen aktivieren. | 2 → 3 → 4 (Schicht 1 fehlt naturgemäß) | Thema wechselt zu `aktiv`, Status „Vorschau gemacht"; Vorwissens-Lücken werden als Karten angelegt |
| 2 | **Verstehen** | „Ich hab das im Unterricht nicht kapiert." | Fragt: zu welchem Thema, Foto/Satz zum Unterricht, wo es hakt (oder Diagnose). Dann Erklärung im Stil des Lehrwerks, Format wählbar, „Erklär es anders", Verständnischeck. Wenn eine Vorschau existiert: knüpft daran an („du kanntest schon …"). | 1 → 2 → 3 → 4 | Lernziel `geübt` oder erneuter Stil; Karten-Angebot |
| 3 | **Vertiefen** | „Ich hab's verstanden – warum ist das so?" / „Was kommt danach?" | Hintergründe, Herleitung, Verbindung zu anderen Themen, Ausblick auf höhere Jahrgänge. Klar als *über den Unterricht hinaus* markiert. | 4 dominant, 2/3 als Rahmen | Optional Fordern-Aufgaben |
| 4 | **Hausaufgabe / Üben** | Foto der Hausaufgabe oder „Aufgabe 5 auf S. 114" | Sokratisch nach festem Ablauf (siehe 4a): Aufgaben aus dem Foto zerlegen, Aufgabe für Aufgabe, Hinweisleiter, analoges Beispiel, Lösung mit Begründung erst nach zwei dokumentierten Versuchen. | 1 → 2 (3 für Niveau) | Fehler → Karten; Mastery-Update; Zusammenfassung |
| 5 | **Prüfungsvorbereitung** | „Mathe ist am 9.10., was muss ich können?" | Kompakte Zusammenfassung aller Lernziele des Termins (nur aus Schicht 1+2), Schwachstellen laut Mastery, Vorschlag für Lernplan-Slots, Angebot: Probeprüfung (M6). | 1 → 2, 3 für Niveau | Lernplan aktualisiert |
| 6 | **Nachbereitung** | „Ich hab die Mathearbeit zurück – 3-, hier ist sie." | Foto der korrigierten Arbeit → Fehler klassifizieren (Verständnis / Flüchtigkeit / Zeit / Aufgabenverständnis) → pro Verständnisfehler eine Mini-Erklärung + Karte; Note wird am Kalender-Event gespeichert; Mastery korrigiert. Ton: sachlich, nie tröstend-leer, nie tadelnd. | 1 → 2 | Note im Fortschritt, Lücken als Karten, Lehrkraft-Muster als Notiz („Probe wird verlangt") |
| 7 | **Freie Frage** | alles andere | Antwortet, versucht das Thema zuzuordnen („gehört das zu …?"), sonst allgemeines Wissen mit Kennzeichnung. | 4, ggf. 1–3 | – |

### 4a · Hausaufgaben-Support im Detail (Einstieg 4)

Der häufigste Alltagsfall und der, bei dem eine KI am meisten Schaden anrichten kann. Deshalb ein fester Ablauf, der Lernen erzwingt, ohne zu nerven.

**Schritt 1 – Foto der Hausaufgabe**
- Foto vom Buch, Arbeitsblatt oder Heft (auch mehrere). Vision erkennt einzelne **Aufgaben** (Nummerierung a/b/c, Teilaufgaben, Textaufgaben, Lückentexte) und legt eine **Aufgabenliste** an.
- Zuordnung zu Thema/Lernziel (Vorschlag, ein Tipp zur Bestätigung). Bei Buchangabe („S. 114, Nr. 5–7") ohne Foto: Tutor nutzt Lehrwerk-Wissen, fragt aber, ob sie die Aufgabe abfotografieren kann – exakter Wortlaut zählt.
- Optional: Fälligkeit („bis Donnerstag") → erscheint auf „Heute" und im Kalender als Abgabe.

**Schritt 2 – Aufgabe für Aufgabe, jede mit demselben Rhythmus**
```
 Aufgabe verstehen  →  eigener Versuch  →  Hinweisleiter  →  (nach 2 Versuchen) Lösung mit Begründung  →  Selbstkontrolle  →  nächste
```
1. **Verstehen:** Tutor fragt „Was ist hier gesucht? Was ist gegeben?" – sie antwortet in einem Satz. Bei Textaufgaben zuerst das Umformulieren, nicht das Rechnen.
2. **Eigener Versuch:** Sie arbeitet auf Papier oder im Heft und schickt ein **Foto ihres Lösungswegs** oder tippt das Ergebnis. Der Tutor liest den Weg, nicht nur das Ergebnis – „Zeile 3: hier hast du das Vorzeichen verloren" ist mehr wert als „falsch".
3. **Hinweisleiter** (je Versuch eine Stufe höher, nie zwei auf einmal):
   - Stufe 1: Rückfrage zum Konzept („Welche Regel gilt, wenn zwei negative Zahlen multipliziert werden?")
   - Stufe 2: Verweis auf ihr Material oder das Buch („Auf deinem Arbeitsblatt steht das Beispiel unter Nr. 2")
   - Stufe 3: **Analoges Beispiel** – gleiche Struktur, andere Zahlen/Wörter, vollständig vorgerechnet. Nie die Original-Aufgabe.
   - Stufe 4: Erster Schritt der eigentlichen Aufgabe, dann Stopp.
4. **Lösung nach zwei Versuchen:** Wenn zwei dokumentierte Versuche daneben liegen (oder sie es nach zwei Hinweisstufen ausdrücklich verlangt), zeigt der Tutor den vollständigen Lösungsweg **mit Begründung jedes Schritts** – und stellt danach eine Kontrollfrage („Warum darf man hier kürzen?"). Die Aufgabe wird als *„Lösung gezeigt"* markiert, nicht als *„gelöst"*.
5. **Selbstkontrolle:** Bei „gelöst" fragt der Tutor kurz nach der Probe oder einer Plausibilitätsprüfung („Kann das Ergebnis negativ sein?"). Dann nächste Aufgabe.

**Fachspezifische Anpassung des sokratischen Prinzips**
| Fach | Was der Tutor tut | Was er nicht tut |
|---|---|---|
| Mathe/Physik/Chemie | Rechenweg prüfen, Fehlerzeile benennen, analoges Beispiel | Ergebnis vor zwei Versuchen nennen |
| Deutsch (Aufsatz, Erörterung, Analyse) | Struktur besprechen (These, Argumente, Beleg), Leitfragen stellen, einen Satz gemeinsam verbessern | Text schreiben oder umformulieren |
| Englisch/Französisch | Grammatikregel abfragen, Fehler markieren ohne Korrektur, Musterbeispiel in anderem Kontext | Übersetzung liefern, Text korrigieren |
| Bio/Geschichte/PGW | Quellenlesen anleiten, Begriffe klären, Gliederung entwickeln | Antworttext formulieren |

**Regeln, die das Lernen sichern**
- **Kein Kopierschutz-Theater, aber Reibung:** Lösungen werden nicht als kopierbarer Block ausgegeben, sondern schrittweise im Chat mit Begründungen. Wer abschreiben will, kann – aber es ist mühsamer als selbst denken.
- **Versuch = Eingabe, nicht Klick:** Ein „Versuch" zählt nur mit sichtbarem Lösungsweg (Foto oder Text). „Weiß ich nicht" ist kein Versuch, sondern führt zur Hinweisleiter Stufe 1.
- **Lösung gezeigt → Karte:** Jede Aufgabe mit gezeigter Lösung erzeugt automatisch eine Karte zum Lernziel und einen Eintrag in der Fehlerklassifikation (Verständnis / Flüchtigkeit / Aufgabenverständnis).
- **Zeitbewusstsein:** Nach 20 Minuten an einer Aufgabe schlägt der Tutor vor, sie zu markieren und in der Schule nachzufragen – Hausaufgaben sind kein Ort für Frust.
- **Ehrlichkeit gegenüber der Lehrkraft:** Sie kann eine Aufgabe als „mit Hilfe" markieren; die App gibt keine Formulierungen aus, die so klingen, als wären sie ohne Hilfe entstanden.
- **Fordern-Variante:** Wenn alles auf Anhieb sitzt: „Willst du eine Aufgabe, die eine Stufe schwerer ist?" – erhöhtes Niveau, Transfer.

**Ansicht:** Hausaufgaben-Session als Liste: Aufgabe · Status (*offen · in Arbeit · gelöst · Lösung gezeigt · übersprungen*) · Zeit. Nach Abschluss ein Zweizeiler: „5 Aufgaben, 4 selbst gelöst, 1 mit Lösung – Ungleichungen üben wir morgen." Eltern sehen nur diese Zusammenfassung.

**Gemeinsam für alle Einstiege:**
- Lehrwerk-Bindung: Begriffe, Notation, Aufgabentypen des hinterlegten Lehrwerks. Abweichungen werden benannt.
- Schichten-Transparenz: „Auf deinem Blatt … / im Buch … / das kennt man außerdem als …".
- Formate: Text Schritt für Schritt (Standard), visuell (SVG, bei Mathe interaktiv mit Schiebereglern), verbal (TTS mit Rückfragen per Sprache), Analogie, Gegenbeispiel. Umschaltbar mitten im Gespräch.
- „Erklär es anders" wechselt bewusst den Ansatz (formal → anschaulich → prozedural) und merkt sich pro Fach, was bei ihr wirkt.
- Externe Zweitmeinung (Lehrer Schmidt, simpleclub, Daniel Jung, Merkhilfe, musstewissen, MrWissen2go) als kuratierte Suchlinks pro Lernziel – nach dem Video zurück in die App zum Verständnischeck.
- Jede Erklärung ist speicherbar („Meine Erklärung zu …") und wird beim nächsten Mal zuerst angeboten.
- Ton: Jahrgang 8, respektvoll, kein Kindergarten, kein Uni-Skript. Kein Lob ohne Grund.
- Erreichbar von überall: Tutor-Button auf jeder Thema-, Karten-, Prüfungsseite übergibt den Kontext (welches Thema, welche Karte, welche Aufgabe) automatisch. Kein „welches Thema meinst du?", wenn die App es schon weiß.

---

## 5. App-Struktur: fünf Bereiche

```
┌─────────┬─────────┬─────────┬───────────┬─────────┐
│  HEUTE  │ FÄCHER  │  ÜBEN   │ PRÜFUNGEN │  TUTOR  │
└─────────┴─────────┴─────────┴───────────┴─────────┘
```

- **Heute** (Start): fällige Karten/Vokabeln · Lernplan-Slot des Tages · nächste Prüfung mit Countdown · eine Fördern- oder Fordern-Karte, wenn es einen Anlass gibt · Sommer-Assistent, wenn fällig. Ziel: in 10–15 Minuten etwas Sinnvolles tun, ohne zu suchen.
- **Fächer → Thema-Seite** (der Hub): Lernpfad-Stufen als Leiste (Vorschau · Verstehen · Festigen · Anwenden · Prüfen · Nachbereitung), Mastery der Lernziele, Materialbereich, verknüpfte Prüfungen, direkte Tutor-Einstiege passend zur Stufe. Themen-Vorauswahl gedämpft darunter.
- **Üben**: Karten-Session („Heute fällig", setübergreifend), Vokabelmodi, Schwachstellen, Mix. Drei Stapel „Kann ich / Übe ich / Nochmal".
- **Prüfungen**: Kalender (Import/manuell/Chat), Lernplan, Probeprüfungen starten, Ergebnisse und Noten.
- **Tutor**: freier Chat mit Sprach- und Foto-Eingabe; Einstiegs-Chips (Vorschau · Verstehen · **Hausaufgabe** · Prüfung · Nachbereitung) als Abkürzung. „Hausaufgabe" ist der prominenteste Chip und zusätzlich als Kamera-Button auf „Heute" erreichbar.

---

## 6. Module

### M1 · Kurrikulum & Wissensgraph
`Kurrikulum-Pack → Fach → Thema → Lernziel`. Jede Karte, Vokabel, Aufgabe und Prüfung referenziert Lernziele. Lernziele tragen Niveau-Beschreibungen (grundlegend/regel/erhöht) und Vorläufer-Verweise (für Diagnosen). Mastery wird auf Lernziel-Ebene aus FSRS-Stabilität, Verständnischecks, Probeprüfungen und echten Noten berechnet und auf Thema/Fach aggregiert – als zwei Zahlen: *Abdeckung* (wie viel bearbeitet) und *Sicherheit* (wie gut).

### M2 · Material
Upload zu einem Thema (Foto, PDF, Buchangabe, Link, Notiz) mit Art und Priorität; Vision-Extraktion inkl. Handschrift und Formeln; Zuordnung zu Lernzielen mit Vorschlag neuer Lernziele. Materialien sind die Wissensbasis des Tutors (Schicht 1). Details Abschnitt 10.

### M3 · Karteikarten (FSRS)
`ts-fsrs`, Kartentypen Frage/Antwort, Cloze, Bild, Formel; Rating Nochmal/Schwer/Gut/Leicht; Selbsteinschätzung vor dem Aufdecken (Metakognition); offline-fähig. Karten entstehen aus: Materialgenerierung, Fehlern in Übungen/Prüfungen, Vorwissens-Lücken, Nachbereitung – **nie ohne Lernziel**.

### M4 · Vokabeltrainer
- **Foto → Karten:** Vision extrahiert `wort · übersetzung · wortart · beispielsatz · hinweis · seite`; Review-Screen mit Duplikaterkennung; Speichern als Set.
- **Sets:** `Sprache → Lehrwerk → Unit → Set`; eigene Sets („Klassenarbeit 2", „Unregelmäßige Verben"); eine Vokabel in mehreren Sets (Tags); Set-Status neu/in Arbeit/sicher.
- **Modi:** Set-Modus · Fällig heute (setübergreifend) · Prüfungsmodus (Sets der nächsten Arbeit) · Schwachstellen · Mix.
- **Adaptive Session:** FSRS zwischen Sessions; in der Session drei Stapel: *Kann ich* (richtig + schnell → raus), *Übe ich* (richtig, langsam → nach 5–8 Karten wieder), *Nochmal* (falsch → nach 2–3, dann 8). Session endet, wenn alles einmal in „Kann ich" war.
- **Eskalation pro Vokabel:** MC → Tippen → Hören & Schreiben → Lückensatz. Beide Richtungen als getrennte Karten. Tippfehlertoleranz, Artikel-/Genus-Pflicht bei FR/ES, Verwechslungspaare gezielt gegeneinander.
- **Fordern:** Satzbildung mit drei Vokabeln, Übersetzung eines kurzen Textes, Sprechen (STT-Bewertung).

### M5 · Tutor
Siehe Abschnitt 4.

### M6 · Prüfen: Probeprüfungen
- Generator aus Lernzielen eines Kalender-Events oder Themas, **nur aus Schicht 1+2**, Niveau aus Schicht 3; Aufgabenformate wie die Fach-Klassenarbeit (MC, Kurzantwort, Freitext, Rechnung, Lückentext, Zuordnung); Erwartungshorizont wird mitgeneriert.
- Ablauf: Timer, kein Tutor, Abgabe. Bewertung per Rubrik → Punkte → Notenschlüssel (Schulprofil) → Auswertung nach Lernziel → Schwachstellen als Karten und Lernplan-Slots.
- Notizen aus der Nachbereitung fließen in die Rubrik ein („Probe wird verlangt", „Einheiten immer angeben").
- **Fordern:** Zeitdruck-Variante, erhöhtes Niveau, Transferaufgabe am Ende.
- **Mündlich (V4):** STT, Nachfragen, Feedback zu Inhalt und Struktur.

### M7 · Prüfungskalender & Lernplan
- **Vier Kanäle:** Bild-Import (Vision), Datei-Import (CSV/XLSX/ICS, z. B. SchulDock-Export), manuell, Chat/Sprache. Alle enden im Review-Screen – kein stiller Import.
- **Import versteht:** Zeilentypen (Klassenarbeit vs. Ferien/Projektwoche/Fahrt = Blocker), Gruppenfilter („8.1–8.5" vs. „8.5 Eng"), Fach + Themenhinweis aus dem Titel, KW als Plausibilitätscheck, Dubletten gleichen Titels als getrennte Events.
- **Bearbeiten:** Verschieben = Datum ändern, Lernplan verteilt neu. Absagen = Status, behält Verlauf; Löschen mit Rückfrage. Änderungshistorie pro Event. Re-Import matcht über `(fach, gruppe, datum±7, titel)` und zeigt unverändert/verschoben/neu/entfallen.
- **Lernplan:** rückwärts vom Termin, Spacing, berücksichtigt Blocker, Ballungen (z. B. vier Arbeiten in zwei Wochen), Mastery, Zeitbudget pro Tag. Passt sich täglich an.
- Ansichten: 4 Wochen, Halbjahr; ICS-Export; Push 7/2/1 Tage vorher.
- Events tragen `ergebnis` (Note) – gesetzt in der Nachbereitung.

### M8 · Fortschritt & Motivation
- Pro Fach: Mastery-Heatmap über Themen, Noten-Verlauf (echte Arbeiten), Probeprüfungs-Verlauf, offene Karten.
- Wochenziel (Minuten oder Karten), Streak ohne Bestrafung, Wochenrückblick am Sonntag („3 Themen bewegt, 140 Vokabeln sicher, Mathe-Lücke bei Ungleichungen").
- Keine Punkte-Inflation, keine Dark Patterns. Motivation kommt aus sichtbarem Fortschritt und aus Kontrolle: sie bestimmt Reihenfolge, Niveau und Einstieg.
- Elternansicht read-only, ohne Chats.

### M9 · Später
Audio-Zusammenfassungen (TTS), Geschwisterprofile, Anki-Export, Lehrkraft-Muster über Themen hinweg.

---

## 7. Kurrikulum, Lehrwerk, Schule – schulagnostisch

### Drei Schichten des Kurrikulums
1. **Bildungsplan** (Kurrikulum-Pack) → *was* im Jahrgang drankommen muss, mit Mindestanforderungen.
2. **Schulinternes Curriculum / Lehrwerk** → *Reihenfolge* und *Begriffe*.
3. **Tatsächlicher Unterricht** (Material, Klassenarbeiten) → *was geprüft wird*.

### Rechercheergebnis Hamburg (Gymnasium Sek I)
- Neue Bildungspläne seit 2023/24 (Deutsch, Englisch, Mathe, Religion), alle übrigen seit August 2024. Kerncurricula mit **verbindlichen Inhalten und konkret benannten Lernzielen** statt abstrakter Kompetenzen; verpflichtender Anteil ≈ 50 % der Unterrichtszeit, Rest schulintern. Tabellarische **Mindestanforderungen** = Note ausreichend. Mathe nach Leitideen gegliedert.
- PDFs auf hamburg.de, automatischer Abruf blockiert → manuell laden, einmal per Claude in JSON, ~1–2 h pro Fach.
- **Carl-von-Ossietzky-Gymnasium:** keine Fachcurricula online (nur WP-III-Broschüre). Klausurplan über SchulDock (s5849), Stundenplan über WebUntis (hh5849). Elternabend Jg. 8: 15. 9. 2026 – dort Lehrwerke und Stoffverteilung erfragen.
- Fazit: Bildungsplan = Skelett und Maßstab, Lehrwerk = Reihenfolge, Heft = Inhalt.

### Schulagnostisches Design
- **Kurrikulum-Pack** `{ id: "de-hh-gym-2023", faecher, jahrgaenge, nodes, quelle }` – Daten, nicht Code. Ohne Pack läuft alles über Lehrwerk + eigene Themen.
- **Schulprofil** (optional): Bundesland, Schulform, Notenschlüssel (editierbar), Ferien/Schuljahresgrenzen, Kalender-Import-Quelle.
- **Lehrwerk-Registry:** Lehrwerke mit Kapitelstruktur (Foto des Inhaltsverzeichnisses, Claudes Vorwissen als markierter Vorschlag, Verlags-PDFs); Mapping auf Pack-Lernziele; Vokabel-Units. Abfrage beim Anlegen des Schuljahres pro Fach.
- Geschwister, Schulwechsel, Umzug = anderes Profil/Pack, gleiches System.

---

## 8. Datenmodell

```
Family ─┬─ User (parent | student)
        └─ Student
             ├─ SchoolYear (label, jahrgang, klasse, schulprofilId, curriculumPackId?, lehrwerke{fach→id}, von, bis, status)
             ├─ Subject
             │    └─ Thema (schoolYearId, titel, quelle, kurrikulumRef?, lehrwerkRef?, status, reihenfolge, pfadStufe, lernzielIds, materialIds)
             │         └─ LearningObjective (niveauBeschreibungen, vorlaeuferIds, mastery{abdeckung, sicherheit})
             ├─ Material (themaId, art, prioritaet, file, ocrText, objectiveIds)
             ├─ Card (objectiveId, type, front, back, niveau, fsrsState, herkunft)
             ├─ VocabItem / VocabSet (lehrwerkId, unit, tags)
             ├─ Review (cardId, rating, antwortzeit, selbsteinschaetzung, ts)
             ├─ CalendarEvent (schoolYearId, typ, fach, titel, datum, start, ende, gruppen, themen, themaIds, lernzielIds, status, ergebnis?, quelle, historie)
             ├─ Exam / ExamAttempt (eventId?, niveau, aufgaben, rubrik, score, auswertungProLernziel)
             ├─ TutorSession (themaId?, einstieg, verlauf, gespeicherteErklaerung?)
             └─ StudyPlan (date, slots[{objectiveId, minutes, done}])

CurriculumPack ─ CurriculumNode (fach, jahrgang, leitidee?, titel, verbindlich, mindestanforderung, lernziele)
Lehrwerk ─ Kapitel (seiten, units, mappedNodeIds)
SchoolProfile (bundesland, schulform, notenschluessel, ferien, kalenderImport)
```

---

## 9. Schuljahr und Jahrgang

- **Jahrgang = Zeitscheibe**, nicht Eigenschaft des Schülers. `SchoolYear` mit genau einem aktiven pro Schüler.
- **Am Schuljahr hängen:** Themen-Vorauswahl, Lehrwerke, Kalender, Lernplan, Noten. **Nicht daran:** Karten, Vokabeln, Reviews, Mastery – die laufen weiter.
- **Setzen:** Onboarding (Bundesland → Schulform → Jahrgang → Klasse → Schule optional) und Einstellungen → Schuljahr.
- **Sommer-Assistent**, kein Reset: ab Schuljahresende (oder 4 Wochen davor) Karte auf „Heute" → vorbelegt mit Jahrgang +1, gleiche Klasse/Schule, Pack für den neuen Jahrgang; fragt nach neuen/weggefallenen Fächern und Lehrwerken; archiviert Kalender, Pläne, offene Themen; fällige Karten laufen weiter; aktiv erst nach Bestätigung. Sonderfälle: Wiederholung, Schulwechsel, Überspringen.
- **Historie „Meine Schuljahre":** read-only, Materialien bleiben für den Tutor durchsuchbar (Grundlagen-Diagnose greift auf Vorjahres-Lernziele zu).

---

## 10. Themen und Material-Schichten

- **Thema** = Einheit, die die Lehrkraft „das nächste Thema" nennt; bündelt Lernziele, Material, Prüfungen, Lernpfad-Stufe.
- **Vorauswahl:** Beim Anlegen eines Schuljahres mit Pack alle Themen des Jahrgangs pro Fach als `vorauswahl` (gedämpft). Ein Tipp → `aktiv`; mehrere parallel möglich; Reihenfolge frei, Lehrwerk-Reihenfolge als Default. Doppeljahrgangs-Pläne: beide Hälften sichtbar, „schon in 7 gehabt" markierbar.
- **Eigene Themen:** jederzeit, unabhängig vom Pack; Claude schlägt Lernziele vor und prüft Überschneidung mit der Vorauswahl (zusammenführen oder trennen). Gleichberechtigt in allem.
- **Material hinzufügen** zu jedem Thema, jederzeit: Foto, PDF, Buchangabe ohne Scan, Link, Notiz – mit Art (Unterricht/Übung/Lösung/Zusammenfassung) und Priorität. Neues Material → Abgleich mit Lernzielen → Vorschlag für neue.
- **Rahmenwerk/Lehrwerk optional:** liefert Reihenfolge, Kapitel↔Lernziel, Vokabel-Units, Aufgabenformate, Notation. Quellen: Inhaltsverzeichnis-Foto (zuverlässig) → Claudes Vorwissen (markiert) → Verlags-PDFs (manuell).

**Schichten – wer beim Tutor und in Prüfungen das Sagen hat:**
```
1. Eigenes Material zum Thema   ← dominant: so wurde es im Unterricht gemacht
2. Lehrwerk                     ← so steht es im Buch
3. Kurrikulum-Pack              ← das muss beherrscht werden (Niveau)
4. Allgemeines Fachwissen       ← links und rechts: Hintergrund, Alternativen, markiert
```
Prüfungen nur aus 1+2 (3 für Niveau). Vorschau ohne Schicht 1 sagt das und wird später vom Unterrichtsmaterial überstimmt („ihr macht es anders als im Buch – ich passe an"). Technisch: ein Kontextpaket pro Thema, Prompt Caching.

---

## 11. Architektur

- **Next.js 15 (App Router) auf Vercel**, PWA via `@serwist/next`; Offline-Shell + IndexedDB für Karten-Sessions.
- **Supabase** (EU/Frankfurt): Postgres, Auth, Storage, RLS pro Familie. **Drizzle** ORM.
- **Claude API:** Sonnet für Tutor, Generierung, Bewertung, Vision; Haiku für Klassifikation und Vokabel-Checks. Structured Outputs für alle Importe. Prompt Caching für Thema-Kontextpakete.
- **Sprache:** Web Speech API (STT/TTS, kostenlos, Chrome/Safari) zuerst; Whisper/ElevenLabs später.
- **Visuals:** SVG-Generierung durch Claude, KaTeX für Formeln, kleine interaktive Widgets (Schieberegler → Graph) als React-Komponenten mit Parametern vom Modell.
- **Jobs:** Vercel Cron (Tagesplan, Push, Sommer-Check). Web Push für PWA.
- Kosten: Supabase 0–25 €/Monat, Vercel Hobby 0 €, Claude API bei täglicher Einzelnutzung ~5–15 €/Monat.
- Datenschutz: Minderjährige → EU-Storage, keine Trainingsnutzung durch Anthropic, Verarbeitung USA für privaten Gebrauch vertretbar; bei Weitergabe an andere Familien AVV nötig.

### Anmeldung und Authentifizierung – jugendtauglich

**Kurz: Ja, es braucht Authentifizierung – aber nicht die, die Erwachsene gewohnt sind.** Ein 14-jähriges Kind hat oft keine zuverlässige E-Mail, merkt sich keine Passwörter, wechselt zwischen Handy, iPad und Schul-Laptop, und darf rechtlich nicht selbst in Datenverarbeitung einwilligen (in Deutschland ab 16). Daraus folgt ein Familienmodell:

| Rolle | Registrierung | Login im Alltag | Wiederherstellung |
|---|---|---|---|
| **Elternteil** (Kontoinhaber) | E-Mail + Magic Link, danach Passkey | Passkey (Face ID / Fingerabdruck) | Magic Link an E-Mail |
| **Schülerin** | kein eigener Account-Anlageprozess: Elternteil legt Profil an und erzeugt einen **Einladungslink/QR-Code** | Beim ersten Öffnen: Passkey auf dem Gerät anlegen (Face ID). Fallback: 6-stellige PIN. Danach Session 90 Tage, kein tägliches Anmelden. | Elternteil erzeugt neuen Einladungslink; alte Geräte werden in der Elternansicht gelistet und abmeldbar |

**Warum so:**
- **Passkeys (WebAuthn)** laufen in PWAs auf iOS 16+/Android/Chrome, synchronisieren über iCloud-Schlüsselbund bzw. Google Passwortmanager auf alle Geräte des Kindes und sind phishing-sicher. Kein Passwort, nichts zu merken.
- **Kein E-Mail-Zwang für das Kind:** Das Profil ist pseudonym (Vorname, Jahrgang) und hängt am Familienkonto. Keine Geburtsdaten, keine Schul-ID.
- **Einwilligung:** Das Elternteil bestätigt im Onboarding die Nutzung für das Kind (dokumentiert mit Zeitstempel). Für die private Nutzung formal nicht nötig, für eine spätere Weitergabe die Grundlage.
- **Geräte-Session statt Login-Ritual:** Nach dem ersten Einrichten öffnet sich die App wie eine native App. PIN nur, wenn das Gerät entsperrt geteilt wird (Schul-iPad).
- **Sign in with Apple/Google** als Option für die Eltern, nicht als Pflicht; für das Kind bewusst nicht (Apple-ID-Regeln, Werbe-Profile).
- **Trennung der Sichten:** Elternteil sieht Termine, Mastery, Noten; nie Chatverläufe. Technisch über RLS-Policies, nicht nur UI.
- **Offline:** Karten-Sessions laufen auch ohne Netz; die Session bleibt gültig, Sync bei Rückkehr.

**Technisch:** Supabase Auth für Eltern (E-Mail/Magic Link, OAuth optional). Passkeys entweder über Supabase (Stand prüfen) oder über eine schlanke WebAuthn-Implementierung (`@simplewebauthn/server` + Supabase-Custom-Claims); Kind-Profile als eigene Tabelle unter der Familie mit eigenem Session-Token. Einladungslink = signierter, einmalig gültiger Token mit 24-h-Ablauf.

**Was bewusst weggelassen wird:** Altersverifikation, Social Logins fürs Kind, Passwort-Regeln, Captchas, 2FA-Apps. Sicherheit kommt aus Passkeys und dem Familienkonto, nicht aus Hürden.

---

## 12. Roadmap (revidiert)

| Phase | Umfang | Warum in dieser Reihenfolge |
|---|---|---|
| **MVP (4–6 Wochen)** | Auth · Schuljahr + Fächer + Themen (Vorauswahl + eigene) · Kalender mit Bild-/Datei-Import und Review · Karten + FSRS · Vokabeltrainer (Foto-Import, Sets, Session-Stapel, MC/Tippen) · Heute-Screen | Französisch 25. 9., Englisch 30. 9., Deutsch 1. 10., Mathe 9. 10. – der Kalender und die Vokabeln bringen sofort Nutzen, das Datenmodell trägt alles Weitere |
| **V2** | Material-Upload + Extraktion · Karten-Generierung · Tutor mit Einstiegen **Vorschau, Verstehen, Hausaufgabe** (Foto → Aufgabenliste → Hinweisleiter; Text + „Erklär es anders" + Zweitmeinungs-Links) · Kurrikulum-Pack Hamburg | Ab hier ist „ich versteh's nicht" und „was kommt nächste Woche" abgedeckt |
| **V3** | Probeprüfungen mit Bewertung · Lernplan-Generator · Einstiege **Prüfungsvorbereitung, Nachbereitung** · Niveaustufen + Fördern/Fordern-Karten · Push · Sommer-Assistent | Der Zyklus schließt sich: prüfen → nachbereiten → neue Karten |
| **V4** | Audio (TTS) und interaktive Visuals · Mündliche Prüfung · Elternansicht · Geschwister · Anki-Export | Komfort und Reichweite |

**MVP-Fokus:** ein Fach ganz (Französisch oder Englisch: Vokabeln + Kalender), Mathe nur Kalender. Erst V2 macht Mathe zum Tutor-Fach.

---

## 13. Was in v1 nicht stimmig war – und was v2 daraus macht

1. **Der Tutor war einseitig.** v1 hatte einen sokratischen Tutor, dann einen Erklär-Modus daneben. v2 hat *einen* Tutor mit sieben Einstiegen; die Vorschau *vor* dem Unterricht und die Nachbereitung *nach* der Arbeit fehlten komplett – dabei sind das die Momente, in denen Schule am wenigsten hilft.
2. **Kein Lernpfad.** Module standen nebeneinander; es war unklar, was sie *wann* tun soll. Der Sechs-Stufen-Pfad pro Thema gibt jedem Modul seinen Platz und der Thema-Seite ihre Struktur.
3. **Fordern fehlte.** v1 war ein Fördern-Konzept. Niveaustufen pro Lernziel, Transfer, Zeitdruck, „erklär es mir zurück" und die Fordern-Karte auf „Heute" sind neu.
4. **Mastery als eine Zahl** ist irreführend – 60 % kann heißen „alles halb" oder „die Hälfte perfekt". Jetzt zwei Zahlen: Abdeckung und Sicherheit.
5. **Echte Noten kamen nicht zurück.** Ohne Nachbereitung lernt die App nichts aus der Klassenarbeit. Jetzt: Note am Event, Fehlerklassifikation, Lehrkraft-Muster in die Rubrik.
6. **Jahrgang und Thema fehlten als Objekte** – das hätte spätestens im Sommer alles zerlegt. Jetzt Kern des Datenmodells.
7. **Der MVP war zu breit.** v1 wollte Kurrikulum-Import im MVP; v2 zieht das nach V2 und setzt auf das, was die nächsten vier Wochen brauchen: Kalender und Vokabeln.
8. **Motivation war Gamification-Restposten.** Für eine 14-Jährige zählt Kontrolle mehr als Streaks: sie wählt Einstieg, Niveau, Reihenfolge. Streaks bleiben, aber ohne Bestrafung; der Wochenrückblick ersetzt Punkte.
9. **Metakognition fehlte.** Selbsteinschätzung vor dem Aufdecken ist billig zu bauen und eine der wirksamsten Lernstrategien überhaupt.

---

## 14. Offene Fragen für das nächste Sparring

1. Welches Fach zuerst im MVP – Französisch (erste Arbeit 25. 9.) oder Englisch (30. 9.)?
2. Lehrwerke: Welche Bücher werden in Mathe, Englisch, Französisch, Deutsch benutzt? (Elternabend 15. 9.)
3. Zeitbudget pro Tag, das der Lernplan annehmen darf – 20 Minuten? 45?
4. Soll sie die Fordern-Angebote sehen, oder erst nach einer Testphase?
5. Elternansicht: nur Termine und Mastery, oder auch Noten und Lernplan-Einhaltung?
