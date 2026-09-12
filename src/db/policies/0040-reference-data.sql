-- Referenzdaten: textbook, chapter, school_profile, school_year_textbook.
--
-- Kuratiert-oder-eigen (ADR 0004 D7), auf `student_id` umgestellt (ADR 0006):
-- `student_id is null` = kuratiert, für alle lesbar, geschrieben nur von der
-- Migrationsrolle.
--
-- Das braucht **zwei** Policies, keine einzige. Eine einzelne `for all`,
-- deren USING auch NULL zulässt, wäre angreifbar: Bei UPDATE filtert USING
-- die Zielzeilen, eine kuratierte Zeile passiert diesen Filter, und WITH
-- CHECK ist durch dasselbe Update erfüllbar, das `student_id` auf das eigene
-- Kind setzt. Die Zeile wäre für alle anderen gekapert. Die Lücke wurde in
-- F-04d reproduziert, bevor sie geschlossen wurde. Idempotent.

grant select, insert, update, delete
  on textbook, chapter, school_profile, school_year_textbook
  to tutr_app;

-- --- textbook -------------------------------------------------------------
alter table textbook enable row level security;

drop policy if exists textbook_read on textbook;
create policy textbook_read on textbook
  for select to tutr_app
  using (student_id is null or student_id = app.student_id());

drop policy if exists textbook_write on textbook;
create policy textbook_write on textbook
  for all to tutr_app
  using (student_id = app.student_id())
  with check (student_id = app.student_id());

-- --- chapter --------------------------------------------------------------
alter table chapter enable row level security;

drop policy if exists chapter_read on chapter;
create policy chapter_read on chapter
  for select to tutr_app
  using (student_id is null or student_id = app.student_id());

drop policy if exists chapter_write on chapter;
create policy chapter_write on chapter
  for all to tutr_app
  using (student_id = app.student_id())
  with check (student_id = app.student_id());

-- --- school_profile -------------------------------------------------------
alter table school_profile enable row level security;

drop policy if exists school_profile_read on school_profile;
create policy school_profile_read on school_profile
  for select to tutr_app
  using (student_id is null or student_id = app.student_id());

drop policy if exists school_profile_write on school_profile;
create policy school_profile_write on school_profile
  for all to tutr_app
  using (student_id = app.student_id())
  with check (student_id = app.student_id());

-- --- school_year_textbook -------------------------------------------------
-- Kein Referenzdatum, sondern eine Entscheidung für dieses Kind: normales
-- Muster, seit L-01 beide Rollen schreibend (ADR 0009 D1 nachträglich auf
-- diese Tabelle angewendet, siehe Nachtrag dort vom 12.9.2026) – vorher las
-- das Kind hier nur, ADR 0006 D1 „funktioniert ohne Elternkonto" verlangt
-- aber auch für das Lehrwerk das eigenständige Erfassen.
alter table school_year_textbook enable row level security;

drop policy if exists school_year_textbook_parent on school_year_textbook;
create policy school_year_textbook_parent on school_year_textbook
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent')
  with check (student_id = app.student_id() and app.actor_role() = 'parent');

drop policy if exists school_year_textbook_student on school_year_textbook;
create policy school_year_textbook_student on school_year_textbook
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');
