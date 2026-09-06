// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, type Actor } from "./actor";
import { connectAsAppRole, connectAsMigrationRole, loadTestEnv, testDbAvailable } from "./test-db";

/**
 * Beweist die Kernaussage von ADR 0004 D1 an einer echten Datenbank:
 * ohne Actor-Kontext sieht die Laufzeitrolle nichts, mit Kontext genau ihre Familie.
 * Läuft nur bei `npm run db:test` (RUN_DB_TESTS=1).
 */
loadTestEnv();

/** Drizzle verpackt Postgres-Fehler; die Ursache steht in der cause-Kette. */
function ursachenkette(err: unknown): string {
  const teile: string[] = [];
  let aktuell = err as { message?: string; cause?: unknown } | undefined;
  while (aktuell) {
    if (aktuell.message) teile.push(aktuell.message);
    aktuell = aktuell.cause as typeof aktuell;
  }
  return teile.join(" | ");
}

const FAMILIE_A = "11111111-1111-1111-1111-111111111111";
const FAMILIE_B = "22222222-2222-2222-2222-222222222222";

describe.skipIf(!testDbAvailable())("withActor / RLS-Fundament", () => {
  let app: ReturnType<typeof connectAsAppRole>;
  let admin: ReturnType<typeof connectAsMigrationRole>;

  const parent = (familyId: string): Actor => ({
    role: "parent",
    familyId,
    userId: "33333333-3333-3333-3333-333333333333",
  });

  beforeAll(async () => {
    admin = connectAsMigrationRole();
    // Wegwerf-Tabelle nach demselben Muster wie alle späteren: family_id + Policy.
    await admin.client.unsafe(`
      set client_min_messages = warning;
      drop table if exists rls_probe;
      create table rls_probe (
        id uuid primary key default gen_random_uuid(),
        family_id uuid not null,
        notiz text not null
      );
      alter table rls_probe enable row level security;
      grant select, insert, update, delete on rls_probe to tutr_app;
      drop policy if exists rls_probe_family on rls_probe;
      create policy rls_probe_family on rls_probe
        for all to tutr_app
        using (family_id = app.family_id())
        with check (family_id = app.family_id());
      insert into rls_probe (family_id, notiz) values
        ('${FAMILIE_A}', 'gehört Familie A'),
        ('${FAMILIE_B}', 'gehört Familie B');
    `);
    app = connectAsAppRole();
  });

  afterAll(async () => {
    await admin?.client.unsafe("drop table if exists rls_probe");
    await app?.close();
    await admin?.close();
  });

  test("verbindet als tutr_app und umgeht RLS nicht", async () => {
    const rows = await app.db.execute<{ current_user: string; bypassrls: boolean }>(
      sql`select current_user, (select rolbypassrls from pg_roles where rolname = current_user) as bypassrls`,
    );
    expect(rows[0]?.current_user).toBe("tutr_app");
    expect(rows[0]?.bypassrls).toBe(false);
  });

  test("ohne Actor-Kontext ist das Resultat leer – fail closed", async () => {
    const rows = await app.db.execute<{ notiz: string }>(sql`select notiz from rls_probe`);
    expect(rows).toHaveLength(0);
  });

  test("mit Actor-Kontext nur die eigene Familie", async () => {
    const rows = await runWithActor(app.db, parent(FAMILIE_A), (tx) =>
      tx.execute<{ notiz: string }>(sql`select notiz from rls_probe`),
    );
    expect(rows.map((r) => r.notiz)).toEqual(["gehört Familie A"]);
  });

  test("der Kontext endet mit der Transaktion", async () => {
    await runWithActor(app.db, parent(FAMILIE_A), async (tx) => {
      await tx.execute(sql`select 1`);
    });
    const rows = await app.db.execute<{ notiz: string }>(sql`select notiz from rls_probe`);
    expect(rows).toHaveLength(0);
  });

  test("Schreiben in eine fremde Familie schlägt fehl", async () => {
    const fehler = await runWithActor(app.db, parent(FAMILIE_A), (tx) =>
      tx.execute(sql`insert into rls_probe (family_id, notiz) values (${FAMILIE_B}, 'geklaut')`),
    ).catch((err: unknown) => err);

    expect(ursachenkette(fehler)).toMatch(/row-level security/i);

    // und die Zeile ist wirklich nicht da
    const rows = await admin.client<{ notiz: string }[]>`
      select notiz from rls_probe where notiz = 'geklaut'`;
    expect(rows).toHaveLength(0);
  });
});
