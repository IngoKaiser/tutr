-- Anmeldung: die Brücke von der Supabase-Auth-ID zum Actor (F-05).
--
-- Henne-Ei-Problem: Nach dem Magic-Link-Login kennen wir die Auth-ID, aber
-- noch nicht die Familie. Die Policies auf parent_user verlangen jedoch
-- bereits `family_id = app.family_id()`. Um die Familie zu finden, bräuchte
-- man die Familie.
--
-- Lösung im bestehenden Muster statt einer Ausnahme davon: eine weitere
-- Session-Variable `tutr.auth_user_id` und eine eng geschnittene Policy, die
-- ausschließlich das Lesen der *eigenen* Zeile erlaubt – über kein anderes
-- Kriterium als die Auth-ID, die Supabase serverseitig bestätigt hat.
-- Idempotent.

create or replace function app.auth_user_id() returns uuid
  language sql stable
  as $$ select nullif(current_setting('tutr.auth_user_id', true), '')::uuid $$;

grant execute on function app.auth_user_id() to tutr_app;

-- Nur SELECT, nur die eigene Zeile. Kein Schreiben: Ein Elternkonto anlegen
-- darf man erst, wenn der volle Actor-Kontext steht (siehe Onboarding).
drop policy if exists parent_user_selbst on parent_user;
create policy parent_user_selbst on parent_user
  for select to tutr_app
  using (auth_user_id = app.auth_user_id());
