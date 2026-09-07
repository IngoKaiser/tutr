// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, type Actor } from "./actor";
import { SEED_IDS, seed } from "./seed";
import { connectAsAppRole, connectAsMigrationRole, loadTestEnv, testDbAvailable } from "./test-db";

/**
 * Der Seed ist nur dann etwas wert, wenn die Beispieldaten unter den echten
 * Policies das zeigen, was sie zeigen sollen. Genau das prüft dieser Test –
 * mit demselben Actor, den der Dev-Umschalter in der App setzt.
 */
loadTestEnv();

const kindA: Actor = {
  role: "student",
  familyId: SEED_IDS.familieA,
  studentId: SEED_IDS.kindA,
};
const elternA: Actor = {
  role: "parent",
  familyId: SEED_IDS.familieA,
  userId: SEED_IDS.elternteilA,
};

describe.skipIf(!testDbAvailable())("Beispieldaten unter den Policies", () => {
  let app: ReturnType<typeof connectAsAppRole>;
  let admin: ReturnType<typeof connectAsMigrationRole>;

  beforeAll(async () => {
    admin = connectAsMigrationRole();
    await seed(admin.client);
    app = connectAsAppRole();
  });

  afterAll(async () => {
    if (admin) {
      await admin.client`delete from family where id in (${SEED_IDS.familieA}, ${SEED_IDS.familieB})`;
      await admin.client`delete from textbook where id = ${SEED_IDS.lehrwerkKuratiert}`;
      await admin.close();
    }
    await app?.close();
  });

  test("ist idempotent – zweimal laufen ändert nichts", async () => {
    await seed(admin.client);
    const [row] = await admin.client<{ n: string }[]>`
      select count(*)::text as n from student where family_id = ${SEED_IDS.familieA}`;
    expect(row!.n).toBe("2");
  });

  test("Kind sieht die eigenen Fächer, nicht die des Geschwisterkinds", async () => {
    const faecher = await runWithActor(app.db, kindA, (tx) =>
      tx.execute<{ name: string }>(sql`select name from subject order by name`),
    );
    expect(faecher.map((r) => r.name)).toEqual([
      "Biologie",
      "Deutsch",
      "Englisch",
      "Französisch",
      "Mathematik",
      "PGW",
    ]);
  });

  test("Kind sieht nur das eigene Profil", async () => {
    const kinder = await runWithActor(app.db, kindA, (tx) =>
      tx.execute<{ first_name: string }>(sql`select first_name from student`),
    );
    expect(kinder.map((r) => r.first_name)).toEqual(["Mia"]);
  });

  test("Elternteil sieht beide Kinder der Familie", async () => {
    const kinder = await runWithActor(app.db, elternA, (tx) =>
      tx.execute<{ first_name: string }>(sql`select first_name from student order by first_name`),
    );
    expect(kinder.map((r) => r.first_name)).toEqual(["Ben", "Mia"]);
  });

  test("Familie B bleibt unsichtbar", async () => {
    const alles = await runWithActor(app.db, elternA, (tx) =>
      tx.execute<{ name: string }>(sql`select name from family`),
    );
    expect(alles.map((r) => r.name)).toEqual(["Familie A"]);
  });

  test("Themen mit Lernzielen und einem Vorläufer stehen bereit", async () => {
    const daten = await runWithActor(app.db, kindA, async (tx) => ({
      themen: await tx.execute<{ title: string }>(sql`select title from topic order by title`),
      vorlaeufer: await tx.execute<{ n: string }>(
        sql`select count(*)::text as n from objective_prerequisite`,
      ),
    }));
    expect(daten.themen.map((r) => r.title)).toEqual([
      "Les verbes pronominaux",
      "Quadratische Gleichungen",
    ]);
    expect(daten.vorlaeufer[0]?.n).toBe("1");
  });

  test("Das kuratierte Lehrwerk ist sichtbar, aber nicht änderbar", async () => {
    const titel = await runWithActor(app.db, kindA, (tx) =>
      tx.execute<{ title: string }>(
        sql`select title from textbook where id = ${SEED_IDS.lehrwerkKuratiert}`,
      ),
    );
    expect(titel.map((r) => r.title)).toEqual(["Découvertes 4"]);

    await runWithActor(app.db, kindA, (tx) =>
      tx.execute(
        sql`update textbook set title = 'Gekapert' where id = ${SEED_IDS.lehrwerkKuratiert}`,
      ),
    );
    const [row] = await admin.client<{ title: string }[]>`
      select title from textbook where id = ${SEED_IDS.lehrwerkKuratiert}`;
    expect(row!.title).toBe("Découvertes 4");
  });
});
