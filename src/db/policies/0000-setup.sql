-- Fundament für ADR 0004: Laufzeit-Rolle und Actor-Kontext.
-- Läuft als `postgres` über MIGRATION_DATABASE_URL, idempotent.
-- Erwartet die Session-Variable `tutr.bootstrap_password` (setzt der Runner).

-- 1. Laufzeit-Rolle. NOBYPASSRLS ist der Kern der Entscheidung: verbindet die
--    Anwendung als `postgres`, umgeht sie RLS vollständig und ein vergessener
--    withActor()-Aufruf sähe alle Familien statt keiner.
do $$
declare
  pw text := current_setting('tutr.bootstrap_password', true);
begin
  if pw is null or pw = '' then
    raise exception 'tutr.bootstrap_password ist leer – TUTR_APP_DB_PASSWORD fehlt in der .env-Datei';
  end if;

  if exists (select 1 from pg_roles where rolname = 'tutr_app') then
    execute format('alter role tutr_app with login nobypassrls password %L', pw);
  else
    execute format('create role tutr_app with login nobypassrls password %L', pw);
  end if;
end
$$;

-- 2. Helper-Schema. Die Funktionen lesen den Request-Kontext, den withActor()
--    per SET LOCAL setzt. `true` als zweites Argument = kein Fehler, wenn ungesetzt,
--    sondern NULL – das ist die Fail-closed-Eigenschaft: jede Policy wird falsch.
create schema if not exists app;

create or replace function app.family_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('tutr.family_id', true), '')::uuid $$;

create or replace function app.student_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('tutr.student_id', true), '')::uuid $$;

create or replace function app.actor_role() returns text
  language sql stable
  as $$ select nullif(current_setting('tutr.actor_role', true), '') $$;

-- 3. Rechte. Tabellen gehören weiterhin dem Migrations-Nutzer; tutr_app darf
--    Daten lesen und schreiben, aber nichts anlegen oder ändern.
do $$
declare
  owner_role text := current_user;
begin
  execute 'grant usage on schema public to tutr_app';
  execute 'grant usage on schema app to tutr_app';
  execute 'grant execute on all functions in schema app to tutr_app';
  execute 'grant select, insert, update, delete on all tables in schema public to tutr_app';
  execute 'grant usage, select on all sequences in schema public to tutr_app';

  -- Damit künftige Tabellen aus db:generate nicht jedes Mal nachgezogen werden müssen.
  execute format(
    'alter default privileges for role %I in schema public grant select, insert, update, delete on tables to tutr_app',
    owner_role);
  execute format(
    'alter default privileges for role %I in schema public grant usage, select on sequences to tutr_app',
    owner_role);
  execute format(
    'alter default privileges for role %I in schema app grant execute on functions to tutr_app',
    owner_role);
end
$$;
