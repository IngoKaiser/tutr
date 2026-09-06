// @vitest-environment node
import { describe, expect, test } from "vitest";

import { connectAsMigrationRole, loadTestEnv, testDbAvailable } from "./test-db";

/**
 * Metatest zu CLAUDE.md „Jede Tabelle hat RLS. Neue Tabelle ohne Policy =
 * Ticket nicht fertig." Solange keine Fachtabelle existiert, ist er trivial
 * grün – ab F-04b ist er der Wächter.
 */
loadTestEnv();

// Tabellen, die nicht uns gehören (Migrationsstand, Extensions).
const AUSNAHMEN = ["__drizzle_migrations"];

describe.skipIf(!testDbAvailable())("RLS-Metatest", () => {
  test("jede Tabelle in public hat RLS und mindestens eine Policy", async () => {
    const admin = connectAsMigrationRole();
    try {
      const rows = await admin.client<{ tabelle: string; rls: boolean; policies: number }[]>`
        select c.relname as tabelle,
               c.relrowsecurity as rls,
               (select count(*) from pg_policy p where p.polrelid = c.oid)::int as policies
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relname <> all (${AUSNAHMEN})
        order by c.relname
      `;

      const ungeschuetzt = rows.filter((r) => !r.rls || r.policies === 0);
      expect(
        ungeschuetzt.map((r) => `${r.tabelle} (rls=${r.rls}, policies=${r.policies})`),
      ).toEqual([]);
    } finally {
      await admin.close();
    }
  });
});
