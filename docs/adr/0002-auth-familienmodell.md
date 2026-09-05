# ADR 0002: Authentifizierung als Familienmodell

Status: akzeptiert · Datum: 2026-09-05 · Bezug: docs/konzept.md §11

## Kontext

Kind (14) ohne zuverlässige E-Mail, mehrere Geräte, unter 16 keine eigene Einwilligung nach DSGVO. Erwachsenen-Auth (Passwort, 2FA-App) scheitert im Alltag.

## Entscheidung

- Elternteil = Kontoinhaber: E-Mail + Magic Link, danach Passkey. Bestätigt im Onboarding die Nutzung für das Kind (Zeitstempel gespeichert).
- Kind-Profil wird vom Elternteil angelegt: pseudonym (Vorname, Jahrgang, Klasse). Zugang über signierten Einladungslink/QR (einmalig, 24 h).
- Kind-Login: Passkey auf dem Gerät (Face ID / Fingerabdruck), Fallback 6-stellige PIN; Session 90 Tage; Geräte in der Elternansicht sichtbar und abmeldbar.
- Trennung Eltern/Kind über RLS: Eltern lesen nie `tutor_sessions`.
- Kein Social Login fürs Kind, keine Altersverifikation, keine Passwortregeln.

## Konsequenzen

- Eigene Tabelle `student_sessions` mit gerätegebundenem Token; WebAuthn über @simplewebauthn.
- Wiederherstellung ausschließlich über das Elternkonto.
