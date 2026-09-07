-- Anmeldung des Kindes: Passkey und Session (F-06, ADR 0005).
--
-- Zwei Henne-Ei-Probleme, beide nach dem Muster aus 0040-auth.sql gelöst –
-- eine enge Session-Variable und eine Policy, die genau eine Zeile freigibt,
-- statt einer Ausnahme von der withActor()-Regel:
--
--   1. Passkey vorzeigen: Wir kennen die Credential-ID, die der Browser
--      liefert, aber weder Kind noch Familie. Also `tutr.credential_id`.
--   2. Session prüfen: Wir kennen den Hash des Cookie-Tokens, sonst nichts.
--      Also `tutr.session_token_hash`.
--
-- Beide Werte sind unratbar (32 Zufallsbytes bzw. eine WebAuthn-Credential-ID),
-- und beide Policies geben nur SELECT frei. Nach dem Nachschlagen stehen
-- family_id und student_id fest, ab da übernimmt withActor().
--
-- Das dritte Problem ist die Entstehung: Nach ADR 0005 legt das Kind Familie
-- und Profil selbst an, hat dabei aber noch nichts, worauf eine Policy zeigen
-- könnte. Die Lösung steht weiter unten und ist bewusst eng: Das Kind darf
-- genau die Familie und genau das Profil anlegen, auf die sein eigener
-- Actor-Kontext zeigt. Ein zweites Mal kann dieselbe Policy nicht greifen,
-- weil der Primärschlüssel dann schon vergeben ist.
--
-- Idempotent.

grant select, insert, update, delete on student_credential, student_session to tutr_app;

-- --- Helfer ---------------------------------------------------------------

create or replace function app.credential_id() returns text
  language sql stable
  as $$ select nullif(current_setting('tutr.credential_id', true), '') $$;

create or replace function app.session_token_hash() returns text
  language sql stable
  as $$ select nullif(current_setting('tutr.session_token_hash', true), '') $$;

grant execute on function app.credential_id() to tutr_app;
grant execute on function app.session_token_hash() to tutr_app;

-- --- Entstehung: das Kind legt Familie und Profil an -----------------------

-- Nur INSERT, und nur auf die IDs, auf die der eigene Actor-Kontext zeigt.
-- Die IDs erzeugt der Server unmittelbar vorher; von außen wählbar sind sie
-- nicht. Nach der Registrierung läuft dieselbe Policy in den Primärschlüssel,
-- die Familie kann also nicht ein zweites Mal entstehen.
drop policy if exists family_anlegen_kind on family;
create policy family_anlegen_kind on family
  for insert to tutr_app
  with check (id = app.family_id() and app.actor_role() = 'student');

drop policy if exists student_anlegen_kind on student;
create policy student_anlegen_kind on student
  for insert to tutr_app
  with check (
    family_id = app.family_id()
    and id = app.student_id()
    and app.actor_role() = 'student'
  );

-- --- student_credential ---------------------------------------------------
alter table student_credential enable row level security;

-- Der Anmeldeweg: genau eine Zeile, nur lesen.
drop policy if exists student_credential_anmeldung on student_credential;
create policy student_credential_anmeldung on student_credential
  for select to tutr_app
  using (credential_id = app.credential_id());

-- Das Kind verwaltet seine eigenen Passkeys (anlegen beim Registrieren und
-- auf weiteren Geraeten, Zaehler und Zeitstempel beim Anmelden fortschreiben).
drop policy if exists student_credential_kind on student_credential;
create policy student_credential_kind on student_credential
  for all to tutr_app
  using (
    family_id = app.family_id()
    and student_id = app.student_id()
    and app.actor_role() = 'student'
  )
  with check (
    family_id = app.family_id()
    and student_id = app.student_id()
    and app.actor_role() = 'student'
  );

-- Eltern sehen die Geraeteliste und koennen einen verlorenen Passkey
-- entfernen – aber keinen anlegen und keinen veraendern.
drop policy if exists student_credential_eltern_lesen on student_credential;
create policy student_credential_eltern_lesen on student_credential
  for select to tutr_app
  using (family_id = app.family_id() and app.actor_role() = 'parent');

drop policy if exists student_credential_eltern_entfernen on student_credential;
create policy student_credential_eltern_entfernen on student_credential
  for delete to tutr_app
  using (family_id = app.family_id() and app.actor_role() = 'parent');

-- --- student_session ------------------------------------------------------
alter table student_session enable row level security;

-- Der Pruefweg: genau eine Zeile, nur lesen.
drop policy if exists student_session_pruefen on student_session;
create policy student_session_pruefen on student_session
  for select to tutr_app
  using (token_hash = app.session_token_hash());

drop policy if exists student_session_kind on student_session;
create policy student_session_kind on student_session
  for all to tutr_app
  using (
    family_id = app.family_id()
    and student_id = app.student_id()
    and app.actor_role() = 'student'
  )
  with check (
    family_id = app.family_id()
    and student_id = app.student_id()
    and app.actor_role() = 'student'
  );

drop policy if exists student_session_eltern_lesen on student_session;
create policy student_session_eltern_lesen on student_session
  for select to tutr_app
  using (family_id = app.family_id() and app.actor_role() = 'parent');

-- Abmelden setzt revoked_at, statt die Zeile zu loeschen – die Geraeteliste
-- soll zeigen, dass abgemeldet wurde. WITH CHECK ist hier nicht redundant:
-- Ohne ihn koennte dasselbe UPDATE die Zeile in eine fremde Familie schieben
-- (dieselbe Luecke wie in ADR 0004 D7).
drop policy if exists student_session_eltern_abmelden on student_session;
create policy student_session_eltern_abmelden on student_session
  for update to tutr_app
  using (family_id = app.family_id() and app.actor_role() = 'parent')
  with check (family_id = app.family_id() and app.actor_role() = 'parent');
