<!-- RLS-Policies, eine Datei je Aggregat, lexikalisch angewandt von scripts/db-apply.mts. -->
<!-- Checkliste je neuer Tabelle (ADR 0004): family_id + zusammengesetzter FK, Policy hier, -->
<!-- Policy-Test, Eintrag in der RLS-Matrix des ADR. Eltern lesen nie tutor_sessions. -->
<!-- Der Metatest src/db/rls.test.ts lässt CI fehlschlagen, wenn eine Tabelle ohne RLS -->
<!-- oder ohne Policy bleibt. -->
