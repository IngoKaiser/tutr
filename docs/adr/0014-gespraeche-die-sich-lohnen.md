# ADR 0014: Gespräche, die sich zu behalten lohnen

Status: **akzeptiert** · Datum: 2026-09-11 · Bezug: docs/konzept.md §15, §4
Ändert [ADR 0010](0010-tutor-architektur.md) („Konsequenzen": Titel aus der ersten Frage
gekürzt, Modell-Titel auf Stufe 2 vertagt). Baut auf
[ADR 0013](0013-tutor-beginnt-mit-dem-dialog.md) D6 auf (Historie nach Fach gruppiert).
Tickets: T-19.

## Kontext

### 1. Der Auslöser

Nach zwei Tagen echter Nutzung standen neun Gespräche in der Historie. Beim Blick darauf:

> „Die Tutor-Historie ist gerade schon recht lang, die wird ja tendenziell eher länger. Wenn
> die Kinder jeden Tag mehrere Chats eröffnen, dann wird das ja sehr schnell sehr viel."

Die Rechnung stimmt: drei bis fünf Gespräche am Tag sind rund hundert im Monat und knapp
tausend im Schuljahr.

### 2. Das Problem ist nicht die Länge

Was in diesen neun Einträgen tatsächlich stand:

| Titel                                                   | Was es ist                              |
| ------------------------------------------------------- | --------------------------------------- |
| „Was ist ein Mitochondrien"                             | eine Frage                              |
| „Was ist ein Mitochondrien?"                            | **dieselbe Frage, zwei Minuten später** |
| „Hallo"                                                 | kein Gespräch                           |
| „Erkläre mir einmal was lineare AG Preis ich versteh …" | abgeschnittener Rohtext eines Diktats   |
| „Hausaufgaben – Biologie"                               | brauchbar                               |

Von neun Einträgen waren drei Dubletten oder leer und einer unlesbar. **Eine kürzere Liste
löst das nicht – sie versteckt es nur.** Wer einen Monat später „das mit den Mitochondrien"
sucht, findet zwei Einträge gleichen Namens und weiß bei keinem, was drinsteht.

### 3. Drei Ursachen, nicht eine

1. **Jede Frage legt ein Gespräch an.** Seit ADR 0013 D1 beginnt der Tutor mit dem Dialog –
   das war richtig, hat aber die Hürde für ein neues Gespräch auf null gesenkt. Zwei Fragen
   zum selben Thema hintereinander ergeben zwei Einträge.
2. **Der Titel ist die erste Frage, auf 60 Zeichen gekürzt.** ADR 0010 hat das bewusst so
   entschieden und einen Modell-Titel auf „Stufe 2" vertagt. Bei getippten Fragen trägt das;
   bei diktierten – der Normalfall am Handy – entsteht Rohtext mitten im Satz.
3. **Alles steht gleichberechtigt auf der Startseite.** `/tutor` zeigt die letzten 20,
   gruppiert nach Fach. Die Liste ist damit zugleich Archiv und Startfläche – und für beides
   zu lang beziehungsweise zu unsortiert.

### 4. Was nicht in Frage kommt

**Automatisch löschen.** Der naheliegende Reflex (alles älter als 90 Tage verschwindet) wäre
hier falsch: Die Gespräche gehören dem Kind, nicht der App. `ai_usage` räumt nach sieben Tagen
auf – aber das sind Kostenzeilen, kein Lernverlauf. Stilles Verschwinden von etwas, das man
selbst geschrieben hat, ist ein Vertrauensbruch, und §15 verbietet ohnehin alles, was sich
hinter dem Rücken der Nutzerin abspielt.

## Entscheidung

### D1 · Eine Frage kurz nach der anderen setzt dasselbe Gespräch fort

Beginnt das Kind auf `/tutor` eine Frage, und das zuletzt benutzte Gespräch desselben Fachs
wurde vor weniger als **30 Minuten** angefasst, landet die Frage dort – statt ein neues
Gespräch anzulegen.

Der Auslöser ist eine Frage **ohne** offenes Gespräch: Wer in einem Gespräch steht, schickt
ohnehin dorthin. Hausaufgaben-Sessions bleiben außen vor – die gehören zu einem Foto, nicht zu
einer Frage, und haben ihren eigenen Dialog (§4a).

Die Zeitspanne ist eine Setzung, keine Messung: lang genug für „ach, und noch was", kurz
genug, dass die Hausaufgabe von heute Abend nicht an die von heute Mittag geklebt wird. Sie
steht als eine Konstante im Code und lässt sich ändern, wenn sich zeigt, dass sie falsch liegt.

**Das Fach ist Teil der Bedingung, nicht nur die Zeit.** Wer von Mathe zu Französisch
wechselt, wechselt das Thema – das ist ein neues Gespräch, auch nach zwei Minuten. Für ein
Gespräch ohne Fach („unklar", ADR 0013 D2) gilt die Fortsetzung nicht: Ohne Fach ist nicht
feststellbar, ob es dasselbe Thema ist.

**Warum nicht der Nutzerin überlassen** („Neues Gespräch"-Knopf)? Weil sie damit eine Frage
beantworten müsste, die sie nicht interessiert. Die App weiß genug, um sie selbst zu
beantworten – und die Korrektur (das Gespräch löschen) gibt es seit T-15.

**Die Oberfläche muss dann umschalten.** Wird fortgesetzt, hat das Kind vor sich einen leeren
Verlauf, während das Modell den alten kennt – eine Antwort, die auf „wie eben bei den
Mitochondrien" verweist, zeigte damit auf nichts. Der Server sagt die Fortsetzung deshalb im
Antwort-Header an, und die Oberfläche wechselt nach dem Stream wirklich auf `/tutor/<id>`
(statt nur die Adresszeile nachzuziehen, wie sie es bei einem neuen Gespräch tut). Dann steht
der ganze Verlauf da, in den die Frage gerade gewandert ist.

### D2 · Der Titel kommt vom Modell, nicht aus der ersten Frage

Das Modell vergibt einen Titel von **zwei bis vier Wörtern**: „Lineare Gleichungen",
„Reflexive Verben", „Photosynthese".

Damit ist die Vertagung aus ADR 0010 aufgehoben. Die Begründung dort – erst die Substanz, dann
der Schliff – war richtig für den Zeitpunkt; inzwischen ist die Substanz da, und der Rohtext
ist das, was die Liste unbrauchbar macht.

**Derselbe Aufruf, der ohnehin läuft.** Die Fach-Zuordnung (ADR 0013 D2) schickt vor der
ersten Antwort eine Haiku-Anfrage los und legt dem Modell dieselbe Nachricht vor, aus der auch
ein Titel entstehen müsste. Der Titel kommt deshalb in demselben Schema mit – ein Feld mehr,
kein zweiter Aufruf, wie schon beim Hausaufgaben-Foto (ADR 0013 D7).

**Also aus der Frage, nicht aus der Antwort** – und das genügt. Der Reflex wäre, auf den
fertigen Austausch zu warten, weil erst die Antwort zeigt, worum es ging. Aber der
Zuordnungsaufruf läuft zwingend **vor** dem Streamen: Das Fach entscheidet über die Sprache,
und die steht im Systemprompt (ADR 0013 D2, ADR 0011). Ein Titel danach wäre ein zweiter
Aufruf für einen kleinen Zugewinn. Er ist auch gar nicht nötig: Nicht die Frage ist das
Problem, sondern das **stumpfe Abschneiden** der Frage. „Erkläre mir einmal was lineare AG
Preis ich versteh …" enthält alles, was „Lineare Gleichungen" braucht – ein Modell liest darin,
was `slice(0, 57)` nicht lesen kann.

Der Preis steht in den Konsequenzen: Wo die Frage selbst nichts hergibt – ein Foto mit „schau
mal" –, gibt auch der Titel nichts her. Dieselbe Grenze hat die Fach-Zuordnung schon heute.

Als Notnagel bleibt die gekürzte Frage: Fällt der Aufruf aus, gibt es keine Fächer, oder kam
ein leerer Titel zurück, steht dort, was bisher dort stand.

Ein Titel, der danebenliegt, ist kein Drama: Er lässt sich antippen und ändern, so wie das
Fach seit ADR 0013 D4.

### D3 · Die Startseite zeigt „Zuletzt", das Archiv steht daneben

`/tutor` zeigt die **letzten sechs** Gespräche, nach Datum sortiert – nicht nach Fach.
Darunter ein Weg auf `/tutor/gespraeche`: dort die volle Liste, nach Fach gruppiert (ADR 0013
D6 bleibt dort gültig), mit Suche über Titel.

Die Gruppierung nach Fach ist eine **Archiv**-Eigenschaft: Sie hilft beim Wiederfinden, nicht
beim Weitermachen. Auf der Startfläche zählt „woran war ich dran", und das ist eine Frage der
Zeit, nicht des Fachs. Sechs Zeilen sind außerdem kurz genug, dass das Eingabefeld – das
eigentliche Hauptelement der Seite (ADR 0013 D1) – nicht nach unten rutscht.

### D4 · Aufgeräumt wird sichtbar oder gar nicht

Kein automatisches Löschen (siehe Kontext 4). Stattdessen: Zeigt das Archiv mehr als eine
Handvoll Gespräche aus abgeschlossenen Zeiträumen, bietet es an, sie wegzuräumen – als Satz
mit Knopf, den man auch ignorieren kann. Das Löschen selbst gibt es seit T-15, wischend und
mit Rückgängig-Fenster.

Dieser Teil ist **bewusst zuletzt**: Er lohnt sich erst, wenn D1 und D2 gewirkt haben. Wenn
danach immer noch zu viel dasteht, ist das die Information, die dieses Angebot braucht.

## Konsequenzen

**Gut:**

- Zwei Fragen zu einem Thema ergeben ein Gespräch statt zweier Zeilen – die häufigste Ursache
  für Dubletten fällt weg.
- Die Liste wird lesbar: „Lineare Gleichungen" statt „Erkläre mir einmal was lineare AG Preis
  ich versteh …".
- Die Startseite bleibt kurz, egal wie lange die App in Gebrauch ist.
- Nichts verschwindet ungefragt.

**Schlecht / Preis:**

- Ein Gespräch kann länger werden, als es ADR 0010s Kostenrechnung vorsah: Der ganze Verlauf
  geht bei jedem Zug erneut ans Modell. Bei sehr langen Gesprächen wächst der Preis je Frage.
  Das bleibt zu beobachten – die Schwelle wäre ein Punkt, an dem ein Gespräch von selbst
  umbricht (bewusst **nicht** Teil dieser Entscheidung, solange es kein Problem ist).
- Ein Titel vom Modell ist ein Titel, der danebenliegen kann. D2 macht ihn deshalb änderbar.
- Der Titel kennt nur die Frage, nicht das Bild daneben: Ein Gespräch, das mit einem Foto und
  „schau mal" beginnt, bekommt weiterhin keinen sprechenden Titel. Dieselbe Grenze wie bei der
  Fach-Zuordnung – wer ein Aufgabenblatt fotografiert, geht ohnehin den Hausaufgaben-Weg (§4a),
  und der vergibt seinen Titel aus dem erkannten Fach.
- Eine Seite mehr (`/tutor/gespraeche`) – und damit eine mehr, die den Regeln aus T-18 folgen
  muss.
- Die 30 Minuten sind geraten. Falsch gesetzt, klebt entweder Unzusammenhängendes aneinander
  oder es bleibt bei Dubletten.

## Abgelehnte Alternativen

**Automatisch löschen nach X Tagen.** Siehe Kontext 4 – der Lernverlauf gehört dem Kind.

**Ein „Neues Gespräch"-Knopf.** Verschiebt die Entscheidung auf die Nutzerin, die sie nicht
treffen will. Wer bewusst neu anfangen möchte, wechselt ohnehin meist das Fach – und dann
greift D1 nicht.

**Titel beim Anlegen statt nach dem Austausch.** Vor der Antwort steht nur die Frage – und
genau die ist das Problem. Ein Titel aus einer halben, diktierten Frage wäre derselbe Rohtext
in kürzer.

**Gespräche nach Thema statt nach Fach gruppieren.** Es gibt keine Themen-Oberfläche (§10
wartet auf T-04/M-01); eine Gruppierung nach etwas, das niemand anlegen kann, wäre leer.

**Die Historie ganz von der Startseite nehmen.** Der Auslöser sagt ausdrücklich das Gegenteil:
„die Fächerübersicht ist hier schon sehr hilfreich, um etwas Struktur zu behalten" (ADR 0013).
Sechs Zeilen sind der Kompromiss zwischen „im Weg" und „weg".
