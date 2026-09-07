// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, type Actor } from "../actor";
import { connectAsAppRole, connectAsMigrationRole, loadTestEnv, testDbAvailable } from "../test-db";

/**
 * Policy-Tests für family, parent_user und student (F-04b).
 * Zwei Familien mit je zwei Kindern – erst dadurch lässt sich zeigen, dass
 * weder Familien noch Geschwister sich gegenseitig sehen.
 * Läuft nur bei `npm run db:test` (RUN_DB_TESTS=1).
 */
loadTestEnv();

const A = {
  family: "aaaaaaaa-0000-4000-8000-000000000001",
  parent: "aaaaaaaa-0000-4000-8000-000000000002",
  kind1: "aaaaaaaa-0000-4000-8000-000000000003",
  kind2: "aaaaaaaa-0000-4000-8000-000000000004",
};
const B = {
  family: "bbbbbbbb-0000-4000-8000-000000000001",
  parent: "bbbbbbbb-0000-4000-8000-000000000002",
  kind1: "bbbbbbbb-0000-4000-8000-000000000003",
};

const elternteil = (familyId: string, userId: string): Actor => ({
  role: "parent",
  familyId,
  userId,
});
const kind = (familyId: string, studentId: string): Actor => ({
  role: "student",
  familyId,
  studentId,
});

describe.skipIf(!testDbAvailable())("RLS: family, parent_user, student", () => {
  let app: ReturnType<typeof connectAsAppRole>;
  let admin: ReturnType<typeof connectAsMigrationRole>;

  beforeAll(async () => {
    admin = connectAsMigrationRole();
    await admin.client`delete from family where id in (${A.family}, ${B.family})`;
    await admin.client`
      insert into family (id, name) values (${A.family}, 'Familie A'), (${B.family}, 'Familie B')`;
    await admin.client`
      insert into parent_user (id, family_id, auth_user_id, name) values
        (${A.parent}, ${A.family}, gen_random_uuid(), 'Elternteil A'),
        (${B.parent}, ${B.family}, gen_random_uuid(), 'Elternteil B')`;
    await admin.client`
      insert into student (id, family_id, first_name, grade_level, class_name) values
        (${A.kind1}, ${A.family}, 'Kind A1', 8, '8c'),
        (${A.kind2}, ${A.family}, 'Kind A2', 5, '5a'),
        (${B.kind1}, ${B.family}, 'Kind B1', 8, '8c')`;
    app = connectAsAppRole();
  });

  afterAll(async () => {
    if (admin) {
      await admin.client`delete from family where id in (${A.family}, ${B.family})`;
      await admin.close();
    }
    await app?.close();
  });

  test("ohne Actor-Kontext ist jede der drei Tabellen leer", async () => {
    for (const tabelle of ["family", "parent_user", "student"]) {
      const rows = await app.db.execute(sql`select 1 from ${sql.identifier(tabelle)}`);
      expect(rows, tabelle).toHaveLength(0);
    }
  });

  test("Elternteil sieht die eigene Familie, nicht die fremde", async () => {
    const namen = await runWithActor(app.db, elternteil(A.family, A.parent), (tx) =>
      tx.execute<{ name: string }>(sql`select name from family order by name`),
    );
    expect(namen.map((r) => r.name)).toEqual(["Familie A"]);
  });

  test("Elternteil sieht beide eigenen Kinder", async () => {
    const kinder = await runWithActor(app.db, elternteil(A.family, A.parent), (tx) =>
      tx.execute<{ first_name: string }>(sql`select first_name from student order by first_name`),
    );
    expect(kinder.map((r) => r.first_name)).toEqual(["Kind A1", "Kind A2"]);
  });

  test("Kind sieht nur sich selbst – Geschwister bleiben getrennt", async () => {
    const kinder = await runWithActor(app.db, kind(A.family, A.kind1), (tx) =>
      tx.execute<{ first_name: string }>(sql`select first_name from student order by first_name`),
    );
    expect(kinder.map((r) => r.first_name)).toEqual(["Kind A1"]);
  });

  test("Kind sieht Familie und Elternkonto, ändert sie aber nicht", async () => {
    const sicht = await runWithActor(app.db, kind(A.family, A.kind1), async (tx) => ({
      familien: await tx.execute<{ name: string }>(sql`select name from family`),
      eltern: await tx.execute<{ name: string }>(sql`select name from parent_user`),
    }));
    expect(sicht.familien.map((r) => r.name)).toEqual(["Familie A"]);
    expect(sicht.eltern.map((r) => r.name)).toEqual(["Elternteil A"]);

    await runWithActor(app.db, kind(A.family, A.kind1), (tx) =>
      tx.execute(sql`update family set name = 'Umbenannt' where id = ${A.family}`),
    );
    const [row] = await admin.client<{ name: string }[]>`
      select name from family where id = ${A.family}`;
    expect(row.name).toBe("Familie A");
  });

  test("Kind kann das eigene Profil nicht umschreiben", async () => {
    await runWithActor(app.db, kind(A.family, A.kind1), (tx) =>
      tx.execute(sql`update student set grade_level = 13 where id = ${A.kind1}`),
    );
    const [row] = await admin.client<{ grade_level: number }[]>`
      select grade_level from student where id = ${A.kind1}`;
    expect(row.grade_level).toBe(8);
  });

  test("Elternteil kann kein Kind in eine fremde Familie legen", async () => {
    const fehler = await runWithActor(app.db, elternteil(A.family, A.parent), (tx) =>
      tx.execute(
        sql`insert into student (family_id, first_name, grade_level) values (${B.family}, 'Geklaut', 8)`,
      ),
    ).catch((err: unknown) => err);

    let text = "";
    let e = fehler as { message?: string; cause?: unknown } | undefined;
    while (e) {
      if (e.message) text += ` ${e.message}`;
      e = e.cause as typeof e;
    }
    expect(text).toMatch(/row-level security/i);
  });
});
