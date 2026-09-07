# ADR 0005: Anmeldung des Kindes zuerst, Eltern bestätigen nachträglich

Status: **akzeptiert** · Datum: 2026-09-07 · Bezug: docs/konzept.md §11, §6 M9
Kehrt einen Teil von [ADR 0002](0002-auth-familienmodell.md) um.

## Kontext

ADR 0002 legt fest: „kein eigener Account-Anlageprozess" für das Kind. Das Elternteil legt
das Profil an und erzeugt einen Einladungslink, den das Kind einlöst. Beim Schneiden von
F-06a fiel auf, dass dieser Ablauf teuer ist, ohne etwas zu leisten.

Der Auslöser war eine Frage aus dem Alltag: Wenn die Tochter die App einer Freundin
zeigt, kann diese sie nicht ausprobieren. Erst müsste ein Elternteil ein Konto anlegen,
ein Profil erstellen und einen Link verschicken – drei Schritte über einen Erwachsenen,
der die App noch nicht kennt.

## Die entscheidende Beobachtung

**Eltern-zuerst prüft die Elternschaft kein bisschen besser als Kind-zuerst.** In beiden
Fällen tippt jemand eine E-Mail-Adresse ein, und nichts hindert ein Kind daran, eine
eigene Zweitadresse zu verwenden. Der einzige Unterschied ist die Reihenfolge. Wir kaufen
Reibung, ohne Sicherheit zu gewinnen.

Nur drei Dinge brauchen überhaupt einen Erwachsenen:

1. **Einwilligung** – unter 16 nicht selbst erteilbar (§11). Betrifft aber die
   Rechtsgrundlage, nicht die Reihenfolge; nachträglich einzuholen ist zulässig. Für den
   privaten Gebrauch ist sie laut §11 ohnehin formal nicht nötig.
2. **Wiederherstellung** – das Kind hat bewusst keine E-Mail. Irgendwo muss eine Adresse
   liegen. Das verlangt aber nur, dass sie _irgendwann_ hinterlegt wird.
3. **Elternansicht** – ein Feature, keine Voraussetzung.

Nur Punkt 2 ist architektonisch zwingend.

## Entscheidung

- **Das Kind meldet sich selbst an.** Passkey anlegen (Face ID), Vorname, Jahrgang,
  Klasse, Elternadresse. Danach sofort nutzbar.
- **Die Einwilligungsmail geht an die Elternadresse und blockiert nichts.** Klickt das
  Elternteil, wird es Kontoinhaber und erhält die Elternansicht.
- **Die Elternadresse ist Pflicht**, weil sie der Wiederherstellungsanker ist – nicht
  wegen der Einwilligung.
- **Kein Einladungslink, keine Profilwahl, keine PIN** in der ersten Fassung.
- **Rollierende Session**, bei jeder Nutzung erneuert; Geräte in der Elternansicht
  abmeldbar (aus ADR 0002 übernommen).

### Wiederanmeldung nach Ablauf

Der Passkey ist die dauerhafte Anmeldung, die Session nur ein Zwischenspeicher. Läuft sie
ab: ein Tipp, Face ID, drin.

Dafür muss der Passkey bei der Registrierung **auffindbar** sein (`residentKey: required`).
Dann trägt das Gerät die Kontozuordnung, und die Anmeldung braucht keine Kennung – kein
Benutzername, keine E-Mail. Das ist die technische Voraussetzung, an der der ganze Entwurf
hängt.

| Fall                            | Weg                                                            |
| ------------------------------- | -------------------------------------------------------------- |
| Gleiches Ökosystem, neues Gerät | Passkey ist über den Schlüsselbund da                          |
| Fremdes Gerät (Schul-Laptop)    | WebAuthn geräteübergreifend per QR – können die Browser selbst |
| Passkey verloren                | Elternadresse                                                  |

## Verworfen

- **Eltern zuerst** (ADR 0002): drei Schritte über einen Erwachsenen, ohne Sicherheitsgewinn.
- **Kind allein, ganz ohne Elternmail**: nähme uns den Wiederherstellungsanker.
- **6-stellige PIN als Rückfall**: bringt auf einem Gerät mit Face ID nichts und schafft
  zwei Probleme – einen schwächeren Zweitzugang und einen „PIN vergessen"-Pfad, der wieder
  bei den Eltern endet. Wird nachgeholt, falls ein echter Fall mit geteiltem Schul-iPad
  auftaucht.
- **Profilwahl beim Anmelden**: folgt nur aus Mehrkindfähigkeit. Geschwisterprofile stuft
  das Konzept selbst als V4 ein (§6 M9, Roadmap). Bei einem Kind ist es ein Bildschirm mit
  genau einer Antwort.

## Konsequenzen

- **F-06a entfällt.** Der Einladungs-Mechanismus – Tabelle, Ablauf, Einmaligkeit, Erzeugen-
  und Einlöse-Oberfläche – wird nicht gebaut. Er wird vom Normalfall zum Sonderfall und
  entsteht erst, wenn ein zweites Kind wirklich existiert.
- **F-06 wird kleiner**, nicht größer: Passkey-Registrierung, Selbstanlage, Einwilligungsmail,
  Session. Unterm Strich weniger Code als der Weg über ADR 0002.
- **Das Datenmodell bleibt unverändert.** `family` ist der Mandantenschlüssel, den jede
  Policy vergleicht – auch bei genau einem Kind. Die Geschwister-Trennung ist gebaut und
  getestet; sie wegzuwerfen wäre Arbeit ohne Gewinn. Was entfällt, ist Ablauf-Komplexität,
  nicht Struktur.
- **Beim Onboarding entsteht die Familie durch das Kind.** Das Elternkonto tritt später
  hinzu. Die bestehende Logik aus F-05 (erster Login legt Familie und Elternkonto an)
  braucht dafür einen zweiten Weg: Elternteil tritt einer bestehenden Familie bei.
- **ADR 0002 bleibt gültig, wo es nicht widersprochen wird**: Familienmodell, RLS-Trennung
  Eltern/Kind, kein Social Login fürs Kind, keine Altersverifikation, keine Passwortregeln.

## Festgelegt beim Beschluss

**Sessionfenster: 30 Tage, rollierend** – bei jeder Nutzung erneuert. Ein längeres Fenster
kauft kaum Bequemlichkeit, weil der Passkey die eigentliche Anmeldung ist und
Wiederkommen einen Tipp kostet; es hält aber eine Sitzung auf einem verlorenen Gerät
länger offen. Bei wöchentlicher Nutzung läuft die Session nie ab.

**Die Einwilligungsmail siezt**, obwohl die App duzt: Sie geht an einen Erwachsenen, der
die App nicht kennt. Sie nennt ungefragt, was Eltern _nicht_ sehen (die Tutor-Gespräche),
weil das sonst die erste Rückfrage ist. Und sie hat einen echten Nein-Weg – Konto löschen
–, sonst ist „Einwilligung" nur ein Wort. Der Wortlaut steht in F-06.
