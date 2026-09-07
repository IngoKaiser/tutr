-- school_year, subject, topic, learning_objective, objective_prerequisite.
--
-- Richtungen unverändert aus ADR 0004 D4, nur auf `student_id` umgestellt
-- (ADR 0006 D2):
--   school_year, subject:   Eltern lesen + schreiben, Kind liest.
--   topic, learning_objective, objective_prerequisite:
--                           Kind liest + schreibt, Eltern lesen.
--
-- Der Zusatzfilter auf `student_id`, den die Kind-Policies früher brauchten,
-- ist entfallen – er *ist* jetzt die Bedingung. Idempotent.

grant select, insert, update, delete
  on school_year, subject, topic, learning_objective, objective_prerequisite
  to tutr_app;

-- --- school_year ----------------------------------------------------------
alter table school_year enable row level security;

drop policy if exists school_year_parent on school_year;
create policy school_year_parent on school_year
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent')
  with check (student_id = app.student_id() and app.actor_role() = 'parent');

drop policy if exists school_year_student on school_year;
create policy school_year_student on school_year
  for select to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student');

-- --- subject --------------------------------------------------------------
alter table subject enable row level security;

drop policy if exists subject_parent on subject;
create policy subject_parent on subject
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent')
  with check (student_id = app.student_id() and app.actor_role() = 'parent');

drop policy if exists subject_student on subject;
create policy subject_student on subject
  for select to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student');

-- --- topic ----------------------------------------------------------------
alter table topic enable row level security;

drop policy if exists topic_parent on topic;
create policy topic_parent on topic
  for select to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent');

drop policy if exists topic_student on topic;
create policy topic_student on topic
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

-- --- learning_objective ---------------------------------------------------
alter table learning_objective enable row level security;

drop policy if exists learning_objective_parent on learning_objective;
create policy learning_objective_parent on learning_objective
  for select to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent');

drop policy if exists learning_objective_student on learning_objective;
create policy learning_objective_student on learning_objective
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

-- --- objective_prerequisite -----------------------------------------------
alter table objective_prerequisite enable row level security;

drop policy if exists objective_prerequisite_parent on objective_prerequisite;
create policy objective_prerequisite_parent on objective_prerequisite
  for select to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent');

drop policy if exists objective_prerequisite_student on objective_prerequisite;
create policy objective_prerequisite_student on objective_prerequisite
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');
