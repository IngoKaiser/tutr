-- tutor_session, tutor_message, ai_usage (T-02 / S-03b).
--
-- Richtung aus ADR 0004 D4, Zeile `tutor_session, tutor_message`:
-- **nur das Kind, lesen + schreiben. Für Eltern gibt es KEINE Policy.**
-- Das ist die strukturelle Durchsetzung von „Eltern sehen nie Tutor-
-- Verläufe" (§11, ADR 0004 D3) – ohne `_parent`-Policy kein Zugriff, egal
-- was die Oberfläche tut. Der Zweizeiler für Eltern ist eine eigene Tabelle
-- `tutor_session_summary` und kommt mit T-03 (ADR 0010 D2).
--
-- `ai_usage` (das Kostenkonto, S-03b) trägt dieselbe Richtung: Der Server
-- schreibt es im Actor-Kontext des Kindes, niemand sonst liest es.
--
-- Anders als `0050-vocab.sql` also bewusst **nur** `_student`-Policies.
-- Idempotent.

grant select, insert, update, delete on tutor_session to tutr_app;
grant select, insert, update, delete on tutor_message to tutr_app;
grant select, insert, delete on ai_usage to tutr_app;

-- --- tutor_session ---------------------------------------------------------
alter table tutor_session enable row level security;

drop policy if exists tutor_session_student on tutor_session;
create policy tutor_session_student on tutor_session
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

-- --- tutor_message -------------------------------------------------------
alter table tutor_message enable row level security;

drop policy if exists tutor_message_student on tutor_message;
create policy tutor_message_student on tutor_message
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

-- --- ai_usage -----------------------------------------------------------
alter table ai_usage enable row level security;

drop policy if exists ai_usage_student on ai_usage;
create policy ai_usage_student on ai_usage
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');
