-- homework_task (T-03).
--
-- Richtung: **nur das Kind, lesen + schreiben. Für Eltern gibt es KEINE
-- Policy.**
--
-- Das weicht bewusst von ADR 0004 D4 ab, wo `homework_task` noch mit
-- „Eltern lesen Status/Zeit" stand. ADR 0012 D3 hat die Zeile dem Kind
-- zugeschlagen: Status, Versuche und Hinweisstufe sind Prozessdaten – die
-- Zahl der Versuche an einer Mathe-Aufgabe sagt nichts, womit ein
-- Elternteil handeln könnte, aber viel darüber, wie schwer es dem Kind
-- gefallen ist. Genau das ist die Information, deren Sichtbarkeit die
-- Bereitschaft senkt, ehrlich „ich versteh das nicht" zu sagen.
--
-- Dieselbe Richtung wie `tutor_session`/`tutor_message` (0070-tutor.sql).
-- Idempotent.

grant select, insert, update, delete on homework_task to tutr_app;

alter table homework_task enable row level security;

drop policy if exists homework_task_student on homework_task;
create policy homework_task_student on homework_task
  for all to tutr_app
  using (student_id = app.student_id() and app.actor_role() = 'student')
  with check (student_id = app.student_id() and app.actor_role() = 'student');
