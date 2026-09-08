# ADR 0006: Das Kind ist der Mandant, das Elternkonto die Identität

Status: **akzeptiert** · Datum: 2026-09-07 · Bezug: docs/konzept.md §8, §11
Ersetzt das Familienmodell aus [ADR 0002](0002-auth-familienmodell.md) und ändert D1–D4 in
[ADR 0004](0004-datenmodell-rls.md). Baut auf [ADR 0005](0005-anmeldung-kind-zuerst.md) auf.

## Kontext

Beim Schneiden von F-06b — „Elternteil tritt einer bestehenden Familie bei" — kam eine
Frage auf, die das Modell nicht beantworten konnte: Was passiert, wenn zwei Kinder
dieselbe Elternadresse eintragen?

Sie landen in zwei Familien. `parent_user.auth_user_id` ist aber eindeutig, ein
Elternkonto kann also strukturell nur in einer Familie sein. Der Ausweg wäre gewesen, ein
Kind nachträglich in die andere Familie umzuhängen — und weil nach ADR 0004 D2 **jede**
Tabelle `family_id` mit zusammengesetzten Fremdschlüsseln trägt, ist das keine Zeile,
sondern eine Migration quer durch alle Tabellen, die mit jedem Lerndatensatz teurer wird.

Der Aufwand war das Symptom, nicht das Problem. Das Problem war die Modellierung.

## Die entscheidende Beobachtung

**`family` leistet für die Trennung der Kinder nichts.** Jede Kind-Policy filtert ohnehin
zusätzlich auf `student_id = app.student_id()`; Geschwister sehen einander nicht wegen der
Familie, sondern wegen des Kindes. Gemessen am 7.9.2026: **8 der 14 Tabellen tragen
`student_id` bereits neben `family_id`.** Der Familienschlüssel ist dort Redundanz.

`family` beantwortet in Wahrheit genau eine Frage: _Welche Kinder darf dieses Elternteil
sehen?_ Das ist eine **Beziehung**, kein Container. Als Container modelliert erzeugt sie
den Fall „Kind im falschen Container", den es als Beziehung nicht gibt.

Entschieden hat die Sache das Abo: Ein Abo kann nicht an der Familie hängen, wenn ein
Elternteil in mehreren Familien sein kann. Es muss an der Anmelde-Identität hängen. Und
sobald es das tut, hat `family` keine Aufgabe mehr.

## Entscheidung

### D1 · Drei Entitäten statt vier

```
parent_account  ──  parent_student  ──  student  ──┬── student_credential
(auth_user_id,       (consent_at)       (Mandant)  ├── student_session
 email, später Abo)                                └── school_year, subject, topic, …
```

- **`student` ist der Mandant.** Jede Policy vergleicht `student_id`. Alles hängt per
  `on delete cascade` daran.
- **`parent_account` ist die Identität.** Eine Zeile je Anmelde-Identität, `auth_user_id`
  eindeutig. Hier hängt später das Abo: ein Konto, N Kinder, eine Zahlung.
- **`parent_student` ist die Beziehung**, mit `consent_at` **je Kind**. Das ist auch
  inhaltlich richtiger als vorher: Eingewilligt wird in die Nutzung durch _ein_ Kind.

`family`, `parent_user` und `family_id` entfallen ersatzlos. Damit entfällt auch der Fall
„zwei Kinder, eine Elternadresse" — es sind zwei Beziehungen, mehr nicht.

### D2 · Beide Rollen vergleichen dieselbe Spalte

Bisher unterschieden sich die Policies der Rollen darin, _welche_ Spalte sie prüfen.
Künftig prüfen beide `student_id`, und die Rolle entscheidet nur noch über lesen oder
schreiben:

```sql
using (student_id = app.student_id() and app.actor_role() = 'parent')
using (student_id = app.student_id() and app.actor_role() = 'student')
```

Der Actor trägt deshalb **immer** eine `studentId`, auch als Elternteil — eine
Elternansicht zeigt ohnehin ein Kind zur Zeit. Die Frage „darf dieses Elternteil für
dieses Kind handeln?" wird **einmal** beim Bau des Actors über `parent_student`
beantwortet, genau wie bisher über `parent_user`.

### D3 · Vier Anmeldeschleusen, ausdrücklich einzeln

Jeder Weg, der ohne Actor-Kontext auskommen muss, bekommt eine eigene Session-Variable
und eine Policy, die genau eine Zeile per `select` freigibt:

| Weg               | Variable                   | Tabelle              |
| ----------------- | -------------------------- | -------------------- |
| Eltern-Login      | `tutr.auth_user_id`        | `parent_account`     |
| Passkey vorzeigen | `tutr.credential_id`       | `student_credential` |
| Session prüfen    | `tutr.session_token_hash`  | `student_session`    |
| Wiederherstellung | `tutr.recovery_token_hash` | `student`            |

Das ist _ein_ Konzept mit vier Schlüsseln. Sie bleiben ausdrücklich vier kurze Policies
statt einer verallgemeinerten: Vier kurze liest man, eine clevere nicht.

### D4 · Wiederherstellung über die Elternadresse

Zwei Spalten an `student` — `recovery_token_hash`, `recovery_expires_at`. Ein neuer Link
überschreibt den alten, Einlösen löscht ihn; damit ist er einmalig, ohne eigene Tabelle.
Eingelöst wird er, indem das Kind auf dem neuen Gerät einen **weiteren** Passkey anlegt;
alte Geräte entfernt das Elternteil in der Geräteliste.

Zwei Auslöser:

1. Das angemeldete Elternteil erzeugt in der Kindliste einen Link je Kind.
2. **Vom Anmeldebildschirm aus, ohne jedes Elternkonto:** Adresse eintippen, und es geht
   eine Mail mit je einem beschrifteten Link pro Kind, das diese Adresse hinterlegt hat.

Das bringt den Einmal-Token zurück, den ADR 0005 abgeschafft hat — aber als den Sonderfall,
den ADR 0005 selbst vorgesehen hatte („Passkey verloren → Elternadresse"), nicht als
Normalweg. Der Unterschied ist der Punkt: Onboarding ohne Token, Wiederherstellung mit.

### D5 · Löschen: zwei Absichten, zwei Knöpfe

Hinter „Elternkonto löschen" stecken zwei verschiedene Wünsche — _„ich will kein
Elternkonto"_ und _„alles soll weg"_. Zusammengelegt zerstört der erste versehentlich die
Lernhistorie eines Kindes.

| Aktion              | Wirkung                                                                             |
| ------------------- | ----------------------------------------------------------------------------------- |
| Elternkonto löschen | `parent_account` und alle Verknüpfungen. **Die Kinder bleiben** und arbeiten weiter |
| Kinderkonto löschen | Dieses Kind samt Kaskade. Andere Kinder unberührt. Aus der Kindliste, je Kind       |
| Kind löscht selbst  | Dieselbe Zeile, dieselbe Kaskade, andere Seite                                      |

Dass Kinder das Löschen des Elternkontos überleben, ist kein Zugeständnis, sondern ADR
0005: Ein Kind funktioniert ohne Elternkonto.

**Hart gelöscht**, bestätigt durch Eintippen des Vornamens. Kein Soft-Delete: Es hieße
`and deleted_at is null` in jeder Policy und verwässerte genau die Einfachheit, die D2
gewinnt. Das Risiko ist benannt und angenommen.

### D6 · Benachrichtigung, und was daraus folgt

Löscht ein Kind sein Konto, geht eine Mail an jedes verknüpfte Elternteil. Ihr Text
richtet sich nach einer Zählung **beim Versand**:

- Sind noch Kinder verknüpft: nennen, welche. Kein Löschangebot — das würde sie verwaisen.
- Sind keine mehr: darauf hinweisen, dass das Elternkonto ungenutzt ist.

Damit gibt es keinen Zustand, in dem ein Elternteil nicht weiß, ob noch Kinder da sind.

Die Gegenrichtung braucht keine Mail: Ein Kind hat per Konstruktion keine Adresse (§11).
Es sieht in der App, dass niemand verknüpft ist.

**Der Knopf in der Mail führt auf die App, nicht auf einen Lösch-Endpunkt.** Ein Link, der
beim Öffnen löscht, wäre ein zerstörerisches GET — und in F-05 haben wir gelernt, dass
Mailprogramme Links vorab öffnen. Genau dieser Prefetch hätte hier ein Konto gelöscht,
bevor jemand die Mail gelesen hat.

### D7 · Kein Zählerfeld

Was sich zählen lässt, wird nicht gespeichert. Ein `children_count` an `parent_account`
wäre eine zweite Wahrheit neben `parent_student` und liefe irgendwann auseinander. Die
Zahl ist ein `count(*)` — für die Mail aus D6, für die Kindliste, später fürs Abo.

### D8 · Zugang gehört dem Kind, das Abo finanziert ihn nur

Ein Kind kann nach ADR 0005 ohne Elternkonto arbeiten. Hinge der Abo-Zustand nur am
Elternkonto, wäre ein unverknüpftes Kind undefiniert. Also: **Das Abo ist die
Finanzierung, der Zugang die Eigenschaft des Kindes.** Heute hat jedes Kind Zugang, weil
alles frei ist; später kann derselbe Zugang aus einem zahlenden Elternteil, einer
Probezeit oder einem Schulcode kommen.

Vorbereitet werden muss dafür **nichts**. Ein späterer Bezahlvorgang stellt drei Fragen,
und das Modell beantwortet alle drei:

| Frage                           | Antwort                                   |
| ------------------------------- | ----------------------------------------- |
| Seit wann gibt es dieses Kind?  | `student.created_at`                      |
| Hat ein Elternteil freigegeben? | `parent_student.consent_at`               |
| Wer zahlt, für wie viele?       | `parent_student` nach `parent_account_id` |

Dass `student.created_at` existiert, macht eine Probezeit auch **rückwirkend** berechenbar
— erfahrungsgemäß das Einzige in dieser Ecke, was sich nachträglich nicht rekonstruieren
lässt.

Ebenfalls schon richtig: **Die Verknüpfung entsteht durch die Handlung des Elternteils.**
Das Kind nennt nur eine Adresse; verknüpft wird erst, wer sich über einen Magic Link an
dieser Adresse ausweist. Eine spätere „Freigabe durch die Eltern" müsste also nichts
hinzufügen, sondern nur eine Konsequenz daran hängen.

### D9 · Migrationshistorie einmalig zurücksetzen

Die drei bestehenden Migrationen werden gelöscht und durch eine einzige `0000` ersetzt,
beide Datenbanken frisch aufgebaut.

Zulässig, weil nachgemessen: Am 7.9.2026 stehen in der Produktiv-Datenbank
ausschließlich Seed-Daten — 2 Seed-Familien, 3 Seed-Kinder, **0** Passkeys, **0**
Sessions. Es existiert kein Deploy (D-01 offen). Die Alternative wäre eine Migration, die
alles wegdropt; das Schema wäre gleich sauber, die Historie trüge `family` und `family_id`
aber für immer mit.

`CLAUDE.md` verbietet das Löschen von Migrationen. Die Regel wird **geschärft statt
gebrochen**: _Ab dem ersten Deploy (D-01) werden Migrationen nie gelöscht._ Davor ist ein
Reset erlaubt und hier datiert festgehalten. Dies ist der zweite und letzte.

### D10 · Bezeichner durchgängig englisch

ADR 0004 D8 hält fest: „UI-Texte deutsch, Identifier englisch." Die Regel stand im
Daten-ADR und wurde nie nach `CLAUDE.md` übertragen; die Anwendungsschicht ist deshalb
deutsch gewachsen — gemessen 139 Deklarationen in 40 von 70 Dateien, darunter echtes
Denglisch wie `actorFuerAuthUser`.

Weil Schema, Policies und Tests hier ohnehin neu geschrieben werden, wird dort gleich
bereinigt; der Rest folgt als eigenes Ticket. Deutsch bleiben: UI-Texte,
Fehlermeldungen, **Kommentare und Dokumentation**, Enum-_Werte_ (`erhoeht`, `regel`) und
die Routen — `/anmelden`, `/registrieren`, `/pruefungen` sind URLs, die die Nutzerin
sieht. Die Regel wandert nach `CLAUDE.md`, denn dass sie dort fehlte, ist die Ursache.

## Verworfen

- **Nur das Unique-Constraint auf `parent_user.auth_user_id` tauschen**, damit ein
  Elternteil mehreren Familien angehört. Löst den sichtbaren Fall, lässt `family` aber als
  Indirektion ohne Aufgabe stehen — und das Abo hinge weiter am falschen Ende.
- **Ein Kind nachträglich umhängen** (Familien zusammenführen): Migration quer durch alle
  Tabellen, wird mit jedem Datensatz teurer.
- **Beim Registrieren gleich der Familie mit dieser Elternadresse beitreten**: Die Adresse
  ist zu dem Zeitpunkt unbestätigt — jeder könnte sich mit einer bekannten Adresse in eine
  fremde Familie schreiben.
- **`subscription`-Tabelle, Zugangsspalte oder eine `hasAccess()`, die immer `true`
  liefert**: hätte heute null echte Aufrufer, weil nichts abgeriegelt ist. Toter Code, der
  Vorbereitung nur behauptet.
- **Verknüpfungen weich löschen**, um Abrechnungsverlauf zu behalten: Was berechnet wurde,
  weiß der Zahlungsanbieter. Wir müssen nur „wie viele jetzt" beantworten.

## Konsequenzen

- **`konzept.md` §8 und die Kernkette in `CLAUDE.md` nennen `Family`.** Die Spec bleibt
  unangetastet — dieser ADR ist die dokumentierte Abweichung. `CLAUDE.md` wird nachgezogen:
  Kernkette künftig `Student → SchoolYear → Subject → Topic → LearningObjective`, Eltern
  über `parent_student`.
- **Geschwister an derselben Schule teilen kein Lehrwerk mehr.** Jedes Kind bekommt eine
  eigene Zeile; die kuratierte Schicht deckt den Normalfall. Angenommener Preis.
- **ADR 0002 ist damit weitgehend überholt.** Gültig bleiben: kein Social Login fürs Kind,
  keine Altersverifikation, keine Passwortregeln, pseudonyme Kind-Profile, Eltern sehen nie
  `tutor_session`.
- **ADR 0004 bleibt in D5–D9 gültig.** D1 (Actor-Kontext) gilt weiter, nur mit
  `student_id` statt `family_id`; D2 (Mandantenspalte) und D3 (Fachbindung über
  zusammengesetzte Fremdschlüssel) werden auf `student_id` umgestellt; die Matrix in D4
  wird neu geschrieben.
- **Der Zuschnitt:** F-11 Modell-Neuschnitt · F-12 Sprachbereinigung · F-06b Elternbeitritt,
  Kindliste, Geräteliste · F-06d Wiederherstellung · F-06e Löschen. (Die Fundament-Reihe wird
  fortgesetzt; `M-01`/`M-02` sind in Meilenstein 2 bereits für Material vergeben.)

## Nachtrag beim Bauen von F-06d (8.9.2026)

D4 nennt zwei Auslöser für einen Wiederherstellungslink: das angemeldete Elternteil in der
Kindliste, und der Anmeldebildschirm ohne jedes Elternkonto (Adresse eintippen, eine Mail
mit einem Link je passendem Kind). Gebaut wurde nur der erste.

Der zweite braucht eine verifizierte Resend-Domain — ohne die erreicht die Mail nur die
Adresse des eigenen Resend-Kontos, dieselbe Einschränkung wie bei der Einwilligungsmail aus
F-06. Er wäre außerdem heute nicht sinnvoll zu prüfen: keine echte Zustellung, kein
End-to-End-Test möglich. Dazu kämen eine neue, kontextfreie Schreibfunktion und ein
Ratenbegrenzungs-Mechanismus, den es im Projekt noch nirgends gibt — eine E-Mail-Adresse
einzutippen löst sonst unbegrenzt Versand an eine beliebige hinterlegte Adresse aus.

Verschoben auf **F-06f**, bis eine Domain bei Resend hinterlegt ist. Bis dahin bleibt der
Elternteil-Weg der einzige: Für die tatsächliche Nutzung (ein Elternteil mit Konto, im
selben Haushalt) deckt er den relevanten Fall ab; der zweite Weg ist für den Fall gedacht,
den es hier noch nicht gibt — ein Elternteil, das sich nie angemeldet hat.

Der Link selbst ist kein `<a>`, sondern anklickbarer, markierbarer Text neben einem
Kopier-Knopf: Ein `<a>` hätte das Elternteil selbst auf die Einrichtungsseite des Kindes
geschickt. `navigator.clipboard` braucht einen sicheren Kontext (https/localhost); schlägt
das Kopieren fehl, wird der Text stattdessen markiert (⌘C/Strg+C) statt einen Haken zu
zeigen, der dann lügen würde. Kein QR-Code: Die Praxis-Fälle (AirDrop, WhatsApp, vorlesen)
deckt ein Kopier-Knopf ab, ohne neue Abhängigkeit — QR bliebe nachrüstbar, sollte sich
"neues Gerät, gleicher Raum, kein Messenger" als der häufigere Fall erweisen.

## Nachtrag beim Bauen von F-06e (8.9.2026)

D5 nennt drei Löschwege, ohne sie in der Datenbank zu unterscheiden: `student_delete` ist
eine einzige Policy für beide Rollen, denn „darf die Zeile löschen, auf die der eigene
Actor-Kontext zeigt" ist für ein Elternteil und ein Kind derselbe Satz. Was die Wege
unterscheidet, sitzt ausschließlich in der Anwendung – zwei Entscheidungen, die beim Bauen
gefallen sind und hier nachgetragen werden:

**„Elternkonto löschen" ist faktisch umkehrbar, nicht die dritte harte Löschung.** Der
Beitritt (D8) ist bedingungslos: `join()` prüft nur `students_by_parent_email()`, kein Feld
hält fest, dass eine Adresse einmal verknüpft _und wieder gelöst_ wurde. Ohne diese Erinnerung
entstünde beim nächsten Login mit derselben Adresse automatisch ein neues Konto, solange ein
Kind sie weiter einträgt – das Löschen hielte nur bis zum nächsten Seitenaufruf. Statt dagegen
ein Sperrfeld einzuführen (das D7, „keine Zählerfelder", widerspräche), heißt „Elternkonto
löschen" ehrlich _Konto löschen und abmelden_: keine Eintipp-Bestätigung wie bei den beiden
anderen Wegen, weil nichts unwiderruflich verloren geht – die Kinder bleiben unberührt, und
das Konto entsteht bei Bedarf über denselben Beitritt neu.

**Ein Kind, dessen Elternteil das Konto löscht, wird nicht benachrichtigt – bewusst, nicht
versehentlich.** Kind-Profile sind pseudonym (keine E-Mail, keine Schul-ID), es gibt keinen
Kanal zu ihm außer dem eigenen Gerät. Eine Nachricht dort hinterlegen hieße, eine Zeile über
eine gelöschte Person aufzubewahren – das wäre kein hartes Löschen mehr. Sein Gerät bietet
nach der Kaskade weiter den Passkey an; der Server antwortet „Dieser Passkey gehört zu keinem
Profil. Leg dir eines an." (`passkey-actions.ts`) – korrekt, aber ohne den Grund zu nennen.
Der Bestätigungsdialog beim Elternteil sagt stattdessen ausdrücklich, dass keine
Benachrichtigung erfolgt: Das Sagen bleibt zwischen Elternteil und Kind, nicht bei tutr.

Die Benachrichtigungsmail (D6) gilt deshalb nur für den Weg, den D6 auch nennt – „löscht ein
Kind sein Konto" –, nicht für den umgekehrten Fall.
