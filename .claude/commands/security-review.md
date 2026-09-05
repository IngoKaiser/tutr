---
description: Sicherheitsreview für Auth, RLS, Uploads und KI-Endpunkte
---

Führe ein Sicherheitsreview durch für: $ARGUMENTS (leer = gesamtes Projekt).

Prüfliste:

- Auth: Wird in jeder Server Action und jedem Route Handler der Nutzer geprüft? Kann ein Kind-Profil auf fremde Daten zugreifen? Kann ein Elternteil `tutor_sessions` lesen?
- RLS: Für jede Tabelle in src/db/schema: gibt es eine Policy in src/db/policies? Deckt sie SELECT/INSERT/UPDATE/DELETE ab?
- Uploads: Dateityp und -größe serverseitig geprüft? Storage-Pfade pro Familie isoliert? Signierte URLs mit Ablauf?
- KI-Endpunkte: Rate Limit pro Profil? Nutzereingaben vom Systemprompt getrennt? Structured Output validiert? Keine Weitergabe personenbezogener Daten über das Nötige hinaus?
- Secrets: nur über src/lib/env.ts, nichts in Client-Bundles (`NEXT_PUBLIC_` nur für Öffentliches)?
- Abhängigkeiten: `npm run security` ausführen und Ergebnisse bewerten.

Berichte Findings mit Schweregrad (hoch/mittel/niedrig), Datei:Zeile und konkretem Fix. Keine theoretischen Risiken ohne Bezug zum Code.
