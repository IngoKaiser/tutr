-- Fundament für ADR 0004: Laufzeit-Rolle und Actor-Kontext.
-- Läuft als `postgres` über MIGRATION_DATABASE_URL, idempotent.
-- Erwartet die Session-Variable `tutr.bootstrap_password` (setzt der Runner).

-- 1. Laufzeit-Rolle. NOBYPASSRLS ist der Kern der Entscheidung: verbindet die
--    Anwendung als `postgres`, umgeht sie RLS vollständig und ein vergessener
--    withActor()-Aufruf sähe alle Mandanten statt keinen.
do $$
declare
  pw text := current_setting('tutr.bootstrap_password', true);
  rotieren boolean := coalesce(current_setting('tutr.rotate_password', true), 'off') = 'on';
  vorhanden boolean := exists (select 1 from pg_roles where rolname = 'tutr_app');
begin
  if (not vorhanden or rotieren) and (pw is null or pw = '') then
    raise exception 'tutr.bootstrap_password ist leer – TUTR_APP_DB_PASSWORD fehlt in der .env-Datei';
  end if;

  if not vorhanden then
    execute format('create role tutr_app with login nobypassrls password %L', pw);
  elsif rotieren then
    execute format('alter role tutr_app with login nobypassrls password %L', pw);
  else
    -- Attribute sicherstellen, das Passwort aber NICHT neu setzen: nach einem
    -- `alter role ... password` weist der Pooler die nächste Anmeldung
    -- gelegentlich mit 28P01 ab, obwohl das Passwort stimmt. Da dieses Skript
    -- vor jedem Testlauf läuft, wäre das eine dauerhafte Flakiness-Quelle.
    -- Zum Rotieren: `npm run db:migrate -- --rotate-password`.
    alter role tutr_app with login nobypassrls;
  end if;
end
$$;

-- 2. Helper-Schema. Die Funktionen lesen den Request-Kontext, den withActor()
--    per SET LOCAL setzt. `true` als zweites Argument = kein Fehler, wenn ungesetzt,
--    sondern NULL – das ist die Fail-closed-Eigenschaft: jede Policy wird falsch.
create schema if not exists app;

-- Altlast aus dem Familienmodell (vor ADR 0006). Steht hier, damit eine
-- bestehende Datenbank nicht eine Funktion behält, die keine Policy mehr
-- aufruft – ein stiller Rest, den beim nächsten Lesen niemand einordnen kann.
drop function if exists app.family_id();

-- Der Mandantenschlüssel. Seit ADR 0006 vergleichen **beide** Rollen genau
-- diese Spalte; die Rolle entscheidet nur noch über lesen oder schreiben.
create or replace function app.student_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('tutr.student_id', true), '')::uuid $$;

create or replace function app.actor_role() returns text
  language sql stable
  as $$ select nullif(current_setting('tutr.actor_role', true), '') $$;

-- Nur im Eltern-Kontext gesetzt. Wird gebraucht, wo das Elternkonto selbst
-- Gegenstand ist (eigene Zeile, eigene Verknüpfungen).
create or replace function app.parent_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('tutr.parent_id', true), '')::uuid $$;

-- Die Anmeldeschleusen (ADR 0006 D3, um eine vierte ergänzt in F-06d). Jede
-- gibt über eine eigene Policy genau eine Zeile per select frei und sonst
-- nichts.
create or replace function app.auth_user_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('tutr.auth_user_id', true), '')::uuid $$;

create or replace function app.credential_id() returns text
  language sql stable
  as $$ select nullif(current_setting('tutr.credential_id', true), '') $$;

create or replace function app.session_token_hash() returns text
  language sql stable
  as $$ select nullif(current_setting('tutr.session_token_hash', true), '') $$;

-- Wiederherstellung (F-06d): der Token aus dem Link, den ein Elternteil für
-- ein Kind erzeugt hat. Wie die anderen drei nur zum *Finden* der Zeile –
-- verbraucht wird er ausschließlich über app.redeem_recovery_token() weiter
-- unten, nie über einen direkten UPDATE-Pfad.
create or replace function app.recovery_token_hash() returns text
  language sql stable
  as $$ select nullif(current_setting('tutr.recovery_token_hash', true), '') $$;

-- Die Beziehung parent_student aufzulösen, ohne dabei erneut durch RLS zu
-- gehen. Ohne diese beiden Funktionen entsteht eine gegenseitige Rekursion:
-- Die Policy auf parent_account läse parent_student, deren Policy läse
-- parent_account, und Postgres bricht mit „infinite recursion detected in
-- policy" ab. Beide sind auf genau eine Frage beschränkt und geben nur IDs
-- zurück, keine Inhalte.
create or replace function app.parents_of(p_student uuid) returns setof uuid
  language sql stable security definer
  set search_path = public, pg_temp
  as $$ select parent_account_id from parent_student where student_id = p_student $$;

create or replace function app.account_of_auth_user(p_auth uuid) returns uuid
  language sql stable security definer
  set search_path = public, pg_temp
  as $$ select id from parent_account where auth_user_id = p_auth $$;

-- Darf dieses Elternkonto sich mit diesem Kind verknüpfen?
--
-- `security definer`, weil die Prüfung `student` und `parent_account` lesen
-- muss und RLS innerhalb einer Policy-Bedingung sonst genau das verhindert –
-- die Bedingung wäre immer falsch. Die Funktion gehört der Migrationsrolle
-- und ist auf diese eine Frage beschränkt.
--
-- Damit steht die Regel in der Datenbank statt im Anwendungscode: Verknüpfen
-- darf sich nur, wessen **bestätigte** Adresse das Kind selbst hinterlegt hat.
create or replace function app.parent_may_link(p_student uuid, p_parent uuid) returns boolean
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select exists (
      select 1
      from student s
      join parent_account pa on pa.id = p_parent
      where s.id = p_student
        and s.parent_email is not null
        and lower(s.parent_email) = lower(pa.email)
    )
  $$;

-- Kandidaten für den Elternbeitritt (F-06b, ADR 0006 D8).
--
-- Meldet sich ein Elternteil zum ersten Mal an, existiert noch kein
-- `parent_account` – und ohne den liefert RLS auf `student` nichts, also
-- lässt sich nicht herausfinden, welche Kinder die bestätigte Adresse
-- eingetragen haben. Dieselbe Klasse Henne-Ei-Problem wie bei den
-- Anmeldeschleusen, hier aber zum *Finden* von Kandidaten statt zum
-- Bestätigen einer bekannten Verknüpfung.
--
-- Bewusst eng: nur die drei Spalten, die die Beitritts-Oberfläche braucht,
-- keine sensiblen Daten. Vertrauensgrenze ist der Aufrufer – die Anwendung
-- ruft diese Funktion ausschließlich mit der von Supabase serverseitig
-- bestätigten E-Mail auf (`supabase.auth.getUser()`), nie mit einer vom
-- Client gelieferten. Kein Fremdschlüssel auf `auth.users`, aus demselben
-- Grund wie bei `parent_account.auth_user_id`: Migrationen und Tests sollen
-- ohne Supabase-Auth-Fixtures auskommen.
create or replace function app.students_by_parent_email(p_email text)
  returns table (id uuid, first_name text, grade_level int)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select s.id, s.first_name, s.grade_level
    from student s
    where s.parent_email is not null
      and lower(s.parent_email) = lower(p_email)
    order by s.first_name
  $$;

-- Löst einen Wiederherstellungstoken ein (F-06d).
--
-- `security definer`, weil das Kind an dieser Stelle noch gar keinen
-- Actor-Kontext hat – der entsteht ja erst durch das Ergebnis dieser
-- Funktion. Eine gewöhnliche UPDATE-Policy für die Rolle „student" wäre die
-- falsche Alternative: RLS schränkt nicht spaltenweise ein, eine solche
-- Policy gäbe dem Kind nebenbei die Fähigkeit, sein ganzes Profil zu
-- ändern – eine Entscheidung, die erst F-06c trifft, nicht diese Funktion.
--
-- Prüfen und Löschen des Tokens passieren in einem einzigen UPDATE, nicht
-- als SELECT gefolgt von einem UPDATE: Sonst könnten zwei gleichzeitige
-- Einlöseversuche mit demselben Token beide den SELECT-Teil bestehen, bevor
-- einer von ihnen löscht. So gewinnt höchstens der erste – RETURNING liefert
-- beim zweiten Versuch keine Zeile mehr, weil der Hash dann schon NULL ist.
create or replace function app.redeem_recovery_token(p_token_hash text) returns uuid
  language sql security definer
  set search_path = public, pg_temp
  as $$
    update student
    set recovery_token_hash = null, recovery_expires_at = null
    where recovery_token_hash = p_token_hash
      and recovery_expires_at > now()
    returning id
  $$;

-- Welche Kinder aktuell mit einem Elternkonto verknüpft sind (F-06e, ADR
-- 0006 D6): Die Mail an die Eltern beim Selbstlöschen eines Kindes muss
-- sagen, ob noch weitere Kinder verknüpft sind – aber Geschwister sehen
-- einander nicht (`parent_student_read_by_student` zeigt nur die eigene
-- Verknüpfung), also kann das löschende Kind selbst diese Frage nicht
-- beantworten. `security definer`, aus demselben Grund wie bei den Funktionen
-- oben.
--
-- Aufgerufen in derselben Transaktion wie das `delete from student` (siehe
-- `deleteSelfAsStudent()`): Danach sieht diese Funktion die Kaskade bereits
-- ohne das gelöschte Kind, ganz ohne es hier manuell auszuschließen.
create or replace function app.linked_students(p_parent uuid) returns table (first_name text)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select s.first_name
    from student s
    join parent_student ps on ps.student_id = s.id
    where ps.parent_account_id = p_parent
    order by s.first_name
  $$;

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
