# ADR 0017: Material ist Volltext, Struktur entsteht aus Anlässen – und der Tutor liest einen Block, keinen Index

Status: **akzeptiert** · Datum: 2026-09-12 · Bezug: docs/konzept.md §7 (drei Schichten des
Kurrikulums), §10 (Material-Schichten, Kontextpaket), §6 M1/M2, §11 (Prompt Caching)
Schließt die offenen Enden aus [ADR 0010](0010-tutor-architektur.md) („Offen für T-01 (voll)":
Kontextpaket pro Thema, Schichten mit Quellenangabe, Prompt Caching).
Baut auf [ADR 0008](0008-fachbindung-von-lernmaterial.md) (alles Lernmaterial ist fachgebunden).
Weicht in D2 und D4 von §10 ab und dokumentiert das, wie [ADR 0006](0006-student-als-mandant.md)
es für §8 tut. Tickets: M-01, M-02, P-00, P-01, T-01, T-05.
Bilder zur Herleitung: [„Woher der Stoff kommt"](https://claude.ai/code/artifact/17152fa9-f19f-4b30-8440-c6e3a1f63aba).

## Kontext

Vokabeln funktionieren, weil das Material **schon strukturiert ankommt**: Wort | Übersetzung,
zwei Spalten, direkt abfragbar. Für jedes andere Fach kommt ein Foto vom Heft an, und die
naheliegende Antwort wäre, dieselbe Struktur zu erzwingen – jedes Material zerlegen in
Lernziele, Karten, Niveaustufen. Das ist der Punkt, an dem das Konzept für eine Vierzehnjährige
zu einer Pflegeaufgabe wird.

§10 beschreibt die Rangfolge der Schichten und den Kontextpaket-Gedanken, sagt aber nichts über
**Tiefe**: Wie viel Struktur braucht ein Thema, bevor es nutzbar ist? Und ADR 0010 D5 hält fest,
warum Stufe 1 gar kein Kontextpaket hatte: „Stufe 1 hat auch schlicht nichts zu lesen – Material
(M-01) gibt es nicht, Lehrwerke (L-01) sind nicht erfasst, und Themen existieren nur im Seed."
Zwei davon sind inzwischen erledigt (L-01 live, P-00 geschnitten); die Frage nach dem Paket
selbst ist offen geblieben.

Dazu kommt eine Beobachtung aus dem Zeitverlauf: Das Material eines Themas ist **erst kurz vor
der Arbeit vollständig**, der Lernplan soll aber drei Wochen vorher anfangen.

## Die entscheidende Beobachtung

Material, Ordnung und Messung sind drei verschiedene Dinge, und nur eines davon muss gepflegt
werden – keines.

- **Material ist Inhalt.** Es beantwortet „wie wurde es im Unterricht gemacht" und ist dafür als
  Fließtext bereits vollständig nützlich. Der Tutor liest Text, keine Datenbank.
- **Das Lehrwerk ist Ordnung.** Reihenfolge, Kapitelgrenzen, Begriffe – und, unterschätzt: was
  noch aussteht. Diese Ordnung liegt ab dem ersten Tag eines Themas vor, lange vor dem Material.
- **Das Lernziel ist die Messstelle.** Es beantwortet als einziges „was kann sie". „Kapitel 3"
  ist keine Antwort darauf, „Material vorhanden" erst recht nicht.

Daraus folgt, dass Struktur nicht die Voraussetzung für Nutzen ist, sondern dessen Nebenprodukt.

## Entscheidung

### D1 · Drei Tiefenstufen, und jedes Thema darf auf jeder stehenbleiben

- **Stufe A – Volltext.** Foto → OCR → Text am Thema. Kein Lernziel, keine Zuordnung nötig. Der
  Tutor kann damit bereits §4 Einstieg 2 und 4 vollständig bedienen. **Der Großteil des Materials
  bleibt hier, dauerhaft.**
- **Stufe B – Lernziele.** 3–8 Sätze im Infinitiv je Thema („lineare Gleichungen mit Klammern
  lösen"). Kein Kompetenzmodell. Erst diese Stufe macht Lernplan (P-03), Mastery (P-02) und
  Prüfungsauswertung (P-04) möglich.
- **Stufe C – Karten.** Nur, wo abgefragt wird.

Die Stufen entstehen aus **Anlässen**, nie aus Aufforderung: Anlass für B ist ein Termin im
Kalender für dieses Fach, Anlass für C ist ein Fehler, eine gezeigte Lösung oder eine Lücke aus
der Probe. Es gibt keinen Bildschirm, der zum Pflegen auffordert.

### D2 · Material entsteht aus dem, was ohnehin durchläuft – nicht aus einem Erfassungsritual

Die drei bestehenden Vision-Strecken erzeugen heute schon Schicht-1-Text und werfen ihn weg:

| Weg                         | was heute passiert                                              | was fehlt                                  |
| --------------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| Hausaufgabe (T-03)          | `homework_task.prompt` trägt den exakten Wortlaut jeder Aufgabe | hängt an der Tutor-Sitzung, nicht am Thema |
| Tutor-Frage mit Foto (T-13) | Vision liest das Bild, das Fach wird erkannt                    | nichts wird abgelegt                       |
| Vokabel-Foto (V-03b)        | Liste wird gespeichert                                          | ist bereits Material, heißt nur nicht so   |

M-01 wird entsprechend umgeschnitten: **aufheben statt erfassen.** Daraus folgt
`material.topic_id` **nullable** – unzugeordnetes Material ist der Normalfall, nicht der
Fehlerfall (dasselbe Muster wie „Vokabeln ohne Set", V-03d).

**Abweichung von §10:** Die Spec nennt „Art (Unterricht/Übung/Lösung/Zusammenfassung) und
Priorität" beim Hinzufügen. Die Art rät das Modell; die **Priorität entfällt ersatzlos** – die
Schicht _ist_ die Priorität, ein zweites Rangfeld daneben kann ihr nur widersprechen.

### D3 · Das Lehrwerk ist ein Zeiger, kein Inhalt

Gespeichert werden Kapitelstruktur, Seitenzahlen, Begriffe und Vokabel-Units – **nie Buchtexte**.
Das ist keine Sparsamkeit, sondern Urheberrecht, und es begrenzt den Umfang dieses Bereichs
dauerhaft. L-01 ist bereits so gebaut; die Regel steht hier, damit niemand sie später
„vervollständigt".

Der Nutzen des Zeigers ist die **Prognose**: Wenn die Klasse bei Kapitel 3.2 steht, weiß die App,
dass 3.3 und 3.4 noch kommen – also auch, was vor dem Unterricht schon vorbereitet werden kann.
Das ist die Grundlage des Einstiegs Vorschau (§4 Nr. 1) und die Antwort auf „womit anfangen,
solange das Material fehlt".

### D4 · Relevanz ist eine eigene Achse neben der Schicht

§10 sagt „Prüfungen nur aus Schicht 1+2" und benutzt damit **Autorität als Stellvertreter für
Relevanz**. Das sind zwei Fragen:

- **Schicht** beantwortet: _Wer hat recht, wenn zwei Quellen sich widersprechen?_ → Heft vor Buch
  vor Pack vor Allgemeinwissen. Bleibt wie in §10.
- **Relevanz** beantwortet: _Was davon kommt in der Arbeit dran?_ → speist sich aus der **Ansage
  der Lehrkraft** (schlägt alles), aus **geübten Hausaufgaben**, aus dem **Kapitelumfang** und
  aus der **Mindestanforderung** des Packs.

Relevanz wird ein Feld am Lernziel (`kommt dran` / `kommt nicht dran` / `unbekannt`) samt Herkunft
der Aussage – **keine fünfte Schicht.** Die Ansage der Lehrkraft steht auf keinem Blatt und ist
die wertvollste Einzelinformation vor einer Arbeit; sie aufzunehmen kostet ein Eingabefeld auf
der Prüfungsseite (P-01).

### D5 · Ein Block je Thema, kein Retrieval über Vektoren

Das Kontextpaket ist **ein zusammengesetzter Prompt-Block je Thema**: Lehrwerkzeiger, Lernziele
und der Volltext des Materials, nach Schicht sortiert, mit hartem Token-Deckel (Richtwert 30 000)
und als Cache-Block markiert (§11: „Prompt Caching für Thema-Kontextpakete"). Bei Überlauf gilt
eine feste Reihenfolge: neuestes zuerst, Art „Unterricht" vor „Übung", passend zum aktiven
Lernziel vor dem Rest.

**Kein RAG, keine Embeddings, keine Vektordatenbank.** Begründung, in dieser Reihenfolge:

1. **Wir haben das Problem nicht, das RAG löst.** Ein Schulthema umfasst 5–30 Dokumente, zusammen
   10 000–40 000 Token. Das Modell fasst 200 000. Der vollständige Kontext passt hinein.
2. **Nachvollziehbarkeit.** Ist eine Erklärung falsch, lässt sich mit einem Block sagen, woran es
   lag – der Block ist genau das, was in der Datenbank steht. Mit einem Retriever ist nicht mehr
   unterscheidbar, ob das Modell schlecht war oder der entscheidende Zettel nicht geholt wurde.
   Bei einem Kind, das einer Erklärung vertraut, ist das der falsche Tausch.
3. **Drei Bauteile weniger**, die stimmen müssen: Chunking, Embedding-Lauf, Index-Pflege bei jeder
   Materialänderung.

**Wann das neu zu bewerten ist:** wenn ein einzelnes Thema über 100 000 Token wächst (in einem
Schuljahr unrealistisch). Für die themenübergreifende Suche der Grundlagen-Diagnose (§9:
„Materialien bleiben für den Tutor durchsuchbar") reicht Postgres-Volltextsuche – die Anfrage
besteht dort aus Fachbegriffen, nicht aus Bedeutung.

### D6 · Den Quellenmarker setzt der Server, und ein Test prüft ihn

Jeder Abschnitt des Blocks trägt eine vom Server erzeugte Kopfzeile:

```
[QUELLE 1 · dein Material · Foto Mathe-Heft, 9. 9. 2026]
[QUELLE 2 · Lehrwerk · Lambacher Schweizer 8, Kap. 3.2, S. 114]
[QUELLE 3 · Kurrikulum · Mindestanforderung Jg. 8]
```

Der Systemprompt erlaubt ausschließlich diese Marker; was in keiner Quelle steht, ist als „das
kennt man außerdem als …" zu kennzeichnen. Damit ist die Quellenangabe **prüfbar**: Ein Test
liest die Antwort, sammelt die `[QUELLE n]`-Verweise und schlägt fehl, wenn `n` nicht im Paket
lag. Gleiche Bauart wie der Sprachwächter (T-02a, ADR 0010 D3): nicht bitten, sondern nachprüfen.

Liegt **keine** Quelle im Paket, bleibt es beim festen Hinweis aus ADR 0010 D5 („Allgemeinwissen —
noch ohne dein Material und dein Lehrwerk"), jetzt abgeleitet aus dem, was tatsächlich im Block
stand, statt aus der Baustufe.

### D7 · Der Wissensgraph läuft über Lernziele, nicht über Dokumente

Ein Graph über Material bringt nichts, was die Schichtordnung (D4/§10) nicht schon leistet. Der
Graph, den das Konzept wirklich braucht, steht in §3 („Fördern": Grundlagen-Diagnose über
Vorläufer-Lernziele, auch aus früheren Schuljahren) – und seine Tabelle existiert bereits:
`objective_prerequisite`. Sie ist nur leer. Befüllt wird sie aus Lehrwerk-Reihenfolge und
Pack-Vorläufern, nicht von Hand.

## Konsequenzen

**Was sich an Tickets ändert** – nachgezogen in `docs/PLAN.md`:

- **M-01** heißt jetzt „aufheben statt erfassen": Hausaufgaben-Aufgabentexte und Tutor-Fotos
  werden Material; Art rät das Modell, Priorität entfällt, `topic_id` nullable.
- **M-02** liefert Lernziel-**Vorschläge** (Stufe B); bestätigt wird auf der Prüfungsseite.
- **P-00** bekommt das Relevanz-Feld am Lernziel mit dazu.
- **P-01** bekommt den Stoffsammler „Was kommt dran?" (✓ bestätigt / ? erwartet / + eintragen)
  und die Aussage zur Materialreife.
- **T-01** setzt D5/D6 um und bringt den Markertest mit.
- **T-05** wird zu „Niveau-Anker je Lernziel" – die Themenliste ist der uninteressante Teil des
  Packs, die Mindestanforderung der wertvolle.

**Was bewusst offen bleibt:**

- ~~Ob Material im Storage liegt (Fotos) oder nur als OCR-Text.~~ Entschieden mit
  [ADR 0019](0019-fotos-aufbewahren.md): Das Bild bleibt, verkleinert, und nur auf den Wegen, auf
  denen es nach der Durchsicht noch etwas bedeutet.
- Der genaue Token-Deckel. 30 000 ist ein Richtwert, der an echten Themen zu messen ist.
- Wie Lernziele über Schuljahre hinweg zusammenfinden (dasselbe Lernziel in Jg. 7 und 8).

## Abgelehnte Alternativen

**RAG mit pgvector.** Die naheliegende Architektur, und die falsche für diese Datenmenge – siehe
D5. Sie kostet drei Bauteile, laufende Embedding-Kosten und die Unterscheidbarkeit von
Modell- und Retrieval-Fehlern, und löst dafür ein Problem, das erst bei der zehnfachen Menge
entsteht.

**Ein Material-Pflegebereich.** „Material verwalten" mit Ordnern, Tags, Art und Priorität. Wäre
sauber und bliebe leer: Eine Vierzehnjährige pflegt kein Archiv. Stattdessen D2 – aufheben, was
ohnehin durchläuft – plus der eine Moment, in dem Nachtragen ihr selbst nützt: die Prüfungsseite.

**Vollständigkeit erzwingen, bevor gelernt wird.** Also: warten, bis das Material eines Themas
komplett ist. Scheitert an der Schule selbst – vollständig ist es erst am Tag der Arbeit. Die
Auflösung liegt im Spacing (P-03): Was früh da ist, bekommt lange Abstände; was spät dazukommt,
kurze. Beides ist am Prüfungstag gleich frisch, und kurze Abstände sind für kurze Restzeiten
ohnehin das Richtige.
