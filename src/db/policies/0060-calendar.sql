-- calendar_event (K-01).
--
-- Richtung aus ADR 0004 D4, Zeile `calendar_event, study_plan_slot`:
-- **beide Rollen lesen + schreiben.** Ein Elternteil trägt einen Termin
-- genauso ein wie das Kind – anders als bei `topic`/`vocab_*` (nur Kind
-- schreibt) und anders als bei `school_year_textbook` (nur Eltern).
--
-- Muster „Eigene Daten, beide schreiben" (src/db/policies/README.md),
-- dasselbe wie `school_year`/`subject` seit ADR 0009. Idempotent.

grant select, insert, update, delete on calendar_event to tutr_app;

alter table calendar_event enable row level security;

drop policy if exists calendar_event_parent on calendar_event;
create policy calendar_event_parent on calendar_event
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent')
  with check (student_id = app.student_id() and app.actor_role() = 'parent');

drop policy if exists calendar_event_student on calendar_event;
create policy calendar_event_student on calendar_event
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');
