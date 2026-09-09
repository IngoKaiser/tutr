# Deploy nach mytutr.de (D-01)

Reihenfolge zählt: Schritt 3 (Domain) muss **vor** der ersten Passkey-Anmeldung
stehen, sonst muss das Kind sie später wiederholen. Warum, steht in Schritt 3.

---

## 1 · Vercel-Projekt anlegen

Repository `IngoKaiser/tutr` importieren. Framework wird als Next.js erkannt,
Build-Kommando und Ausgabeverzeichnis bleiben auf den Vorgaben.

Node-Version: **22** — steht in `.nvmrc` und als `engines` in `package.json`,
Vercel liest das von selbst.

## 2 · Umgebungsvariablen setzen

Alle für **Production**, **Preview** und **Development** setzen, sonst
scheitern Vorschau-Deployments an der Zod-Prüfung in `src/lib/env.ts`. Für
den ersten Deploy reicht das mit denselben Werten überall — **Schritt 8**
trennt Preview später auf eine eigene Datenbank.

| Variable                               | Quelle                                            |
| -------------------------------------- | ------------------------------------------------- |
| `DATABASE_URL`                         | wie in `.env.local` – Rolle `tutr_app`, Port 6543 |
| `SUPABASE_SECRET_KEY`                  | wie in `.env.local`                               |
| `NEXT_PUBLIC_SUPABASE_URL`             | wie in `.env.local`                               |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | wie in `.env.local`                               |
| `ANTHROPIC_API_KEY`                    | wie in `.env.local`                               |
| `AUTH_COOKIE_SECRET`                   | wie in `.env.local`                               |
| `RESEND_API_KEY`, `RESEND_FROM`        | optional, siehe Schritt 6                         |

**Secret oder Config?** Vercel fragt beim Anlegen nach dem Typ. `Secret`
lässt sich nach dem Speichern nie wieder anzeigen, `Config` schon:

| Variable                               | Typ    | Warum                                                                         |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| `DATABASE_URL`                         | Secret | enthält das Passwort der Rolle `tutr_app`                                     |
| `SUPABASE_SECRET_KEY`                  | Secret | umgeht RLS – der mächtigste Wert in dieser Liste                              |
| `ANTHROPIC_API_KEY`                    | Secret | kostet Geld, wenn er abhandenkommt                                            |
| `AUTH_COOKIE_SECRET`                   | Secret | signiert die Anmelde-Cookies                                                  |
| `RESEND_API_KEY`                       | Secret | erlaubt Mailversand über die Domain                                           |
| `NEXT_PUBLIC_SUPABASE_URL`             | Config | steckt ohnehin im Browser-Bundle                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Config | öffentlich **by design** (ADR 0003) – RLS ist der Schutz, nicht der Schlüssel |
| `RESEND_FROM`                          | Config | nur eine Absenderadresse                                                      |

Vercel warnt bei den beiden `NEXT_PUBLIC_`-Variablen, dass ihr Wert im
Browser landet. Das ist richtig und beabsichtigt: Next.js ersetzt
`NEXT_PUBLIC_*` zur Bauzeit im Client-Bundle, sie sind per Definition
öffentlich. „Mark as Safe" ist hier die korrekte Antwort. Sie als `Secret`
zu hinterlegen bringt keinen Schutz, kostet aber die Möglichkeit,
nachzusehen, was eingetragen ist.

**Zwei Werte gehören ausdrücklich NICHT nach Vercel:**
`MIGRATION_DATABASE_URL` und `TUTR_APP_DB_PASSWORD`. Das sind die
Zugangsdaten der Rolle `postgres`, die RLS umgeht. Migrationen laufen von
deinem Rechner (`npm run db:migrate`), nie aus der Anwendung heraus – so
liegt der mächtigste Schlüssel nicht auf der Hosting-Plattform.

`DATABASE_URL` muss auf **Port 6543** (Transaction Pooler) und die Rolle
`tutr_app` zeigen. Mit `postgres` statt `tutr_app` griffe RLS nicht, und ein
vergessener `withActor()`-Aufruf sähe alle Mandanten (ADR 0004 D1).

## 3 · Domain — und warum die Reihenfolge zählt

`mytutr.de` als Domain hinzufügen. **`mytutr.de` (ohne `www`) als primäre
Domain setzen, `www.mytutr.de` darauf weiterleiten.**

Das ist keine Geschmacksfrage. `src/lib/auth/passkey.ts` leitet die
WebAuthn-`rpID` aus dem Host-Header ab (bewusst, damit Vorschau-Deployments
funktionieren). Ein Passkey gilt nur für genau die Domain, auf der er angelegt
wurde:

- angelegt auf `www.mytutr.de` → funktioniert **nicht** auf `mytutr.de`
- angelegt auf `tutr-xyz.vercel.app` → funktioniert **nicht** auf `mytutr.de`

Deshalb: erst die Domain steht, dann registriert sich das Kind. Andernfalls
Passkey löschen und neu anlegen — machbar, aber unnötig.

DNS beim Domain-Anbieter nach Vercels Anweisung setzen (A-Record auf die
Vercel-IP oder ALIAS/ANAME auf `cname.vercel-dns.com`), dann warten, bis
Vercel „Valid Configuration" zeigt und das Zertifikat ausgestellt ist.

## 4 · Supabase auf die echte Domain umstellen

Dashboard → Authentication → URL Configuration:

- **Site URL**: `https://mytutr.de`
- **Redirect URLs**: `https://mytutr.de/**` ergänzen

Ohne das zeigen die Anmeldelinks in den Mails weiter auf `localhost:3000` —
die Vorlagen benutzen `{{ .SiteURL }}`. Der Rückweg der App
(`/auth/callback`) wird über `emailRedirectTo` gesetzt und muss in der
Allowlist stehen, sonst weist Supabase ihn ab.

## 5 · Seed-Daten aus der Produktivdatenbank entfernen

Die Datenbank enthält aus der Entwicklung drei erfundene Kinder (Mia, Ben,
Lea) samt Vokabelset. Sie stören nicht — niemand kann sich mit ihnen anmelden,
und sie hängen an `eltern@example.org`, nicht an einer echten Adresse. Aber sie
sind Attrappen in einer echten Datenbank, und wenn das Kind zufällig einen
dieser Vornamen trägt, wird es verwirrend.

Vor der ersten echten Anmeldung entfernen (als Migrationsrolle, lokal):

```sql
-- Mia, Ben, Lea (SEED_IDS.studentOne/siblingOne/studentTwo)
delete from student where id in (
  '00000000-0000-4000-8000-00000000d003',
  '00000000-0000-4000-8000-00000000d004',
  '00000000-0000-4000-8000-00000000e003'
);
-- Die beiden Attrappen-Elternkonten
delete from parent_account where id in (
  '00000000-0000-4000-8000-00000000d002',
  '00000000-0000-4000-8000-00000000e002'
);
-- Das kuratierte Lehrwerk „Découvertes 4" (hängt an keinem Kind)
delete from textbook where id = '00000000-0000-4000-8000-00000000c001';
```

Die IDs stammen aus `src/db/seed-ids.ts` — Vokabeln, Karten, Schuljahre und
Themen hängen per Kaskade an `student` und gehen mit.

**Danach `npm run db:seed` nie wieder gegen die Produktivdatenbank ausführen.**
Es legt die Attrappen erneut an. Für die Test-Datenbank bleibt es richtig.

## 6 · E-Mail: zwei getrennte Wege, ein gemeinsamer Fix

Nicht verwechseln — zwei verschiedene Systeme verschicken zwei verschiedene Mails:

| Mail                     | Verschickt von | Zustand                                                                     |
| ------------------------ | -------------- | --------------------------------------------------------------------------- |
| Eltern-Anmeldelink       | Supabase Auth  | **bricht ab**, sobald der eingebaute Mailversand sein Stundenlimit erreicht |
| Einwilligungsmail (F-06) | Resend         | funktioniert, sobald die Domain verifiziert ist (Schritt oben erledigt)     |

Ohne eigene Konfiguration verschickt Supabase Auth über einen eingebauten
Mailversand mit einem sehr niedrigen Stundenlimit — ausdrücklich nur zum
Ausprobieren gedacht. Reproduzierbar mit:

```bash
curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/otp" \
  -H "Content-Type: application/json" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -d '{"email":"test@example.com","create_user":true}'
```

Antwort im Fehlerfall: `500 { "error_code": "unexpected_failure", "msg": "Error
sending confirmation email" }` — unabhängig von der App, unabhängig von Resend.

**Der Fix ersetzt den eingebauten Mailversand durch Resend**, das ohnehin
schon verifiziert ist. Dashboard → Authentication → Emails → SMTP Settings →
„Enable Custom SMTP":

| Feld         | Wert                      |
| ------------ | ------------------------- |
| Host         | `smtp.resend.com`         |
| Port         | `465` (SSL)               |
| Username     | `resend`                  |
| Password     | der `RESEND_API_KEY`-Wert |
| Sender email | `noreply@mytutr.de`       |
| Sender name  | `tutr`                    |

Danach laufen beide Mails über dieselbe verifizierte Domain, ohne das enge
Test-Limit. Vor F-06f (Wiederherstellung vom Anmeldebildschirm) ohnehin nötig.

### Zum Testen nie `@example.com` verwenden

Resend weist diese Domain ausdrücklich ab – aber erst beim Senden der
Nachricht, nicht schon bei der Empfängerprüfung. Ein Test dagegen sieht
deshalb wie ein kaputtes SMTP-Setup aus:

```
gomail: could not send email 1: 550 "Invalid `to` field.
Please use our testing email address instead of domains like `example.com`."
```

**Richtig ist `delivered@resend.dev`** – Resends offizielle Testadresse: wird
angenommen, zugestellt und erreicht keinen Menschen. Zum Prüfen des ganzen
Wegs (Supabase → Resend → Zustellung):

```bash
curl -X POST "$NEXT_PUBLIC_SUPABASE_URL/auth/v1/otp" \
  -H "Content-Type: application/json" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  -d '{"email":"delivered@resend.dev","create_user":true}'
```

`200 {}` heißt: Der Mailweg steht. Das Ergebnis lässt sich in Resend unter
„Emails" nachsehen.

Diese Zeile hat beim ersten Deploy über eine Stunde Fehlersuche gekostet –
Port, Passwort und Verschlüsselung wurden nacheinander verdächtigt, während
in Wahrheit nur die Testadresse falsch war.

**Wenn das Auth-Log `535 "Authentication credentials invalid"` zeigt**, liegt
es am Passwort, nicht am Port. Nachgemessen gegen `smtp.resend.com`: Mit
gültigem API-Schlüssel antwortet der Server auf **beiden** Ports (465 mit
TLS, 587 mit STARTTLS) mit `235` – Anmeldung angenommen. Genau dasselbe
`535` erscheint reproduzierbar, sobald das Passwort nicht stimmt. Also: den
Schlüssel neu einsetzen, nicht am Port drehen.

Der Benutzername ist wörtlich `resend`, nicht die Absenderadresse.

## 7 · Nach dem Deploy prüfen

```bash
curl -sI https://mytutr.de | grep -i "x-robots-tag\|strict-transport"
curl -s  https://mytutr.de/robots.txt
```

Erwartet: `noindex, nofollow`, HSTS gesetzt, `Disallow: /`.

Dann von Hand:

1. `https://mytutr.de` → leitet auf `/heute`, von dort auf `/anmelden`
   (der Dev-Actor ist in Produktion hart aus)
2. Eltern-Anmeldung mit deiner Adresse → Mail kommt an, Link führt zurück
3. Angemeldet, aber ohne Kind → leerer Zustand, keine Fehlermeldung
4. Auf dem Handy: `/registrieren`, Kind anlegen, **Passkey mit Face ID/Fingerabdruck**
   — das ist der Schritt, der über LAN nicht ging
5. Einwilligungsmail prüfen, bestätigen → Elternkonto sieht das Kind
6. Vokabelset anlegen, **Foto aus dem Vokabelheft** — der bisher ungetestete Fall
7. Üben starten

## 8 · Preview-Deployments: neue Features erst selbst prüfen (optional, aber empfohlen)

Vercel legt für **jeden Branch und jeden Pull Request automatisch ein
eigenes Deployment** mit eigener URL an, ohne Zusatzarbeit — das passt genau
zu unserem Ablauf, weil wir ohnehin immer über Branch + PR arbeiten. `main`
→ Production auf `mytutr.de`; jeder offene PR → ein Preview-Deployment, auf
dem sich ein neues Feature anschauen lässt, bevor es gemergt wird.

**Ohne weitere Änderung zeigen Preview-Deployments auf dieselbe Datenbank
wie Production** — Schritt 2 hat die Variablen für Production _und_ Preview
mit denselben Werten gesetzt. Ein Klick auf einer Preview-URL schreibt dann
in die echten Daten. Genau der Fehler, den F-13 für die lokalen Tests
behoben hat, nur eine Ebene höher.

**Der Fix nutzt, was schon da ist:** das zweite, leere Supabase-Projekt, das
sonst nur `npm run db:test` bedient. Für die Umgebung **Preview** dieselben
vier Variablen auf dieses Projekt umbiegen:

| Variable                               | Quelle                                             |
| -------------------------------------- | -------------------------------------------------- |
| `DATABASE_URL`                         | Wert von `TEST_DATABASE_URL` aus `.env.test.local` |
| `NEXT_PUBLIC_SUPABASE_URL`             | Test-Projekt → Settings → API                      |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Test-Projekt → API Keys                            |
| `SUPABASE_SECRET_KEY`                  | Test-Projekt → API Keys                            |

Die drei Supabase-Werte des Test-Projekts liegen noch nirgends bei uns —
bisher brauchte es dort nur die Datenbank, keine Anmeldung. Einmalig aus dem
Dashboard des zweiten Projekts holen.

`ANTHROPIC_API_KEY`, `AUTH_COOKIE_SECRET`, `RESEND_API_KEY`, `RESEND_FROM`
können in beiden Umgebungen gleich bleiben.

**So geht das in Vercel** (Settings → Environment Variables): Vercel erlaubt
nicht, einer Variable unterschiedliche Werte je Umgebung mitzugeben — es
erlaubt stattdessen **mehrere Einträge mit demselben Namen**, jeder auf eine
eigene Umgebung begrenzt. Für jede der vier Variablen:

1. Den bestehenden Eintrag öffnen, den Haken bei **Preview** entfernen (er
   bleibt nur für **Production** gesetzt)
2. Einen **neuen** Eintrag mit demselben Namen anlegen, nur **Preview**
   angehakt, mit dem Test-Projekt-Wert

**Ein bekannter Nebeneffekt, keine neue Einschränkung:** Preview-Deployments
haben eigene Hosts (`tutr-git-<branch>-<team>.vercel.app`), also eigene
Passkeys — dieselbe Regel wie in Schritt 3. Zum Durchklicken registriert man
dort ein Wegwerf-Kind; die echten Passkeys von `mytutr.de` funktionieren auf
einer Preview-URL nicht, und umgekehrt.

## Was bewusst offen bleibt

- **S-03** (Content-Security-Policy, Rate Limits auf den KI-Endpunkten). Kein
  Hindernis für einen privaten Familienzugang, aber offen — und mit einem
  KI-Endpunkt hinter der Anmeldung der nächste Sicherheitsschritt.
- **F-09** (Offline über Service Worker). Ohne ihn braucht Üben eine Verbindung.
- **F-10** (echte Anmeldung in Playwright). Bis dahin läuft E2E gegen `next dev`.

## Ab jetzt gilt

**Migrationen werden nie mehr gelöscht** (CLAUDE.md). Bis hierher war ein
Reset der Historie zulässig und ist zweimal passiert (ADR 0006 D9). Ab dem
ersten Deploy ist jede Schemaänderung ein Schritt nach vorn.
