# ADR 0018: Rückmeldung ohne Urteil – das Zeitbudget ist ein Deckel, die Probeprüfung hat keine Note

Status: **akzeptiert** · Datum: 2026-09-12 · Bezug: docs/konzept.md §6 M6 (Probeprüfungen),
§6 M7 (Lernplan, Zeitbudget), §13 Nr. 8, §14 Frage 3, §15 („bewusst nicht")
Weicht in D3 von §6 M6 ab (Timer, Punkte, Notenschlüssel als Ablauf) und beantwortet §14 Frage 3.
Tickets: P-03, P-04, P-05. Forschungsstand und Belege: `docs/pruefungsvorbereitung.md` §4.

## Kontext

Zwei Fragen standen seit dem Abgleich in `docs/pruefungsvorbereitung.md` als „Entscheidungen /
Offen" im Backlog, und beide sind dieselbe Frage in zwei Kleidern: **Wie dosiert die App
Anforderung und Rückmeldung, ohne Druck zu erzeugen?**

- Der Lernplan (P-03) kann ohne Minutenzahl nicht rechnen – §14 Frage 3 („Zeitbudget pro Tag,
  das der Lernplan annehmen darf – 20 Minuten? 45?") ist seit v2 unbeantwortet.
- §6 M6 beschreibt die Probeprüfung als Simulation des Ernstfalls: „Timer, kein Tutor, Abgabe.
  Bewertung per Rubrik → Punkte → Notenschlüssel (Schulprofil)". Die Meta-Analyse zur
  Prüfungsangst (2023) sagt dazu: Übungstests senken die Angst im Mittel – aber nur, wenn sie
  **unbenotet und wiederholbar** sind.

## Die entscheidende Unterscheidung

Beide Fälle verwechseln zwei Dinge, die getrennt gehören:

|        | Was gebraucht wird                                           | Was schadet                                        |
| ------ | ------------------------------------------------------------ | -------------------------------------------------- |
| Zeit   | ein **Deckel**, damit der Planer nichts Unmögliches verteilt | ein **Ziel**, gegen das sie täglich verlieren kann |
| Prüfen | **Rückmeldung**, damit sie weiß, wo sie steht                | eine **Ziffer**, die die Rückmeldung ersetzt       |

„Unbenotet" heißt ausdrücklich **nicht** „ohne Rückmeldung" – Feedback ist selbst einer der
stärksten Lerneffekte, und Abrufen ohne Rückmeldung wirkt deutlich schwächer.

## Entscheidung

### D1 · Das Zeitbudget ist ein Deckel, nie ein Ziel

`minutesPerDay` ist ein Parameter der Planfunktion (P-03), keine Zusage an die Schülerin. Es
begrenzt, was ein Tag vorschlagen darf; es erzeugt nie einen Soll-Ist-Vergleich. Insbesondere
gibt es **keine Anzeige** der Art „du hast heute erst 8 von 15 Minuten geschafft" – das wäre die
Streak-Logik, die §15 bewusst ausschließt, nur mit anderem Ziffernblatt.

### D2 · Gemessen statt erfragt

Vorgabewert: 15 Minuten je Fach, höchstens 30 Minuten am Tag. Nach zwei Wochen Nutzung ersetzt
ihn der gleitende Median der tatsächlichen Übungszeit – die liegt bereits vor (`review.reviewed_at`
und die Session-Dauern), ohne dass etwas Neues erhoben wird.

Verworfen: eine **Einstellung** („wie viel willst du täglich lernen?") – eine einmal gesetzte und
nie angepasste Zahl ist eine Fiktion, mit der der Plan dann rechnet. Ebenso verworfen: die
**tägliche Frage** – eine Hürde unmittelbar vor dem Lernen, die außerdem dazu erzieht, klein zu
antworten.

### D3 · Die eine Frage aus §15 stellt sich nur bei einer echten Entscheidung

§15 erlaubt genau eine Zeitfrage („Wie viel Zeit hast du heute?"). Sie gehört nicht in den
Alltag, sondern an den Moment, in dem der Plan an eine Grenze stößt – die Ballung:

> „Nächste Woche stehen drei Arbeiten. Mit 15 Minuten am Tag geht sich Mathe nicht aus. Schaffst
> du an drei Tagen 25 Minuten – oder soll ich Mathe nach hinten schieben und dafür in Französisch
> früher anfangen?"

Eine Verhandlung mit echten Optionen, keine Abfrage. Für den Alltag genügt „Heute keine Zeit"
aus dem Lernstreifen (P-03): ein Tipp, der neu verteilt.

### D4 · Die Probeprüfung wird bewertet, aber nicht benotet

Erhalten bleiben aus §6 M6: Punkte je Aufgabe, Rubrik, Erwartungshorizont, Auswertung je
Lernziel, Lücken werden Karten. **Nicht** ausgegeben wird eine Note als Ergebnis. Was sie sieht,
ist handlungsleitend und enthält mehr Information als eine Ziffer:

> Stand für Donnerstag: 4 von 6 Lernzielen sitzen. Offen: _passé composé mit être_ (2 von 5
> Aufgaben) und _Uhrzeiten_ (noch nicht geübt). Vor zwei Wochen waren es 2 von 6.

**Richtung statt Zustand.** Der Verlauf über mehrere Proben ist die beste Antwort auf „wo stehe
ich" – und das Gegenteil eines Urteils.

Begründung für den Wegfall der Ziffer: Sie wird zur Identität („ich bin eine 4"), sie legt keine
Handlung nahe, und sie verdrängt die Rückmeldung daneben – der klassische Befund ist, dass
Lernende, die Note _und_ Kommentar erhalten, so wenig lernen wie die mit nur der Note.

### D5 · Die Note gibt es auf Abruf, nicht von selbst

Ein ausklappbares „Was wäre das als Note?" rechnet nach dem Notenschlüssel des Schulprofils um –
mit dem ehrlichen Zusatz, dass eine Probe eine Woche vorher nichts über die Arbeit sagt. Sie
entscheidet, ob sie die Zahl sehen will: Sie ihr zu verweigern wäre bevormundend, sie ihr
aufzudrängen schädlich. Das ist dieselbe Autonomie-Linie wie „sie wählt Einstieg, Niveau,
Reihenfolge" (§13 Nr. 8) – und der Befund dazu ist, dass Autonomie- und Kompetenzerleben die
Prüfungsangst stärker dämpfen als eine geringere Zahl von Tests.

### D6 · Wiederholbar ist der eigentliche Hebel

Dieselben Lernziele lassen sich beliebig oft prüfen, jedes Mal mit neu erzeugten Aufgaben. Damit
verliert ein einzelnes Ergebnis seinen Urteilscharakter von allein – das wirkt stärker als jede
Gestaltung der Ergebnisanzeige. Der **Timer** bleibt erhalten, aber als Fordern-Variante auf
Wunsch, nicht als Voreinstellung.

Eine echte Note trägt genau ein Objekt: `calendar_event.result`, gesetzt in der Nachbereitung der
zurückgegebenen Arbeit (P-05).

## Konsequenzen

- **P-03** bekommt `minutesPerDay` als Planparameter mit Vorgabewert und gleitendem Median, plus
  den Ballungs-Dialog aus D3. Kein Feld in den Einstellungen.
- **P-04** gibt Punkte und Lernziel-Auswertung aus, keine Note; „Was wäre das als Note?" ist
  ausklappbar; Wiederholung erzeugt neue Aufgaben zu denselben Lernzielen; Timer optional.
- §14 Frage 3 ist damit beantwortet und wird im Backlog gestrichen.
- Offen bleibt der Notenschlüssel selbst: `school_profile.grading_scale` liegt als JSONB ohne
  Inhalt im Schema. D5 braucht ihn – ohne ihn entfällt der Ausklapper, ohne dass sonst etwas fehlt.

## Abgelehnte Alternativen

**Die Probeprüfung benotet wie die echte Arbeit.** Vertraut, vergleichbar, und für die Schülerin
die gewohnte Währung. Verworfen als _Voreinstellung_, nicht als Möglichkeit – D5 hält sie einen
Fingertipp entfernt. Der Unterschied ist, wer die Zahl aufruft.

**Kein Feedback bis zur echten Arbeit.** Die konsequenteste Angstvermeidung und der schlechteste
Lerneffekt: Abrufen ohne Rückmeldung verschenkt den größeren Teil der Wirkung.

**Zeitbudget als Wochenziel.** („180 Minuten diese Woche.") Klingt milder als ein Tagesziel, ist
aber dasselbe mit längerer Frist – und erzeugt zusätzlich den Sonntagabend, an dem alles
nachgeholt wird. Genau das, was verteiltes Üben verhindern soll.
