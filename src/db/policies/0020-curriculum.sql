-- Policies für school_year, subject, topic, learning_objective,
-- objective_prerequisite (F-04c).
-- Rollenverteilung nach docs/adr/0004-datenmodell-rls.md D4:
--   school_year, subject:            Eltern lesen + schreiben (ganze Familie),
--                                     Kind liest nur das eigene.
--   topic, learning_objective,
--   objective_prerequisite:          Kind lesen + schreiben (eigenes),
--                                     Eltern nur lesen.
-- Kind-Policies filtern zusätzlich auf student_id = app.student_id(), damit
-- Geschwisterprofile getrennt bleiben (D4). Idempotent.

grant select, insert, update, delete
  on school_year, subject, topic, learning_objective, objective_prerequisite
  to tutr_app;

-- --- school_year ------------------------------------------------------
alter table school_year enable row level security;

drop policy if exists school_year_eltern on school_year;
create policy school_year_eltern on school_year
  for all to tutr_app
  using (family_id = app.family_id() and app.actor_role() = 'parent')
  with check (family_id = app.family_id() and app.actor_role() = 'parent');

drop policy if exists school_year_kind on school_year;
create policy school_year_kind on school_year
  for select to tutr_app
  using (
    family_id = app.family_id()
    and app.actor_role() = 'student'
    and student_id = app.student_id()
  );

-- --- subject ------------------------------------------------------------
alter table subject enable row level security;

drop policy if exists subject_eltern on subject;
create policy subject_eltern on subject
  for all to tutr_app
  using (family_id = app.family_id() and app.actor_role() = 'parent')
  with check (family_id = app.family_id() and app.actor_role() = 'parent');

drop policy if exists subject_kind on subject;
create policy subject_kind on subject
  for select to tutr_app
  using (
    family_id = app.family_id()
    and app.actor_role() = 'student'
    and student_id = app.student_id()
  );

-- --- topic --------------------------------------------------------------
alter table topic enable row level security;

drop policy if exists topic_eltern on topic;
create policy topic_eltern on topic
  for select to tutr_app
  using (family_id = app.family_id() and app.actor_role() = 'parent');

drop policy if exists topic_kind on topic;
create policy topic_kind on topic
  for all to tutr_app
  using (
    family_id = app.family_id()
    and app.actor_role() = 'student'
    and student_id = app.student_id()
  )
  with check (
    family_id = app.family_id()
    and app.actor_role() = 'student'
    and student_id = app.student_id()
  );

-- --- learning_objective --------------------------------------------------
alter table learning_objective enable row level security;

drop policy if exists learning_objective_eltern on learning_objective;
create policy learning_objective_eltern on learning_objective
  for select to tutr_app
  using (family_id = app.family_id() and app.actor_role() = 'parent');

drop policy if exists learning_objective_kind on learning_objective;
create policy learning_objective_kind on learning_objective
  for all to tutr_app
  using (
    family_id = app.family_id()
    and app.actor_role() = 'student'
    and student_id = app.student_id()
  )
  with check (
    family_id = app.family_id()
    and app.actor_role() = 'student'
    and student_id = app.student_id()
  );

-- --- objective_prerequisite -----------------------------------------------
alter table objective_prerequisite enable row level security;

drop policy if exists objective_prerequisite_eltern on objective_prerequisite;
create policy objective_prerequisite_eltern on objective_prerequisite
  for select to tutr_app
  using (family_id = app.family_id() and app.actor_role() = 'parent');

drop policy if exists objective_prerequisite_kind on objective_prerequisite;
create policy objective_prerequisite_kind on objective_prerequisite
  for all to tutr_app
  using (
    family_id = app.family_id()
    and app.actor_role() = 'student'
    and student_id = app.student_id()
  )
  with check (
    family_id = app.family_id()
    and app.actor_role() = 'student'
    and student_id = app.student_id()
  );
