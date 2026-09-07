// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, runWithAuthUser, type Actor } from "./actor";
import { connectAsAppRole, connectAsMigrationRole, loadTestEnv, testDbAvailable } from "./test-db";

/**
 * Die Selbst-Lese-Policy auf parent_user (F-05) ist die einzige Stelle, an der
 * ohne Familien-Kontext gelesen werden darf. Entsprechend eng muss sie sein:
 * nur SELECT, nur die eigene Zeile, kein Schreiben.
 */
loadTestEnv();

const A = {
  family: "77770000-0000-4000-8000-000000000001",
  parent: "77770000-0000-4000-8000-000000000002",
  auth: "77770000-0000-4000-8000-0000000000a1",
};
const B = {
  family: "88880000-0000-4000-8000-000000000001",
  parent: "88880000-0000-4000-8000-000000000002",
  auth: "88880000-0000-4000-8000-0000000000b1",
};

function ursachenkette(err: unknown): string {
  const teile: string[] = [];
  let a = err as { message?: string; cause?: unknown } | undefined;
  while (a) {
    if (a.message) teile.push(a.message);
    a = a.cause as typeof a;
  }
  return teile.join(" | ");
}

describe.skipIf(!testDbAvailable())("Nachschlagen des Elternkontos über die Auth-ID", () => {
  let app: ReturnType<typeof connectAsAppRole>;
  let admin: ReturnType<typeof connectAsMigrationRole>;

  beforeAll(async () => {
    admin = connectAsMigrationRole();
    await admin.client`delete from family where id in (${A.family}, ${B.family})`;
    await admin.client`
      insert into family (id, name) values (${A.family}, 'Familie A'), (${B.family}, 'Familie B')`;
    await admin.client`
      insert into parent_user (id, family_id, auth_user_id, name) values
        (${A.parent}, ${A.family}, ${A.auth}, 'Elternteil A'),
        (${B.parent}, ${B.family}, ${B.auth}, 'Elternteil B')`;
    app = connectAsAppRole();
  });

  afterAll(async () => {
    if (admin) {
      await admin.client`delete from family where id in (${A.family}, ${B.family})`;
      await admin.close();
    }
    await app?.close();
  });

  test("findet die eigene Zeile ohne Familien-Kontext", async () => {
    const zeilen = await runWithAuthUser(app.db, A.auth, (tx) =>
      tx.execute<{ id: string; family_id: string }>(
        sql`select id, family_id from parent_user where auth_user_id = ${A.auth}`,
      ),
    );
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0]?.family_id).toBe(A.family);
  });

  test("sieht ausschließlich die eigene Zeile, nie fremde", async () => {
    const alle = await runWithAuthUser(app.db, A.auth, (tx) =>
      tx.execute<{ name: string }>(sql`select name from parent_user`),
    );
    expect(alle.map((r) => r.name)).toEqual(["Elternteil A"]);
  });

  test("ohne Auth-ID bleibt alles leer – fail closed", async () => {
    const alle = await app.db.execute<{ name: string }>(sql`select name from parent_user`);
    expect(alle).toHaveLength(0);
  });

  test("erlaubt kein Schreiben – nur Lesen", async () => {
    const fehler = await runWithAuthUser(app.db, A.auth, (tx) =>
      tx.execute(sql`update parent_user set name = 'Umbenannt' where auth_user_id = ${A.auth}`),
    ).catch((err: unknown) => err);

    // Entweder Policy-Verstoß oder schlicht null betroffene Zeilen – beides
    // ist recht, solange der Wert unverändert bleibt.
    void fehler;
    const [zeile] = await admin.client<{ name: string }[]>`
      select name from parent_user where id = ${A.parent}`;
    expect(zeile!.name).toBe("Elternteil A");
  });

  test("erlaubt kein Anlegen eines fremden Elternkontos", async () => {
    const fehler = await runWithAuthUser(app.db, A.auth, (tx) =>
      tx.execute(
        sql`insert into parent_user (family_id, auth_user_id, name)
            values (${B.family}, ${A.auth}, 'Eingeschmuggelt')`,
      ),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/row-level security/i);
  });

  test("der volle Actor sieht danach die ganze Familie", async () => {
    const actor: Actor = { role: "parent", familyId: A.family, userId: A.parent };
    const zeilen = await runWithActor(app.db, actor, (tx) =>
      tx.execute<{ name: string }>(sql`select name from family`),
    );
    expect(zeilen.map((r) => r.name)).toEqual(["Familie A"]);
  });
});
