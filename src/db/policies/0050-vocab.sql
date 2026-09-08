-- vocab_set, vocab_item, vocab_set_item, card, review (V-01).
--
-- Richtung wie topic/learning_objective (ADR 0004 D4, Zeile
-- „card, review, vocab_*"): Kind liest + schreibt, Eltern lesen nur –
-- Übungsfortschritt ist Tagesgeschäft des Kindes, kein Elternfeld wie
-- school_year/subject. Idempotent.

grant select, insert, update, delete
  on vocab_set, vocab_item, vocab_set_item, card, review
  to tutr_app;

-- --- vocab_set --------------------------------------------------------
alter table vocab_set enable row level security;

drop policy if exists vocab_set_student on vocab_set;
create policy vocab_set_student on vocab_set
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

drop policy if exists vocab_set_parent on vocab_set;
create policy vocab_set_parent on vocab_set
  for select to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent');

-- --- vocab_item ---------------------------------------------------------
alter table vocab_item enable row level security;

drop policy if exists vocab_item_student on vocab_item;
create policy vocab_item_student on vocab_item
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

drop policy if exists vocab_item_parent on vocab_item;
create policy vocab_item_parent on vocab_item
  for select to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent');

-- --- vocab_set_item -------------------------------------------------------
alter table vocab_set_item enable row level security;

drop policy if exists vocab_set_item_student on vocab_set_item;
create policy vocab_set_item_student on vocab_set_item
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

drop policy if exists vocab_set_item_parent on vocab_set_item;
create policy vocab_set_item_parent on vocab_set_item
  for select to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent');

-- --- card -------------------------------------------------------------
alter table card enable row level security;

drop policy if exists card_student on card;
create policy card_student on card
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

drop policy if exists card_parent on card;
create policy card_parent on card
  for select to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent');

-- --- review -------------------------------------------------------------
alter table review enable row level security;

drop policy if exists review_student on review;
create policy review_student on review
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');

drop policy if exists review_parent on review;
create policy review_parent on review
  for select to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'parent');
