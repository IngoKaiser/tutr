-- Identität: student, parent_account, parent_student (ADR 0006 D1–D3).
--
-- Das Kind ist der Mandant. Jede Policy hier und in allen Folgedateien
-- vergleicht `student_id = app.student_id()`; die Rolle entscheidet nur noch
-- über lesen oder schreiben. Dass ein Elternteil für *dieses* Kind handeln
-- darf, ist beim Bau des Actors über parent_student geprüft worden.
--
-- Idempotent: `drop policy if exists` vor jedem `create policy`.

grant select, insert, update, delete on student, parent_account, parent_student to tutr_app;

-- --- student --------------------------------------------------------------
alter table student enable row level security;

-- Eine Zeile, beide Rollen: der Actor trägt in beiden Fällen die studentId.
drop policy if exists student_read on student;
create policy student_read on student
  for select to tutr_app
  using (id = app.student_id());

-- Die Entstehung (ADR 0005): Das Kind legt sein Profil selbst an. Eng auf die
-- ID des eigenen Actor-Kontexts geprüft – die erzeugt der Server unmittelbar
-- davor, wählbar ist sie von außen nicht. Ein zweites Mal kann diese Policy
-- nicht greifen, weil dann der Primärschlüssel im Weg steht.
drop policy if exists student_create_self on student;
create policy student_create_self on student
  for insert to tutr_app
  with check (id = app.student_id() and app.actor_role() = 'student');

-- Profilpflege durch das Elternteil. Das Kind darf sein Profil noch nicht
-- ändern – das kommt mit F-06c und einer eng geschnittenen eigenen Policy.
drop policy if exists student_update_parent on student;
create policy student_update_parent on student
  for update to tutr_app
  using (id = app.student_id() and app.actor_role() = 'parent')
  with check (id = app.student_id() and app.actor_role() = 'parent');

-- Die Kindliste vor der Auswahl: Nach dem Magic Link steht die Auth-ID fest,
-- ein Kind aber noch nicht. Deshalb über die Anmeldeschleuse statt über einen
-- Actor.
--
-- `app.account_of_auth_user` löst die Auth-ID auf, ohne erneut durch RLS zu
-- gehen. Direkt auf parent_account zuzugreifen wäre der Anfang einer
-- gegenseitigen Rekursion (siehe 0000-setup.sql).
drop policy if exists student_read_for_parent_login on student;
create policy student_read_for_parent_login on student
  for select to tutr_app
  using (
    id in (
      select student_id
      from parent_student
      where parent_account_id = app.account_of_auth_user(app.auth_user_id())
    )
  );

-- --- parent_account -------------------------------------------------------
alter table parent_account enable row level security;

-- Anmeldeschleuse (D3): nur select, nur die eigene Zeile, allein über die
-- Auth-ID, die Supabase serverseitig bestätigt hat.
drop policy if exists parent_account_self on parent_account;
create policy parent_account_self on parent_account
  for select to tutr_app
  using (auth_user_id = app.auth_user_id());

-- Das angemeldete Elternteil verwaltet die eigene Zeile. `insert` gehört
-- dazu: So entsteht das Konto beim Beitritt – mit einer ID, die der Server
-- unmittelbar davor erzeugt hat.
drop policy if exists parent_account_own on parent_account;
create policy parent_account_own on parent_account
  for all to tutr_app
  using (id = app.parent_id())
  with check (id = app.parent_id());

-- Das Kind sieht, wer mit ihm verknüpft ist – Name und Adresse desjenigen,
-- der seine Termine und Noten sehen darf. Nur lesen.
drop policy if exists parent_account_read_by_student on parent_account;
create policy parent_account_read_by_student on parent_account
  for select to tutr_app
  using (
    app.actor_role() = 'student'
    and id in (select app.parents_of(app.student_id()))
  );

-- --- parent_student -------------------------------------------------------
alter table parent_student enable row level security;

-- Gegenstück zu student_read_for_parent_login: dieselbe Schleuse, damit die
-- Kindliste in einem Zug gelesen werden kann.
drop policy if exists parent_student_self on parent_student;
create policy parent_student_self on parent_student
  for select to tutr_app
  using (parent_account_id = app.account_of_auth_user(app.auth_user_id()));

drop policy if exists parent_student_read_own on parent_student;
create policy parent_student_read_own on parent_student
  for select to tutr_app
  using (parent_account_id = app.parent_id());

-- Das Kind sieht seine eigenen Verknüpfungen – „ist jemand verknüpft?" ist
-- eine Frage, die es beantworten können muss.
drop policy if exists parent_student_read_by_student on parent_student;
create policy parent_student_read_by_student on parent_student
  for select to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student');

-- Der Beitritt. Die zweite Bedingung ist der eigentliche Schutz: Ohne sie
-- könnte ein angemeldetes Elternteil sich mit einem beliebigen Kind
-- verknüpfen, denn `parent_account_id = app.parent_id()` prüft nur die eigene
-- Seite der Beziehung.
drop policy if exists parent_student_link on parent_student;
create policy parent_student_link on parent_student
  for insert to tutr_app
  with check (
    parent_account_id = app.parent_id()
    and app.parent_may_link(student_id, app.parent_id())
  );

-- Einwilligung setzen und Verknüpfung wieder lösen.
drop policy if exists parent_student_manage on parent_student;
create policy parent_student_manage on parent_student
  for update to tutr_app
  using (parent_account_id = app.parent_id())
  with check (parent_account_id = app.parent_id());

drop policy if exists parent_student_unlink on parent_student;
create policy parent_student_unlink on parent_student
  for delete to tutr_app
  using (parent_account_id = app.parent_id());
