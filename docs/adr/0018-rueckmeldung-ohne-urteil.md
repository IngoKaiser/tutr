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
- **Der Notenschlüssel kommt als kuratierter Vorschlag** (K-05, zusammen mit den Ferien):
  `school_profile.grading_scale` wird mit den verbreiteten Schwellen 92 / 81 / 67 / 50 / 30 %
  vorbelegt (der sogenannte IHK-Schlüssel, der auch an Schulen weit verbreitet ist) und ist
  editierbar, wie §7 es verlangt. Wichtig für D5: Schulnoten in der Sek I sind **nicht**
  bundesweit einheitlich – jede Schule, oft jede Lehrkraft, rechnet etwas anders. Der Ausklapper
  muss das sagen („nach dem hinterlegten Schlüssel – deine Schule rechnet vielleicht anders"),
  sonst behauptet eine Umrechnung eine Genauigkeit, die es nicht gibt. Ohne hinterlegten
  Schlüssel entfällt der Ausklapper, ohne dass sonst etwas fehlt.

## Abgelehnte Alternativen

**Die Probeprüfung benotet wie die echte Arbeit.** Vertraut, vergleichbar, und für die Schülerin
die gewohnte Währung. Verworfen als _Voreinstellung_, nicht als Möglichkeit – D5 hält sie einen
Fingertipp entfernt. Der Unterschied ist, wer die Zahl aufruft.

**Kein Feedback bis zur echten Arbeit.** Die konsequenteste Angstvermeidung und der schlechteste
Lerneffekt: Abrufen ohne Rückmeldung verschenkt den größeren Teil der Wirkung.

**Zeitbudget als Wochenziel.** („180 Minuten diese Woche.") Klingt milder als ein Tagesziel, ist
aber dasselbe mit längerer Frist – und erzeugt zusätzlich den Sonntagabend, an dem alles
nachgeholt wird. Genau das, was verteiltes Üben verhindern soll.

## Nachtrag (12. 9. 2026): Es gibt keine Zielnote

D4 und D5 nehmen der Probeprüfung die Ziffer. Beim Durchsprechen fiel auf, dass ein Rest
derselben Mechanik unangetastet blieb: die **Zielnote pro Prüfung**, die §15 von Astra übernimmt
(„mit Fortschrittsbalken und Markierung") und die §8 als `CalendarEvent.zielnote?` vorsieht.

Sie entfällt ersatzlos. `calendar_event` bekommt **kein** `target_grade`.

**Warum:** Realistisch gibt es nur zwei Fälle, und in beiden trägt das Feld nichts. Wer in einem
Fach ehrgeizig ist, zielt auf 1 oder 2 – das einzutippen fügt nichts hinzu. Wer sich schwertut,
dessen Ziel heißt „keine 5" oder „besser als letztes Mal"; niemand trägt freiwillig eine 3 ein,
weil das wie ein Eingeständnis wirkt, bevor gelernt wurde. Der Zweck des Feldes ist bei Astra
auch kein pädagogischer, sondern ein darstellerischer: Ein Fortschrittsbalken braucht ein oberes
Ende. Genau diese Darstellung verwirft D4 bereits – die Zielnote ist der Rest einer Mechanik,
deren Anzeige schon gestrichen ist.

**Der Bedarf dahinter bleibt und wird anders getragen.** Die berechtigte Frage ist nicht „welche
Note willst du", sondern **„wie viel ist genug?"** – ohne Antwort darauf ist „Sicherheit 62 %"
bedeutungslos, und 100 % wären Überlernen. Drei Dinge, die es ohnehin gibt, beantworten sie
besser:

1. **Das Niveau je Lernziel** (`grundlegend` = Mindestanforderung = Note 4 · `regel` · `erhoeht`,
   §3 und T-05). Feiner und ehrlicher als eine Note je Arbeit: „bei den Grundlagen sicher, beim
   erhöhten Niveau noch nicht" statt „auf Kurs für eine 3".
2. **Vollständigkeit statt Höhe.** Das Ziel vor einer Arbeit ist, dass kein Lernziel offen ist.
   „4 von 6 sitzen" trägt sein Ziel schon in sich – 6 von 6, ohne Eingabefeld.
3. **Der Vergleich mit dem letzten Mal** (D4, Richtung statt Zustand) als Motivationsanker.

Wo eine Absichtserklärung sinnvoll ist, betrifft sie ohnehin nicht den Termin, sondern das Fach:
_wie weit will sie hier gehen?_ Das steht in §3 schon („Startniveau kommt aus der Mastery, ist
aber jederzeit von ihr wählbar"), ändert sich selten und steuert wirklich etwas – Aufgabenniveau
und Fordern-Angebote.

**Abweichung von der Spec:** §15 („Übernehmen") und §8 (`CalendarEvent.zielnote?`) nennen die
Zielnote. Beide bleiben unverändert, dieser Nachtrag ist die dokumentierte Abweichung. Betroffen
ist P-01, dessen Titel „Zielnote + Fortschritt (Sicherheit vs. Ziel)" entsprechend gekürzt wird.
