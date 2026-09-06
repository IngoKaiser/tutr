# ADR 0003: Supabase API-Keys (neues Key-System)

Status: akzeptiert · Datum: 2026-09-06 · Bezug: docs/konzept.md §11

## Kontext

Supabase bietet zwei Generationen von API-Keys:

- **Legacy** (`anon` / `service_role`): statische, projektweite JWTs. Rotation nur durch Wechsel des JWT-Secrets, was alle Keys gleichzeitig invalidiert. Von Supabase als „deprecated" markiert.
- **Neu** (`sb_publishable_…` / `sb_secret_…`): benannte Keys, einzeln erzeug-, rotier- und widerrufbar; mehrere Secret-Keys parallel möglich; kein JWT-Ablauf.

Das Projekt ist greenfield, nichts ist deployt, es existiert noch kein Supabase-Client-Code. Der Wechsel kostet hier nur Umbenennungen.

## Entscheidung

- Wir nutzen ausschließlich das **neue Key-System**.
- Env-Variablen:
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (`sb_publishable_…`) – öffentlich, im Client-Bundle, RLS greift.
  - `SUPABASE_SECRET_KEY` (`sb_secret_…`) – nur serverseitig, umgeht RLS. Nie mit `NEXT_PUBLIC_`, nie in Client-Komponenten (in `src/lib/env.ts` im `serverSchema`).
- `DATABASE_URL` bleibt der Postgres-Connection-String (Transaction Pooler) und ist vom Key-System unabhängig – Drizzle/`postgres` gehen direkt über Postgres.
- „Automatically expose new tables" im Supabase-Dashboard ausschalten, „Enable automatic RLS" einschalten (Defense-in-Depth zur CLAUDE.md-Regel „jede Tabelle hat RLS").

## Konsequenzen

- Rotation eines kompromittierten Server-Keys ohne Ausfall der Client-Keys möglich.
- Anleitungen/Beispiele, die noch `anon`/`service_role` heißen, müssen mental gemappt werden.
- Legacy-Keys im Supabase-Dashboard deaktiviert lassen.
