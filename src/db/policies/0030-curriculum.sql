-- school_year, subject, school_year_subject, topic, learning_objective,
-- objective_prerequisite.
--
-- Richtungen (ADR 0004 D4, auf `student_id` umgestellt in ADR 0006 D2, für
-- school_year/subject/school_year_subject geändert in ADR 0009 D1):
--   school_year, subject, school_year_subject:
--                           Kind liest + schreibt, Eltern lesen + schreiben.
--   topic, learning_objective, objective_prerequisite:
--                           Kind liest + schreibt, Eltern lesen.
--
-- **Nachtrag ADR 0009 D1:** Vorher durfte nur ein Elternteil ein Fach oder
-- Schuljahr anlegen (`for select` fürs Kind) – ein Kind ohne Elternkonto
-- (ADR 0006 D1: „funktioniert ohne") kam dadurch nie zu einem Fach. Das
-- Kind bekommt jetzt dasselbe Schreibrecht dazu, den Eltern nimmt es nichts.
--
-- Der Zusatzfilter auf `student_id`, den die Kind-Policies früher brauchten,
-- ist entfallen – er *ist* jetzt die Bedingung. Idempotent.

grant select, insert, update, delete
  on school_year, subject, school_year_subject, topic, learning_objective,
     objective_prerequisite
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
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

-- --- subject --------------------------------------------------------------
alter table subject enable row level security;

drop policy if exists subject_parent on subject;
create policy subject_parent on subject
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent')
  with check (student_id = app.student_id() and app.actor_role() = 'parent');

drop policy if exists subject_student on subject;
create policy subject_student on subject
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

-- --- school_year_subject ---------------------------------------------------
-- Neu mit F-16a (ADR 0009 D2): welche Fächer in einem Schuljahr laufen.
-- Dieselbe Richtung wie school_year/subject, aus demselben Grund.
alter table school_year_subject enable row level security;

drop policy if exists school_year_subject_parent on school_year_subject;
create policy school_year_subject_parent on school_year_subject
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent')
  with check (student_id = app.student_id() and app.actor_role() = 'parent');

drop policy if exists school_year_subject_student on school_year_subject;
create policy school_year_subject_student on school_year_subject
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

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
