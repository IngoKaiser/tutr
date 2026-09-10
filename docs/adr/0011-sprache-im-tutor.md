# ADR 0011: Sprache ist ein Eingabeweg, kein zweites Gehirn

Status: **vorgeschlagen** · Datum: 2026-09-10 · Bezug: docs/konzept.md §4, §4a, §11, §15
Baut auf [ADR 0010](0010-tutor-architektur.md) auf und lässt dessen D1 unberührt: Der
Textweg bleibt der Hauptweg. Ein Echtzeit-Sprachmodell wäre ein **zweiter** Transport,
kein Ersatz — was das für D1 hieße, steht in D3.
Tickets: T-02b (Diktat), T-02d (Vorlesen), T-06 (Echtzeit, vertagt).

## Kontext

Die Frage kam von außen und ist berechtigt: Ein 14-jähriges Kind erklärt lieber, als
dass es tippt. §15 hat das schon anerkannt und die Spracheingabe von V4 nach **V2**
vorgezogen — „sie ist billig und senkt die Tipp-Hürde beim Erklären". §11 legt sich auf
„Web Speech API (STT/TTS, kostenlos, Chrome/Safari) zuerst; Whisper/ElevenLabs später"
fest.

Was das Konzept **nicht** betrachtet hat, ist die dritte Möglichkeit: ein
Echtzeit-Sprachmodell, das zuhört und spricht, mit Unterbrechen und Nachhaken — ein
flüssiger Dialog statt abwechselnder Beiträge. Das ist inzwischen bei mehreren
Anbietern verfügbar und wäre für einen Tutor naheliegend. Diese Entscheidung holt das
nach.

Vorbereitet ist bereits: `Permissions-Policy: microphone=(self)` steht seit F-07 im
`next.config.ts`. Gebaut ist nichts.

### 1. „Sprache" heißt hier drei verschiedene Dinge

|                        | Was passiert                                                                | Wo läuft es                                 | Was es kostet                 |
| ---------------------- | --------------------------------------------------------------------------- | ------------------------------------------- | ----------------------------- |
| **A · Diktat**         | Kind spricht, Text erscheint im Eingabefeld, Kind korrigiert und schickt ab | Browser (Web Speech API)                    | nichts                        |
| **B · Vorlesen**       | Die fertige Antwort wird gesprochen                                         | Browser (`speechSynthesis`, Systemstimmen)  | nichts                        |
| **C · Echtzeitdialog** | Beide reden, Unterbrechen möglich, keine sichtbare Textzeile dazwischen     | Bidirektionales Audio zu einem Sprachmodell | pro Minute, nicht pro Antwort |

A und B zusammen ergeben bereits eine **gesprochene Schleife**: reden → lesen →
vorgelesen bekommen. Das ist nicht C, aber es ist auch nicht Tippen. Der Unterschied
zwischen A+B und C ist nicht „Sprache ja/nein", sondern **Latenz und Unterbrechbarkeit**.

### 2. Die Stimme eines Kindes ist ein besonderes Datum

Das Projekt hat eine klare Haltung: EU-Storage, pseudonyme Kind-Profile, keine
Trainingsnutzung, keine Geburtsdaten (§11, ADR 0005/0006). Rohaudio einer
Minderjährigen ist ein biometrienahes Datum und damit heikler als der Text, den es
erzeugt.

Und hier gibt es eine unbequeme Wahrheit über den „kostenlosen" Weg A: Die Web Speech
API erkennt in Chrome **nicht auf dem Gerät**, sondern schickt Audio an Google; Safari
nutzt Apples Dienst, neuere Systeme teils lokal. „Kostenlos" heißt hier also
„bezahlt mit dem Datenweg", nicht „bleibt im Browser". Das Konzept nennt die API
kostenlos und übersieht diesen Punkt.

Das ist kein Ausschlusskriterium — dieselben Kinder diktieren täglich in WhatsApp —
aber es ist eine Entscheidung, die bewusst und sichtbar getroffen werden muss, nicht
beiläufig beim Einbauen eines Mikrofonknopfes.

> **Vor der Umsetzung nachmessen, nicht annehmen.** Welcher Browser wo erkennt, ändert
> sich mit den Versionen. Das ist im Projekt Gewohnheit (die `output_config`-Falle in
> `src/ai/client.ts` steht als Kommentar drin, weil sie gegen die echte API geprüft
> wurde). Für T-02b gilt dasselbe: je Zielbrowser prüfen, was tatsächlich passiert.

### 3. Der schwierige Teil ist die Pädagogik, nicht das Audio

Das ist das Argument, das die Reihenfolge bestimmt.

§4a ist die eigentliche Produktentscheidung von tutr: Zwei-Versuche-Regel,
Hinweisleiter in vier Stufen („nie zwei auf einmal"), „Versuch = Eingabe, nicht Klick",
und der Versuch zählt nur **mit sichtbarem Lösungsweg** — einem Foto vom Heft. §15
listet den Lösungsmodus-Schalter ausdrücklich unter „Bewusst nicht".

Ein flüssiger Sprachdialog arbeitet gegen jede dieser Regeln:

- **Der Zustand verliert seinen Halt.** Bei abwechselnden Beiträgen weiß die App, in
  welcher Hinweisstufe sie ist und wie viele Versuche dokumentiert sind — sie kontrolliert
  den Takt. In einem durchlaufenden Gespräch entscheidet das Modell das im Fluss.
- **Nachbohren wird billig.** „Sag's mir einfach" dreimal hintereinander gesprochen ist
  müheloser als dreimal getippt. Die Reibung aus §4a („mühsamer als selbst denken") ist
  genau das, was verschwindet.
- **Das Foto passt nicht hinein.** Der Kern des Hausaufgaben-Ablaufs ist, dass der Tutor
  den _Rechenweg_ liest — „Zeile 3: hier hast du das Vorzeichen verloren". Ein
  Sprachkanal trägt das nicht.
- **Es gibt nichts zu prüfen.** Der Sprachwächter aus ADR 0010 D3 setzt einen Text
  voraus, der gespeichert wird. Bei durchlaufendem Audio ohne Transkript gibt es weder
  Verlauf noch Markierung noch Elternzusammenfassung (§4a).

Kurz: Ein Echtzeit-Tutor wäre ein **Lösungsmodus durch die Hintertür**, wenn man die
Pädagogik nicht vorher woanders bewiesen und festgeschrieben hat.

### 4. Kosten in einer anderen Größenordnung

ADR 0010 D4 rechnet mit **1,1 Cent je Textantwort** und deckelt bei 60 am Tag. Audio
wird pro Minute abgerechnet und liegt bei allen Anbietern deutlich darüber — eine
zwanzigminütige Hausaufgabensitzung kann dann mehr kosten als ein ganzer Monat
Text-Tutor.

Die genauen Zahlen ändern sich zu schnell, um sie hier festzuschreiben; sie gehören in
T-06 frisch erhoben. Die Größenordnung reicht für die Entscheidung: Der Deckel aus
ADR 0010 D4 müsste für Sprache neu gedacht werden, nicht nur neu parametriert.

### 5. Kein Anbieter aus einer Hand

CLAUDE.md legt Claude als Modell fest („Sonnet für Tutor …"). Die Claude API bietet
heute keinen Audio-Ein- oder -Ausgang und kein Echtzeit-Sprachprotokoll — **vor T-06 neu
zu prüfen, nicht als dauerhaft wahr zu behandeln.** Ein Echtzeitdialog hieße deshalb
heute: ein **zweiter Modellanbieter** neben Anthropic, mit eigenem Systemprompt, eigenem
Verhalten, eigenen Secrets, eigener Auftragsverarbeitung — und der Pflicht, §4a und den
Sprachwächter dort ein zweites Mal umzusetzen und zu testen.

## Entscheidung

### D1 · Diktat über die Web Speech API — und der Text bleibt vor dem Senden stehen

Ein Mikrofonknopf am Eingabefeld. Gesprochenes landet als **Text im Feld**, nicht direkt
im Chat. Das Kind liest, korrigiert, schickt ab.

Der Zwischenschritt ist die Entscheidung, nicht ein Detail: Erkennung ist im Deutschen
unzuverlässig bei Fachbegriffen, Zahlen und Satzzeichen — genau dem, was in Mathe und
Französisch zählt. Ein direkt abgeschickter Diktattext produziert Rückfragen des Tutors
über Erkennungsfehler statt über den Stoff. Nebenbei kostet jede solche Rückfrage einen
Modellaufruf.

Architektonisch ändert sich damit **nichts** an ADR 0010: Es ist derselbe Text, derselbe
Endpunkt, derselbe Systemprompt, derselbe Rate-Limit-Zähler, derselbe Sprachwächter,
derselbe Verlauf in `tutor_message`. Sprache ist ein Eingabeweg, kein zweiter Pfad.

Ohne API-Unterstützung im Browser erscheint der Knopf gar nicht erst — kein toter Knopf,
keine Fehlermeldung.

**Vor der ersten Nutzung** ein einmaliger, klarer Satz darüber, dass die Aufnahme zur
Erkennung an den Browser-Hersteller geht (§. 2). Kein Einwilligungs-Dialogtheater, ein
Satz — aber er steht da, bevor das Mikrofon zum ersten Mal angeht.

### D2 · Vorlesen über `speechSynthesis` — TTS zieht von V4 vor, weil es geschenkt ist

Ein Knopf an jeder Tutor-Antwort liest sie vor, mit Systemstimme. Abschaltbar, und er
stoppt, sobald das Kind wieder tippt oder spricht.

§15 hat die Sprach*ausgabe* ausdrücklich in V4 gelassen, während die Eingabe nach V2
vorgezogen wurde. Diese Entscheidung zieht auch die Ausgabe vor — mit einer Begründung,
die §15 damals nicht hatte: `speechSynthesis` nutzt die Stimmen des Betriebssystems,
kostet nichts, braucht keinen Dienst und keinen Schlüssel. Der Aufwand ist ein Knopf und
ein Zustand. Was §15 in V4 verschoben hat, sind **erzeugte** Stimmen (ElevenLabs) — die
bleiben dort.

Zusammen mit D1 entsteht damit die gesprochene Schleife aus §. 1, ohne einen einzigen
neuen Dienst.

Eine Einschränkung, die beim Bauen zu prüfen ist: Manche Systemstimmen sind
netzgebunden (`voice.localService === false`). Bevorzugt werden lokale deutsche
Stimmen; gibt es keine, wird vorgelesen, was da ist — aber die Auswahl ist bewusst, nicht
zufällig die erste in der Liste.

### D3 · Echtzeit-Sprachdialog wird vertagt, nicht abgelehnt — mit benannten Bedingungen

T-06 bleibt im Backlog. „Später" ohne Kriterium wäre eine Ausrede, deshalb die
Bedingungen, unter denen die Entscheidung neu ansteht — **alle vier**, nicht drei davon:

1. **Der Text-Tutor trägt §4a.** Hinweisleiter, Zwei-Versuche-Regel und die
   Fehlerklassifikation existieren, sind getestet und haben sich im echten Gebrauch
   bewährt (T-03). Erst dann gibt es eine Pädagogik, die man in ein zweites Medium
   übersetzen kann.
2. **Der Zustand liegt in der App, nicht im Modell.** Hinweisstufe und Versuchszähler
   sind Spalten in der Datenbank, die ein Sprachagent nur _liest_ und _fortschreibt_ —
   nicht Gedächtnis im Gesprächsverlauf.
3. **Transkript gleichberechtigt.** Jeder gesprochene Beitrag landet als
   `tutor_message`, sonst gibt es weder Sprachwächter noch Verlauf noch die
   Elternzusammenfassung aus §4a. Ein Sprachweg ohne Transkript kommt nicht in Frage.
4. **Kosten frisch gerechnet und gedeckelt**, mit einem eigenen Fenster für Minuten
   statt Antworten (ADR 0010 D4 erweitern, nicht umparametrieren).

Wird C dann gebaut, ist es ein **zusätzlicher** Transportweg neben dem Route Handler aus
ADR 0010 D1, kein Ersatz: Der Textchat bleibt der Ort, an dem Fotos, Formeln und der
Verlauf leben. Erst wenn sich zeigen sollte, dass fast niemand mehr tippt, stünde
ADR 0010 D1 zur Ablösung an — dann als eigener ADR, der diesen hier fortschreibt.

**Fordern-Ausnahme:** §6 M4 nennt „Sprechen (STT-Bewertung)" und §6 „Mündlich (V4): STT,
Nachfragen, Feedback". Das ist ein _abgegrenzter_ Sprachfall — Aussprache und mündliche
Prüfung in Fremdsprachen — mit klarem Anfang und Ende. Er fällt **nicht** unter die
Vertagung hier und darf früher kommen; die Gefahr aus §. 3 (Nachbohren, Lösungsmodus)
existiert dort nicht.

### D4 · Das Prinzip, an dem sich künftige Sprachfragen messen lassen

> Sprache verändert, **wie** eine Frage hereinkommt und **wie** eine Antwort hinausgeht.
> Sie verändert nicht, **wer** antwortet, **woher** die Antwort kommt oder **welche
> Regeln** dabei gelten.

Jeder Sprachweg mündet in denselben Verlauf, denselben Zähler, denselben Sprachwächter,
dieselben Schichten. Sobald ein Vorschlag daran vorbeigeht — ein Agent mit eigenem
Gedächtnis, ein Sprachkanal ohne Transkript, ein zweiter Systemprompt „nur fürs
Sprechen" —, ist das das Signal, dass er einen eigenen ADR braucht und nicht als
Erweiterung durchgeht.

### D5 · Was die Oberfläche zeigt

- **„tutr hört zu"** als sichtbarer Zustand, solange das Mikrofon offen ist (§15). Kein
  stilles Mithören, keine Daueraufnahme.
- Das Mikrofon geht **nur auf Tastendruck** an und schließt sich bei Stille von selbst.
  Kein Wortsignal, kein Hintergrundlauschen.
- Der erkannte Text erscheint **während** des Sprechens, damit sichtbar ist, was ankommt.
- Vorlesen ist standardmäßig **aus**. Wer es einschaltet, behält es; wer tippt, stoppt es.

## Konsequenzen

**Gut:**

- Der gesprochene Weg entsteht ohne neue Abhängigkeit, ohne neuen Dienst, ohne neue
  Secrets und ohne einen Cent Zusatzkosten.
- ADR 0010 bleibt vollständig gültig; T-02b und T-02d sind additiv und je eine kurze
  Session.
- Der Datenweg der Stimme ist benannt und wird dem Kind gesagt, statt in einem
  Mikrofonknopf zu verschwinden.
- Für die große Variante liegen Kriterien vor, nicht ein Gefühl. „Noch nicht" ist
  überprüfbar.

**Preis, offen benannt:**

- **Es bleibt bei abwechselnden Beiträgen.** Kein Unterbrechen, kein Nachhaken mitten im
  Satz. Wer C erwartet, bekommt A+B — spürbar weniger flüssig.
- **Diktat im Deutschen ist mittelmäßig.** Fachbegriffe, Zahlen und Satzzeichen werden
  Nacharbeit verlangen. Der Korrekturschritt aus D1 macht das erträglich, aber nicht
  unsichtbar.
- **Systemstimmen klingen wie Systemstimmen.** Deutlich schlechter als erzeugte
  Stimmen — der Preis dafür, dass es nichts kostet und nichts verlässt.
- **Der Datenweg über Google/Apple bleibt bestehen**, solange die Erkennung im Browser
  läuft. Wer das nicht will, landet bei serverseitigem STT — und damit bei einem
  bezahlten Dienst und einer weiteren Auftragsverarbeitung. Diese Tür bleibt offen, ist
  aber heute nicht die erste Wahl.

## Abgelehnte Alternativen

**Sofort ein Echtzeit-Sprachmodell (Variante C).** Wäre die eindrucksvollste Fassung und
das, wonach gefragt wurde. Verworfen für _jetzt_, aus vier Gründen in dieser Reihenfolge:
§4a hat noch keinen Boden, den ein Sprachagent tragen könnte (§. 3); der Zustand läge im
Modell statt in der App; ein zweiter Anbieter verdoppelt Systemprompt, Sprachwächter und
Tests; und die Kosten sprengen den Deckel aus ADR 0010 D4. Keiner der Punkte ist
dauerhaft — D3 sagt, wann sie wegfallen.

**Diktat, das direkt abschickt.** Flüssiger und näher an C. Verworfen: Erkennungsfehler
würden zu Tutor-Rückfragen über Erkennungsfehler, jede davon ein bezahlter Aufruf, und
das Kind lernt, dem Ding zu misstrauen, statt ihm zuzuhören.

**Serverseitiges STT (Whisper o. ä.) statt Browser-Erkennung, sofort.** Bessere
Erkennung, ein einziger kontrollierter Datenweg. Verworfen für die erste Fassung: neue
Abhängigkeit, neuer Schlüssel, neue Auftragsverarbeitung und laufende Kosten — für einen
Qualitätsgewinn, der sich erst zeigen muss. §11 sieht diesen Weg ausdrücklich als
zweiten Schritt vor („Whisper/ElevenLabs später"); D1 bleibt damit auf der Linie des
Konzepts.

**Erzeugte Stimmen (ElevenLabs) fürs Vorlesen.** Klingt erheblich besser. Verworfen:
kostet pro Zeichen, braucht einen Dienst und schickt den Antworttext an einen weiteren
Empfänger — für Vorlesen, das `speechSynthesis` umsonst erledigt. Bleibt in V4, wo §15
es hatte.

**Sprachausgabe standardmäßig an.** Verworfen: Ein Gerät, das von selbst zu reden
anfängt, ist im Klassenzimmer, im Bus und neben Geschwistern falsch. Wer es will,
schaltet es ein.
