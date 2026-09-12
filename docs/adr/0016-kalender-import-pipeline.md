# ADR 0016: Der Kalender-Import ist eine Pipeline, kein Bildschirm je Kanal

Status: **akzeptiert** · Datum: 2026-09-12 · Bezug: docs/konzept.md §6 M7 (Kanäle,
Zeilentypen, Re-Import), §8 (`CalendarEvent`)
Baut auf dem Schema aus K-01 auf ([`calendar_event`](../../src/db/schema/calendar.ts)).
Grenzt sich ab von [ADR 0007](0007-vokabeleingabe-und-pflege.md) D2 (Vokabeln: kein
Review-Screen). Tickets: K-02a/b/c (neu, siehe unten), schärft K-03/K-04.

## Kontext

K-01 hat `calendar_event` gebaut und im Schema-Kommentar selbst notiert, was fehlt:

> „das §8-Modell nennt für `CalendarEvent` außerdem `start`, `ende`, `gruppen`, `ergebnis`,
> `quelle`, `historie`; alle davon gehören zu Kanälen, die K-01 noch nicht hat."

§6 M7 nennt vier Kanäle – Bild-Import, Datei-Import (CSV/XLSX/ICS), manuell, Chat/Sprache –
und sagt für alle vier dasselbe: „Alle enden im Review-Screen – kein stiller Import."
Import versteht dabei laut Spec: Zeilentypen (Klassenarbeit vs. Ferien/Projektwoche/Fahrt
= Blocker), Gruppenfilter („8.1–8.5" vs. „8.5 Eng"), Fach + Themenhinweis aus dem Titel, KW
als Plausibilitätscheck, Dubletten gleichen Titels als getrennte Events. Re-Import matcht
über `(fach, gruppe, datum±7, titel)` und zeigt unverändert/verschoben/neu/entfallen.

K-02s Ticket-Notiz verweist auf `docs/fixtures/beispiel-import-klausurplan.json` – ein von
Hand geschriebenes Beispiel, wie ein Klausurplan-Foto (SchulDock-Export, Klasse 8.5) nach
der Erkennung aussehen sollte. Diese Fixture ist keine Erfindung dieses ADRs, sondern der
Ausgangspunkt: Sie zeigt bereits die Form, die die Erkennung liefern muss (`typ`, `fach`,
`titel`, `datum`, `start`/`ende`, `gruppen`, `relevant`, `blocker`, `hinweis`,
`anzeigename`, `themen`), und einen Fall, den man leicht übersieht: „Tag der offenen Tür" –
richtig erkannt, aber `relevant: false`, weil es keinen Lernbezug hat, obwohl es niemandes
Gruppenfilter widerspricht.

## Die entscheidende Beobachtung

Wie bei den Vokabeln (ADR 0007) sind es nicht vier verschiedene Aufgaben, sondern eine:
Rohdaten – egal ob Foto, CSV, ICS oder später Chat – werden zu einer gemeinsamen
**Entwurfsliste**, die durchgesehen wird, bevor irgendetwas in `calendar_event` landet. Die
Vision-Anbindung (K-03) und der Datei-Parser (K-04) sind der kleinere Teil; der Review-
Screen und das Re-Import-Matching sind die eigentliche Arbeit, und die soll es nur einmal
geben.

**Der Unterschied zu ADR 0007 D2 liegt nicht im Modell, sondern in der Fehlerklasse.** Eine
falsch erkannte Vokabel kostet zehn Sekunden Nacharbeit beim nächsten Anschauen der Liste.
Ein falsch erkanntes Klausurdatum verschiebt einen Lernplan (M7) und lässt „Heute" (H-01)
einen Countdown zeigen, den – anders als bei Vokabeln – **auch die Eltern sehen**:
`calendar_event` ist eine der wenigen Tabellen, die beide Rollen schreiben (ADR 0004 D4).
Außerdem kommt die Eingabe hier in einem Schwung (ein Foto, ein ganzer Plan) statt als
stetiges Tröpfeln in eine dauerhaft sichtbare Liste – „37 von 40 sind richtig, der Rest
fällt beim Nutzen auf" trägt hier nicht, weil ein Termin, der nie geöffnet wird, nie
auffällt. Deshalb: Kontrolle **vor** dem Schreiben, nicht als Zustand einer Liste danach.

## Entscheidung

### D1 · Eine gemeinsame Entwurfsform für alle Kanäle

```ts
type CalendarImportDraft = {
  type: CalendarEventType | "blocker"; // Blocker ist kein calendar_event-Typ (siehe D5)
  subjectGuess: string | "unklar" | null; // null nur bei isBlocker
  title: string;
  displayName?: string; // "anzeigename" der Fixture – kürzerer Titel fürs Kind
  date: string; // ISO YYYY-MM-DD
  groups: string[]; // Rohtokens wie erkannt: ["8.5", "8.5 Eng"]
  relevant: boolean; // eigene Gruppe UND Lernbezug (siehe D3)
  confidence: "hoch" | "niedrig"; // KW-Mismatch, schlecht lesbar (siehe D6)
  note?: string | null; // "hinweis" der Fixture
};
```

Bild-Import (K-03) und Datei-Import (K-04) füllen dieselbe Form; der Review-Screen (K-02c)
kennt seine Quelle nicht mehr. Englische Bezeichner wie überall im Schema/Lib-Code
(CLAUDE.md) – nur die Zod-Schemas der KI-Schicht folgen dem Präzedenzfall aus
`homeworkExtractionSchema()`, wo `fach` als Feldname stehen bleibt, weil das Modell in
dieser Sprache antwortet. `CalendarImportDraft` ist die interne, kanalneutrale Form
**danach** – dort gilt CLAUDE.md ohne Ausnahme.

### D2 · Warum hier ein Review-Screen und bei Vokabeln keiner

Siehe „Die entscheidende Beobachtung" oben – hier nur die Konsequenz für den Bau: Der
Review-Screen ist ein eigener Zustand (Entwurf, ungespeichert), keine Markierung in einer
bestehenden Liste wie bei ADR 0007 D2. Erst „Übernehmen" schreibt – über denselben
Insert-Pfad, den K-01 für die manuelle Eingabe schon hat.

### D3 · „Relevant" ist eigene Gruppe **und** Lernbezug, nicht nur Gruppenfilter

Die Fixture zeigt, dass Gruppenfilter allein nicht reicht: „Tag der offenen Tür" trifft
niemandes Gruppe (leer = betrifft alle), ist aber trotzdem nicht relevant. Die Erkennung
liefert `relevant` deshalb als ein Urteil, keine reine Mengenoperation – bei Vision Teil
des Modellaufrufs, beim Datei-Import eine Kombination aus Gruppenfilter und Zeilentyp
(Blocker sind immer „relevant" im Sinne von „gehört gezeigt", s. D5).

Der **Gruppenfilter-Teil** ist eine reine, testbare Funktion (`matchesOwnGroups()`):
Tokens wie „8.1–8.5" (Bereich), „8.5 Eng" (Fach-Differenzierung), „8.1, 8.3" (Liste) gegen
die eigenen Gruppen des Kindes. Nicht-relevante Zeilen verschwinden **nicht** aus dem
Entwurf, sie klappen standardmäßig ein (Schalter „andere Zeilen anzeigen") – eine falsch
geparste Gruppenregel darf nie eine eigene Arbeit stillschweigend verschlucken.

**Offener Punkt, den diese Fixture aufdeckt:** `school_year.className` kennt heute nur
**eine** Klasse („8.5"), der Klausurplan aber mehrere eigene Tokens (Fachdifferenzierung:
„8.5 Eng", „8.5 Mat" für Englisch- bzw. Mathe-Kurse innerhalb der Klasse). Diese Tokens
lassen sich nicht herleiten – sie sind echtes Wissen des Kindes, keine Ableitung (ADR 0006
D7 gilt hier nicht). Entscheidung: neue Spalte `school_year.own_groups` (`text[]`,
nullable, Vorgabe `[className]`), **erweitert im Review-Screen selbst** beim ersten Import
– die Erkennung zeigt alle im Plan vorkommenden Gruppentokens an, das Kind hakt „das bin
ich auch" an, der Rest wird gemerkt. Keine neue Einstellungsseite: Der Moment des ersten
Imports **ist** der Moment, in dem diese Information zum ersten Mal gebraucht wird.

### D4 · Fach wird vorgeschlagen, nie geraten

Gleiche Disziplin wie ADR 0013 D2 (`fachZuordnungSchema()`) und `homeworkExtractionSchema()`:
Die geschlossene Auswahl entsteht zur Aufrufzeit aus den echten Fächern des Kindes,
`"unklar"` ist immer ein erlaubtes Ergebnis. Beim Bild-Kanal (K-03) ist das ein
Modell-Constraint wie bisher; beim Datei-Kanal (K-04) ein Textabgleich ohne Modellaufruf
(groß-/kleinschreibungs- und akzent-unempfindlich wie `filtereGespraeche()` aus T-19c) –
„Eng" gegen „Englisch" ist ein Abkürzungs-Problem, kein Unschärfe-Problem, und wird als
solches im Prompt/Parser benannt, nicht geraten.

### D5 · Blocker werden erkannt, aber (noch) nicht gespeichert

Ferien/Fahrt/Projektwoche sind an `type: "blocker"` erkennbar, damit sie nicht versehentlich
als `klassenarbeit` durchgehen. Sie erscheinen im Review-Screen (informativ, ohne
„Übernehmen"-Knopf) – aber sie werden **nicht** nach `calendar_event` geschrieben.
`calendarEventType` bekommt in K-02 keinen neuen Enum-Wert. Grund: Der einzige Abnehmer für
Blocker ist der Lernplan (M7), und der hat noch kein Ticket. Ein Feld ohne Konsument wäre
genau der erfundene Platzhalter, den H-01 ausdrücklich vermeidet („erfundene Platzhalter
neben echten Zahlen wären genau die Unwahrheit, die §15 verbietet"). Diese Entscheidung
fällt neu, sobald ein Lernplan-Ticket geschnitten wird.

Aus demselben Grund bleiben `start`/`ende` (Uhrzeit) und `themen` (Themen-Hinweis, gehört
zu P-01) im Entwurf nur **angezeigt**, nicht gespeichert – `calendar_event` bekommt in
K-02 keine neuen Spalten dafür. Die Fixture zeigt zwar korrekt erkannte Uhrzeiten, aber
kein heutiger Bildschirm nutzt sie.

### D6 · KW ist ein Plausibilitätshinweis, kein Blocker

Erkennt die Quelle eine Kalenderwoche zusätzlich zum Datum und weicht sie vom geparsten
Datum ab, wird die Zeile `confidence: "niedrig"` – dieselbe Idee wie die
`confidence`-Markierung bei `homeworkExtractionSchema()` und der Vokabel-Erkennung (ADR
0007 Nachtrag). Niedrige Konfidenz verhindert nichts, sie sortiert im Review-Screen nach
oben (wie ADR 0007 D2: „unsichere Zeilen stehen oben").

### D7 · Gleicher Titel, gleicher Tag, andere Gruppe bleibt getrennt

Der Ersteinlese-Vorgang legt für „Mathearbeit 8.5" und eine gleichnamige Zeile einer
Parallelklasse **zwei** Entwürfe an, solange sich die Gruppentokens unterscheiden – exakt
§6 M7s „Dubletten gleichen Titels als getrennte Events". Zusammenführen ist ausschließlich
Sache des Re-Import-Matchings (D8), das gegen **existierende** `calendar_event`-Zeilen
prüft, nicht der Ersterkennung.

### D8 · Re-Import-Matching: eine reine Funktion, vier Eimer

```ts
function matchReimport(existing: CalendarEvent[], drafts: CalendarImportDraft[]): ReimportResult; // { unveraendert, verschoben, neu, entfallen }
```

Schlüssel exakt wie in §6 M7: `(subjectId, groups, datum ± 7 Tage, Titel-Ähnlichkeit)`.
Rein, unit-getestet gegen Fixtures (`docs/fixtures/beispiel-import-klausurplan.json` plus
eine zweite Fassung mit einer Verschiebung und einer entfallenen Arbeit) – keine
Datenbank, wie `matchesOwnGroups()` und `classifyDuplicate()` (ADR 0007 D4) auch keine
brauchen. `entfallen` heißt **angezeigt**, nie automatisch gelöscht: Löschen bleibt eine
menschliche Entscheidung mit Rückfrage, wie K-01 es für die manuelle Bearbeitung schon
festgelegt hat.

Braucht zwei additive Spalten auf `calendar_event`, beide von K-01 schon angekündigt:
`groups` (`text[]`, nullable) und `source` (Enum `manuell`/`bild`/`datei`). RLS bleibt
unverändert (ADR 0004 D4 gilt spaltenunabhängig).

### D9 · Außerhalb dieses ADRs: Änderungshistorie und Chat-Kanal

„Änderungshistorie pro Event" (§6 M7, Abschnitt „Bearbeiten") ist ein anderes Problem als
die Re-Import-Klassifikation aus D8 – die eine ist ein dauerhaftes Protokoll je Zeile, die
andere ein flüchtiger Vergleich zweier Momentaufnahmen. Dafür gibt es noch kein Ticket;
diese Entscheidung wird hier bewusst nicht mitgetroffen. Ebenso der vierte Kanal aus §6 M7
(„Chat/Sprache") – K-01/K-02/K-03/K-04 decken nur manuell/Bild/Datei ab. Beides als offener
Punkt in `docs/PLAN.md`, kein Scope-Creep in diesem ADR.

## Konsequenzen

- **Schema (K-02a):** `calendar_event.groups` (`text[]`, nullable), `calendar_event.source`
  (Enum, additiv), `school_year.own_groups` (`text[]`, nullable, Vorgabe `[className]`).
  Additive Migration, keine RLS-Änderung.
- **Reine Bausteine (K-02b), `src/lib/calendar/`:** `import-draft.ts` (der Typ aus D1),
  `group-match.ts` (`matchesOwnGroups()`, D3), `reimport-match.ts` (`matchReimport()`, D8).
  Fach-Abgleich (D4) liegt, wo er hingehört – Vision-Prompt bei K-03, String-Vergleich bei
  K-04 – und wird nicht zu einem dritten Modul aufgebläht, das beide nur einmal aufrufen.
- **Review-Screen (K-02c):** kanalneutral, konsumiert nur `CalendarImportDraft[]`, schreibt
  über den bestehenden K-01-Insert-Pfad. Zeigt Gruppen-Einrichtung (D3) beim ersten Mal,
  Blocker/Uhrzeit/Themen informativ (D5), Re-Import-Ergebnis in vier Gruppen (D8).
- **K-03 (Bild-Import)** schrumpft auf: Vision-Prompt + Schema liefert `CalendarImportDraft[]`
  gemäß D1/D3/D4/D6, nutzt K-02b/c. Fixture dient als erster Testfall.
- **K-04 (Datei-Import)** schrumpft auf: CSV/XLSX- und ICS-Parser liefern dieselbe Form,
  nutzen dieselben K-02b/c-Bausteine – kein zweiter Review-Screen, keine zweite
  Matching-Logik.

## Abgelehnte Alternativen

**Jeder Kanal baut seinen eigenen Review-Screen.** Verdoppelt (verdreifacht, sobald Chat
kommt) Gruppenfilter-, Fach- und KW-Logik – dieselbe Falle, die ADR 0007 für die Vokabeln
schon vermieden hat.

**Kein Review-Screen, sofort schreiben wie bei Vokabeln.** Abgelehnt nach D2 – falsche
Fehlerklasse für eine Tabelle, die beide Rollen schreiben und die einen Lernplan sowie
einen sichtbaren Countdown speist.

**Blocker sofort mitspeichern, „für später".** Abgelehnt nach D5 – ein Feld ohne Abnehmer
ist genau der erfundene Platzhalter, den H-01 ausdrücklich vermeidet.

**Gruppenfilter serverseitig hart anwenden, nicht passende Zeilen nie anzeigen.** Abgelehnt
nach D3 – eine falsch geparste Gruppenregel (Bereichsnotation, Fachdifferenzierung) würde
lautlos die eigene Arbeit aus dem Import werfen. Ein Klapp-Zustand kostet fast nichts und
verhindert genau das.

**`own_groups` als neue Einstellungsseite vor dem ersten Import abfragen.** Abgelehnt nach
D3 – niemand weiß vor dem ersten Klausurplan, welche Tokens die Schule benutzt („8.5 Eng"
vs. „8.5E" vs. „Eng-Kurs 3"); die erste Erkennung liefert die Auswahlmenge frei Haus, eine
vorab gebaute Seite müsste raten oder frei tippen lassen.

## Abgeleitete Tickets für docs/PLAN.md

Ersetzt das bisherige Planungs-Ticket K-02 durch drei umsetzbare Tickets (je ≤ 1 Session);
K-03/K-04 bleiben bestehen, geschärft um die Bausteine, die sie jetzt konsumieren:

| ID    | Ticket                                                                                                               | Konzept    |
| ----- | -------------------------------------------------------------------------------------------------------------------- | ---------- |
| K-02a | Schema: `calendar_event.groups`/`source`, `school_year.own_groups`, additive Migration, Tests                        | §8         |
| K-02b | Reine Bausteine: `CalendarImportDraft`-Typ, `matchesOwnGroups()`, `matchReimport()`, unit-getestet gegen die Fixture | §6 M7      |
| K-02c | Review-Screen (kanalneutral): Entwurfsliste, Gruppen-Einrichtung beim ersten Mal, Re-Import-Ansicht, Übernehmen      | §6 M7, §15 |
| K-03  | Bild-Import (bestehend, geschärft): Vision-Schema liefert `CalendarImportDraft[]`, nutzt K-02b/c                     | §6 M7      |
| K-04  | Datei-Import (bestehend, geschärft): CSV/XLSX/ICS-Parser liefern `CalendarImportDraft[]`, nutzt K-02b/c              | §6 M7      |

## Nachtrag (P-03): Die Blocker werden jetzt gebraucht

D5 hält fest, dass Ferien, Fahrten und Projektwochen zwar erkannt, aber nicht gespeichert
werden – „der einzige Abnehmer für Blocker ist der Lernplan (M7), und der hat noch kein
Ticket", und: „Diese Entscheidung fällt neu, sobald ein Lernplan-Ticket geschnitten wird."

Das ist am 12. 9. 2026 geschehen: **P-03** rechnet den Lernplan rückwärts vom Termin und muss
Tage überspringen, an denen nicht gelernt wird. Ein Plan, der in die Herbstferien hinein
verteilt, ist falsch, und zwar sichtbar falsch. Damit gilt D5 nicht mehr: Blocker werden
gespeichert, sobald P-03 gebaut wird. Die Ferien selbst kommen nicht aus dem Import, sondern
als kuratierte Seed-Daten je Bundesland (**K-05**) – der Import liefert die
schulspezifischen Blocker, die in keinem Ferienkalender stehen (Projektwoche, Fahrt,
beweglicher Ferientag).

Unverändert bleiben die beiden anderen Teile von D5: Der **Themen-Hinweis** wird mit P-01
gebraucht (der Stoffsammler „Was kommt dran?" liest ihn als Kandidat), **`start`/`ende`**
weiterhin von niemandem – der Lernstreifen aus P-03 zeigt Tage, keine Uhrzeiten.
