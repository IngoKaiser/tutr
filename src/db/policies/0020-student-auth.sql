-- Passkey und Gerätesitzung des Kindes (F-06, ADR 0005/0006).
--
-- Zwei der drei Anmeldeschleusen aus ADR 0006 D3 stehen hier. Beide geben
-- über eine unratbare Kennung genau eine Zeile per `select` frei und sonst
-- nichts – die Alternative wäre eine Ausnahme von der withActor()-Regel
-- gewesen. Idempotent.

grant select, insert, update, delete on student_credential, student_session to tutr_app;

-- --- student_credential ---------------------------------------------------
alter table student_credential enable row level security;

-- Anmeldeschleuse: Der Browser liefert die Credential-ID, Kind und Actor sind
-- noch unbekannt.
drop policy if exists student_credential_login on student_credential;
create policy student_credential_login on student_credential
  for select to tutr_app
  using (credential_id = app.credential_id());

-- Das Kind verwaltet seine eigenen Passkeys: anlegen bei der Registrierung
-- und auf weiteren Geräten, Zähler und Zeitstempel beim Anmelden.
drop policy if exists student_credential_own on student_credential;
create policy student_credential_own on student_credential
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

-- Eltern sehen die Geräteliste und entfernen einen verlorenen Passkey – aber
-- legen keinen an und ändern keinen.
drop policy if exists student_credential_read_parent on student_credential;
create policy student_credential_read_parent on student_credential
  for select to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent');

drop policy if exists student_credential_remove_parent on student_credential;
create policy student_credential_remove_parent on student_credential
  for delete to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent');

-- --- student_session ------------------------------------------------------
alter table student_session enable row level security;

-- Anmeldeschleuse: Aus dem Cookie kommt der SHA-256 des Tokens, sonst nichts.
drop policy if exists student_session_check on student_session;
create policy student_session_check on student_session
  for select to tutr_app
  using (token_hash = app.session_token_hash());

drop policy if exists student_session_own on student_session;
create policy student_session_own on student_session
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

drop policy if exists student_session_read_parent on student_session;
create policy student_session_read_parent on student_session
  for select to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent');

-- Abmelden setzt revoked_at, statt die Zeile zu löschen – die Geräteliste
-- soll zeigen, dass abgemeldet wurde. WITH CHECK ist hier nicht redundant:
-- Ohne ihn könnte dasselbe UPDATE die Zeile einem fremden Kind zuschieben
-- (dieselbe Lücke wie in ADR 0004 D7).
drop policy if exists student_session_revoke_parent on student_session;
create policy student_session_revoke_parent on student_session
  for update to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent')
  with check (student_id = app.student_id() and app.actor_role() = 'parent');
