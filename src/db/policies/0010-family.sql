-- Policies für family, parent_user, student (F-04b).
-- Rollenverteilung nach docs/adr/0004-datenmodell-rls.md D4:
--   Elternteil: liest und schreibt die ganze Familie.
--   Kind:       liest Familie und Elternkonto, sieht von den Kind-Profilen
--               nur das eigene – Geschwister bleiben getrennt.
-- Idempotent: darf beliebig oft laufen.

grant select, insert, update, delete on family, parent_user, student to tutr_app;

-- --- family ---------------------------------------------------------------
alter table family enable row level security;

drop policy if exists family_lesen on family;
create policy family_lesen on family
  for select to tutr_app
  using (id = app.family_id());

drop policy if exists family_eltern on family;
create policy family_eltern on family
  for all to tutr_app
  using (id = app.family_id() and app.actor_role() = 'parent')
  with check (id = app.family_id() and app.actor_role() = 'parent');

-- --- parent_user ----------------------------------------------------------
alter table parent_user enable row level security;

drop policy if exists parent_user_lesen on parent_user;
create policy parent_user_lesen on parent_user
  for select to tutr_app
  using (family_id = app.family_id());

drop policy if exists parent_user_eltern on parent_user;
create policy parent_user_eltern on parent_user
  for all to tutr_app
  using (family_id = app.family_id() and app.actor_role() = 'parent')
  with check (family_id = app.family_id() and app.actor_role() = 'parent');

-- --- student --------------------------------------------------------------
alter table student enable row level security;

drop policy if exists student_eltern on student;
create policy student_eltern on student
  for all to tutr_app
  using (family_id = app.family_id() and app.actor_role() = 'parent')
  with check (family_id = app.family_id() and app.actor_role() = 'parent');

-- Das Kind sieht ausschließlich sein eigenes Profil und ändert es nicht:
-- Vorname, Jahrgang und Klasse pflegt das Elternteil.
drop policy if exists student_kind on student;
create policy student_kind on student
  for select to tutr_app
  using (
    family_id = app.family_id()
    and app.actor_role() = 'student'
    and id = app.student_id()
  );
