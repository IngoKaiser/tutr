# Prüfungsvorbereitung: der Regelkreis, der Forschungsstand und die Lücken

Stand: 12. September 2026 · Bezug: `docs/konzept.md` §3, §4 (Einstiege 5 und 6), §6 M4–M7, §8, §15 ·
Tickets in `docs/PLAN.md` (P-00 bis P-06, K-05, T-20, T-21, V-04b) · Inhaltsseite:
[ADR 0017](adr/0017-materialtiefe-und-kontextpaket.md) · Diagramme:
[„Der Prüfungs-Regelkreis"](https://claude.ai/code/artifact/72baf76c-7c10-461f-99fe-0d750f3d5631) ·
[„Woher der Stoff kommt"](https://claude.ai/code/artifact/17152fa9-f19f-4b30-8440-c6e3a1f63aba) ·
[„Der Lernstreifen"](https://claude.ai/code/artifact/544d4550-e22b-4bb5-b6f4-198d93dc644f)

Dieses Dokument beantwortet drei Fragen, die beim Durchsehen des Konzepts offen blieben:
Wie hängt die Prüfungsvorbereitung eigentlich zusammen? Was sagt die Lernforschung dazu?
Und was davon haben wir geplant, was nicht?

Es ist **keine** Spezifikation. Die Spec bleibt `konzept.md`; hier stehen der Abgleich und die
Entscheidungen, die daraus anstehen.

---

## 1. Der Regelkreis

Prüfungsvorbereitung ist im Konzept kein Modul, sondern eine Schleife. Der Wert liegt nicht in
den einzelnen Stationen – die hat jede Lern-App – sondern darin, dass der Kreis **geschlossen**
ist: Was in der echten Arbeit schiefging, verändert, was morgen geübt wird.

```
  TERMIN   →   STOFF    →    PLAN    →   ÜBEN    →   PROBE   ‖   NACHBEREITUNG
 Klausur-     Themen +     rückwärts,   Karten,     unbenotet ‖   Foto der Arbeit,
 plan, ICS,   Lernziele    Abstände,    Vokabeln,   wieder-   ‖   Fehler klassifizieren,
 von Hand     am Termin    Blocker      Tutor       holbar    ‖   Note ans Event
 ─────────────────────────────────────────────────────────────────────────────────
   live         fehlt        fehlt      teilweise    fehlt    ‖       fehlt
                  ↑            ↑           │           │      ‖         │
                  └────────────┴───────────┴───────────┴──────╫─────────┘
                                     MASTERY je Lernziel      ‖
                          Abdeckung (wie viel) × Sicherheit (wie gut)
                                        – Tabelle fehlt –       ‖ = Klassenarbeit
```

**Der Kreis ist an beiden Enden offen.** Vorn kennt `calendar_event` Datum und Fach, aber kein
Thema. Hinten gibt es keinen Weg, die zurückgegebene Arbeit einzulesen. Dazwischen läuft der
Vokabelteil – und der hängt am Fach, nicht am Termin. Genau die zwei offenen Enden sind das,
was §1 als Vorsprung gegenüber Astra & Co. beschreibt.

## 2. Der Lernplan als Rechenregel

`konzept.md` §6 M7 sagt: „rückwärts vom Termin, Spacing, berücksichtigt Blocker, Ballungen,
Mastery, Zeitbudget pro Tag." Das ist eine Absichtserklärung, keine Regel. Ohne Formel wird
daraus entweder ein starrer Sieben-Tage-Raster (so macht es Knowunity) oder gar nichts.

Die Forschung liefert eine Regel: Der optimale Abstand zwischen zwei Durchgängen liegt bei rund
**10–20 % der Zeit, über die das Wissen halten soll** (Cepeda et al. 2008). Drei Wochen bis zur
Arbeit heißt: Abstände von zwei bis vier Tagen, fünf bis sieben Termine – nicht zwanzig.

```
 T−21      T−18        T−14      ✕✕✕      T−10        T−6  T−5   T−3  T−1  ‖  T+3
   ■         ■           ■     Projekt-     ■          ■    ▣     ■    ■   ‖   ▣
   └── 3 T ──┴─── 4 T ───┘      woche       └─── 4 T ──┴─3T─┴──2T─┴────┘   ‖
   │                                                        │              ‖   │
   └── Verstehen ──┴──── Festigen: abrufen statt lesen ──────┴─ Prüfen ────╫─ Nachbereiten
                                                                           ‖
 ■ Lernslot   ▣ Probeprüfung / Arbeit zurück   ✕ Blocker    ‖ = Klassenarbeit
```

Drei Dinge folgen daraus:

- Die Abstände **schrumpfen** zum Termin hin (2–4 Tage), sie sind nicht gleichverteilt.
- Der Plan endet **nicht** am Prüfungstag, sondern drei Tage danach mit der Nachbereitung.
- Er braucht die **Blocker** (Ferien, Projektwoche, Fahrt) und die **zweite Arbeit** derselben
  Woche. [ADR 0016](adr/0016-kalender-import-pipeline.md) D5 verwirft Blocker im Import
  ausdrücklich nur so lange, „bis ein Lernplan-Ticket sie braucht" – mit P-03 ist der Fall da.

Damit ist der Lernplan eine reine Funktion über `(datum, blocker[], lernziele, minuten_pro_tag)`
und als solche unit-testbar – wie `upcoming.ts` bei K-01.

## 3. Wo die Datenspur abreißt

```
 calendar_event ─ [event_topic] ─ topic ─ learning_objective ─ card ─ review
      ✔              fehlt        ✱          ✱                  ✔      ✔
      │                            │          │                        │
      └─ exam/exam_attempt         └─ material └─ study_plan           └─ objective_mastery
             fehlt                    fehlt        fehlt                    fehlt

 ✔ = existiert und wird befüllt   ✱ = existiert im Schema, kein Weg hinein
 An `calendar_event` fehlt außerdem `result` (die Note aus der echten Arbeit).
```

`topic` und `learning_objective` stehen seit F-04c im Schema, werden aber von **keiner**
Oberfläche angelegt – nur der Tutor liest sie (`tutor_session.topic_id`). Das ist der
Flaschenhals: P-01, Lernplan, Probeprüfung und Mastery hängen alle daran.

Gut ist: `card` ist seit V-01 bewusst generisch (`objective_id` statt nur `vocab_item_id`,
Check-Constraint `card_exactly_one_source`). Das Rückgrat trägt also schon.

## 4. Was die Forschung sagt

Der Befund ist seit Jahrzehnten stabil und für uns unbequem eindeutig: Die Techniken, die
Jugendliche von selbst wählen – markieren, zusammenfassen, nochmal lesen – gehören zu den
schwächsten. Die beiden stärksten fühlen sich anstrengend an, und genau deshalb wirken sie.

| Mechanismus                                                                      | Wirkung                                     | Beleg                                                             |
| -------------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------------------------------------------- |
| **Abfragen statt wiederlesen** (Practice Testing)                                | hoch                                        | Dunlosky et al. 2013; Meta-Analyse über 242 Studien, 2021         |
| **Verteiltes Üben** (Distributed Practice)                                       | hoch                                        | ebd.; verteiltes Abrufen schlägt geballtes (Latimier et al. 2021) |
| **Abstand ≈ 10–20 % der Behaltensdauer**                                         | Rechenregel                                 | Cepeda et al. 2008                                                |
| **Interleaving, Selbsterklärung, elaborierendes Nachfragen**                     | mittel                                      | Dunlosky et al. 2013                                              |
| **Zusammenfassen, markieren, wiederlesen**                                       | gering                                      | ebd.                                                              |
| **Übungstests senken Prüfungsangst** – wenn unbenotet und wiederholbar           | belegt                                      | Meta-Analyse, Educational Psychology Review 2023                  |
| **Autonomie- und Kompetenzerleben** dämpfen Angst stärker als die Zahl der Tests | belegt                                      | Contemporary Educational Psychology 2024                          |
| **Rückblick nach der Arbeit** (Exam Wrapper): Fehlerart _und_ Vorbereitung       | Metakognition ja, Note klein                | Soicher & Gurung 2017; Review 2025                                |
| **Wenn-dann-Pläne** (Ort und Auslöser statt Vorsatz)                             | gemischt, mit Hindernis-Durchspielen besser | RCT 2025                                                          |

Zwei Konsequenzen, die unser Konzept betreffen:

1. **Die Probeprüfung darf sich nicht wie die Prüfung anfühlen.** §6 M6 beschreibt Timer, Punkte,
   Notenschlüssel – die Simulation des Ernstfalls. Die Angstforschung sagt: Der Lerneffekt kommt
   aus der Schwierigkeit, die Entlastung aus dem _niedrigen Einsatz_. Ein Probetest, der eine Note
   ausgibt, ist ein zweiter Stressor.
2. **Unsere „bewusst nicht"-Liste ist wissenschaftlich gedeckt.** Keine Streaks im Header, keine
   Bestenlisten, kein Lösungsmodus, sie wählt Einstieg und Niveau – das ist nicht Pädagogik-Folklore,
   sondern der Befund zur Autonomie. Bitte so lassen.

## 5. Der Markt

Alle können dasselbe: _Material hochladen → Lernplan generieren → Karten und Probetest._

| App                 | Zur Prüfung                                                   | Was fehlt                                                      |
| ------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| Vaia / StudySmarter | Upload → Kurs, automatischer Lernplan, „Exam AI" mit Feedback | Plan kennt keine echten Termine; kein Rückfluss aus der Arbeit |
| Knowunity           | 7-Tage-Lernplan: Datum + Themen eintragen                     | Inhalte von Mitschülern; fester Raster statt Abstandsrechnung  |
| simpleclub          | Personalisierter Plan im Bezahltarif, Videos + Übungen        | Video-zentriert: Wiedersehen statt Abrufen                     |
| Quizlet             | Lern- und Testmodus über fremde Sets                          | keine Planung, kein Lehrplanbezug                              |
| Khanmigo            | Sokratischer Tutor ohne Lösungen                              | US-Curriculum, kein Kalender                                   |
| ANTON               | Übungen entlang des Lehrplans Kl. 1–10                        | kein Prüfungsbezug, kein Plan                                  |
| Astra AI            | Prüfungsvorbereitungs-Seite, Zielnote, Countdown (§15)        | Themen ohne Fachbindung; Lösungsmodus als Kaufargument         |

**Die Lücke im Markt ist unverändert unsere:** Niemand koppelt an den tatsächlichen Klausurplan,
an das tatsächliche Heft und an die tatsächliche Note. Der Vorsprung liegt also im Ungebauten.

## 6. Die Lücken, sortiert nach Abhängigkeit

| #   | Lücke                                                                                                                                         | Ticket            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | **Kein Weg zu einem Thema.** `topic`/`learning_objective` ohne Oberfläche – blockiert alles Weitere                                           | **P-00**          |
| 2   | **Mastery ist eine Idee, keine Tabelle.** Ohne sie kein Stand je Lernziel, keine Priorität im Plan, kein Fördern/Fordern                      | **P-02**          |
| 3   | **Der Lernplan hat keine Rechenregel** – und die Blocker werden im Import verworfen                                                           | **P-03**          |
| 4   | **Die Probeprüfung fehlt** – der am besten belegte Mechanismus ist der am weitesten entfernte                                                 | **P-04**          |
| 5   | **Die zurückgegebene Arbeit fällt aus dem System.** Kein `result` am Event, kein Ticket                                                       | **P-05**          |
| 6   | **„Mix" mischt das Falsche.** Heute Kartenarten (V-04), gemeint waren Themen                                                                  | in **P-04**/V-04b |
| 7   | **Niemand misst, ob sie sich richtig einschätzt.** `review` ohne `self_assessment`, T-04 offen                                                | **P-06**          |
| 8   | **Freies Abrufen kommt nicht vor.** Karten prüfen Einzelfakten, nicht Zusammenhänge                                                           | **T-20**          |
| 9   | **Der Vorlauf ist nirgends sichtbar.** „Heute“ ist Agenda, die Terminliste zeigt keine Lernzeit                                               | **P-03**          |
| 10  | **Ferien und Halbjahr fehlen.** `school_profile.holidays` ist leeres JSONB ohne Leser – ein Plan ohne Ferien verplant Tage, die es nicht gibt | **K-05**          |

## 7. Entscheidungen, die anstehen

Diese drei gehören dem Menschen, nicht dem nächsten Ticket:

1. **Probeprüfung: benotet oder nicht?** Vorschlag aus der Angstforschung: unbenotet, beliebig
   wiederholbar, Timer nur als Fordern-Variante, Ergebnis als Lernziel-Liste statt als Note. Die
   Note kommt aus der echten Arbeit – nur dort. Weicht von §6 M6 ab, also ADR-würdig.
2. **Zeitbudget pro Tag** (§14 Frage 3, seit v2 offen). Der Lernplan kann ohne Zahl nicht rechnen.
   Vorschlag: eine Frage an sie („Wie viel Zeit hast du heute?"), Vorgabewert 20 Minuten.
3. ~~**Zielnote** (§15, von Astra übernommen)~~ — **entschieden: sie entfällt.** Niemand trägt
   freiwillig eine 3 als Ziel ein, und der Fortschrittsbalken, für den das Feld gedacht war, ist mit
   [ADR 0018](adr/0018-rueckmeldung-ohne-urteil.md) D4 ohnehin gestrichen. Die berechtigte Frage
   dahinter – „wie viel ist genug?“ – beantworten das Niveau je Lernziel, die Vollständigkeit
   („4 von 6 Lernzielen sitzen“) und der Vergleich mit der letzten Probe. Nachtrag in ADR 0018.

## 8. Was daraus weiterführt

Zwei Fragen, die beim Durchsprechen aufkamen und eigene Antworten bekommen haben:

- **Wie kommt der Stoff überhaupt hinein, jenseits von Vokabeln?** → drei Tiefenstufen (Volltext →
  Lernziele → Karten), Material aus dem, was ohnehin durchläuft, und ein Kontextpaket statt eines
  Retrievers. Entschieden in [ADR 0017](adr/0017-materialtiefe-und-kontextpaket.md), Bilder in
  [„Woher der Stoff kommt"](https://claude.ai/code/artifact/17152fa9-f19f-4b30-8440-c6e3a1f63aba).
- **Wie zeigt man den Vorlauf, ohne etwas zu versprechen, das morgen anders aussieht?** → drei
  Horizonte mit abnehmender Verbindlichkeit und ein Drei-Wochen-Streifen statt eines Monatskalenders.
  Hängt an P-03 und K-05, Bilder in
  [„Der Lernstreifen"](https://claude.ai/code/artifact/544d4550-e22b-4bb5-b6f4-198d93dc644f).

## 9. Quellen

- Dunlosky, Rawson, Marsh, Nathan & Willingham (2013): _Improving Students' Learning With Effective
  Learning Techniques_, Psychological Science in the Public Interest 14(1)
- _A Meta-Analysis of Ten Learning Techniques_, Frontiers in Education 2021
- Latimier, Peyre & Ramus (2021): _A Meta-Analytic Review of the Benefit of Spacing out Retrieval
  Practice Episodes_, Educational Psychology Review
- Cepeda, Vul, Rohrer, Wixted & Pashler (2008): _Spacing Effects in Learning: A Temporal Ridgeline
  of Optimal Retention_, Psychological Science 19(11)
- _Do Practice Tests Reduce or Provoke Test Anxiety? A Meta-Analytic Review_, Educational
  Psychology Review 2023
- _Test anxiety fluctuations during low-stakes secondary school assessments_, Contemporary
  Educational Psychology 2024
- Soicher & Gurung (2017): _Do Exam Wrappers Increase Metacognition and Performance?_;
  Scoping Review, Nurse Education in Practice 2025
- _Mental contrasting with implementation intentions to curb academic procrastination_, RCT 2025
