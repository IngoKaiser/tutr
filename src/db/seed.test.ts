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

const mia: Actor = { role: "student", studentId: SEED_IDS.studentOne };
const lea: Actor = { role: "student", studentId: SEED_IDS.studentTwo };
const elternMitMia: Actor = {
  role: "parent",
  parentId: SEED_IDS.parentOne,
  studentId: SEED_IDS.studentOne,
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
      await admin.client`
        delete from student
        where id in (${SEED_IDS.studentOne}, ${SEED_IDS.siblingOne}, ${SEED_IDS.studentTwo})`;
      await admin.client`
        delete from parent_account where id in (${SEED_IDS.parentOne}, ${SEED_IDS.parentTwo})`;
      await admin.client`delete from textbook where id = ${SEED_IDS.textbookCurated}`;
      await admin.close();
    }
    await app?.close();
  });

  test("ist idempotent – zweimal laufen ändert nichts", async () => {
    await seed(admin.client);
    const [row] = await admin.client<{ n: string }[]>`
      select count(*)::text as n from parent_student
      where parent_account_id = ${SEED_IDS.parentOne}`;
    expect(row!.n).toBe("2");
  });

  test("Kind sieht die eigenen Fächer, nicht die des Geschwisterkinds", async () => {
    const faecher = await runWithActor(app.db, mia, (tx) =>
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
    const kinder = await runWithActor(app.db, mia, (tx) =>
      tx.execute<{ first_name: string }>(sql`select first_name from student`),
    );
    expect(kinder.map((r) => r.first_name)).toEqual(["Mia"]);
  });

  test("Elternteil sieht das gewählte Kind, nicht das Geschwister daneben", async () => {
    const kinder = await runWithActor(app.db, elternMitMia, (tx) =>
      tx.execute<{ first_name: string }>(sql`select first_name from student order by first_name`),
    );
    expect(kinder.map((r) => r.first_name)).toEqual(["Mia"]);
  });

  test("Beide Kinder hängen an demselben Elternkonto", async () => {
    // Der Fall, an dem das Familienmodell gescheitert ist (ADR 0006), steht
    // jetzt als Normalfall in den Beispieldaten.
    const zeilen = await admin.client<{ first_name: string }[]>`
      select s.first_name from parent_student ps
      join student s on s.id = ps.student_id
      where ps.parent_account_id = ${SEED_IDS.parentOne}
      order by s.first_name`;
    expect(zeilen.map((r) => r.first_name)).toEqual(["Ben", "Mia"]);
  });

  test("Das unverknüpfte Kind arbeitet ohne Elternkonto", async () => {
    const sicht = await runWithActor(app.db, lea, async (tx) => ({
      selbst: await tx.execute<{ first_name: string }>(sql`select first_name from student`),
      eltern: await tx.execute(sql`select 1 from parent_account`),
    }));
    expect(sicht.selbst.map((r) => r.first_name)).toEqual(["Lea"]);
    expect(sicht.eltern).toHaveLength(0);
  });

  test("Themen mit Lernzielen und einem Vorläufer stehen bereit", async () => {
    const daten = await runWithActor(app.db, mia, async (tx) => ({
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
    const titel = await runWithActor(app.db, mia, (tx) =>
      tx.execute<{ title: string }>(
        sql`select title from textbook where id = ${SEED_IDS.textbookCurated}`,
      ),
    );
    expect(titel.map((r) => r.title)).toEqual(["Découvertes 4"]);

    await runWithActor(app.db, mia, (tx) =>
      tx.execute(
        sql`update textbook set title = 'Gekapert' where id = ${SEED_IDS.textbookCurated}`,
      ),
    );
    const [row] = await admin.client<{ title: string }[]>`
      select title from textbook where id = ${SEED_IDS.textbookCurated}`;
    expect(row!.title).toBe("Découvertes 4");
  });
});
