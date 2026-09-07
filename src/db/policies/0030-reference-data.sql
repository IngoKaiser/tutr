-- Policies für textbook, chapter, school_profile (kuratiert-oder-eigen,
-- ADR 0004 D7) und school_year_textbook (familieneigen, D4).
--
-- Das kuratiert-oder-eigen-Muster braucht ZWEI Policies, nicht eine:
--   Lesen:     family_id is null (kuratiert) ODER die eigene Familie.
--   Schreiben: ausschließlich die eigene Familie, in USING *und* WITH CHECK.
-- Mit einer einzigen "for all"-Policy, deren USING auch NULL zulässt, könnte
-- ein UPDATE eine kuratierte Zeile treffen und ihr family_id auf die eigene
-- Familie setzen – die Zeile wäre für alle anderen Familien gekapert.
-- Kuratierte Daten schreibt deshalb nur die Migrationsrolle.
--
-- Anders als sonst dürfen hier BEIDE Rollen schreiben: Das Kind fotografiert
-- laut §10 das Inhaltsverzeichnis und muss das Ergebnis speichern können.
-- Idempotent.

grant select, insert, update, delete
  on textbook, chapter, school_profile, school_year_textbook
  to tutr_app;

-- --- textbook -----------------------------------------------------------
alter table textbook enable row level security;

drop policy if exists textbook_lesen on textbook;
create policy textbook_lesen on textbook
  for select to tutr_app
  using (family_id is null or family_id = app.family_id());

drop policy if exists textbook_eigene on textbook;
create policy textbook_eigene on textbook
  for all to tutr_app
  using (family_id = app.family_id())
  with check (family_id = app.family_id());

-- --- chapter ------------------------------------------------------------
alter table chapter enable row level security;

drop policy if exists chapter_lesen on chapter;
create policy chapter_lesen on chapter
  for select to tutr_app
  using (family_id is null or family_id = app.family_id());

drop policy if exists chapter_eigene on chapter;
create policy chapter_eigene on chapter
  for all to tutr_app
  using (family_id = app.family_id())
  with check (family_id = app.family_id());

-- --- school_profile -------------------------------------------------------
alter table school_profile enable row level security;

drop policy if exists school_profile_lesen on school_profile;
create policy school_profile_lesen on school_profile
  for select to tutr_app
  using (family_id is null or family_id = app.family_id());

drop policy if exists school_profile_eigene on school_profile;
create policy school_profile_eigene on school_profile
  for all to tutr_app
  using (family_id = app.family_id())
  with check (family_id = app.family_id());

-- --- school_year_textbook -------------------------------------------------
-- Keine Referenzdaten, sondern die Entscheidung dieser Familie: welches
-- Lehrwerk gilt in diesem Schuljahr für dieses Fach. Darum das normale
-- Muster – Eltern schreiben, das Kind liest (D4).
alter table school_year_textbook enable row level security;

drop policy if exists school_year_textbook_eltern on school_year_textbook;
create policy school_year_textbook_eltern on school_year_textbook
  for all to tutr_app
  using (family_id = app.family_id() and app.actor_role() = 'parent')
  with check (family_id = app.family_id() and app.actor_role() = 'parent');

drop policy if exists school_year_textbook_kind on school_year_textbook;
create policy school_year_textbook_kind on school_year_textbook
  for select to tutr_app
  using (
    family_id = app.family_id()
    and app.actor_role() = 'student'
    and student_id = app.student_id()
  );
