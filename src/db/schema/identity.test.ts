// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, runWithLoginKey, type Actor } from "../actor";
import {
  connectAsAppRole,
  connectAsMigrationRole,
  loadTestEnv,
  testDbAvailable,
  ursachenkette,
} from "../test-db";

/**
 * Policy-Tests für student, parent_account und parent_student (F-11, ADR 0006).
 *
 * Der Aufbau bildet genau den Fall ab, an dem das Familienmodell gescheitert
 * ist: **ein Elternteil, zwei Kinder** – dazu ein drittes Kind ohne
 * Elternkonto, das beweisen muss, dass es trotzdem arbeitet (ADR 0005).
 *
 * Vier Dinge muss das hier belegen:
 * 1. Ein Kind entsteht durch sich selbst, und genau einmal.
 * 2. Ein Elternteil sieht seine Kinder – und nur die.
 * 3. Verknüpfen darf sich nur, wessen **bestätigte** Adresse das Kind selbst
 *    hinterlegt hat. Ohne diese Prüfung wäre der Beitritt ein Einfallstor.
 * 4. Geschwister sehen einander nicht.
 *
 * Läuft nur bei `npm run db:test` (RUN_DB_TESTS=1).
 */
loadTestEnv();

const P = {
  one: "aa110000-0000-4000-8000-000000000001",
  two: "aa110000-0000-4000-8000-000000000002",
  authOne: "aa110000-0000-4000-8000-0000000000a1",
  authTwo: "aa110000-0000-4000-8000-0000000000a2",
  mailOne: "eltern-eins@example.test",
  mailTwo: "eltern-zwei@example.test",
};
const S = {
  mia: "bb110000-0000-4000-8000-000000000001",
  ben: "bb110000-0000-4000-8000-000000000002",
  lea: "bb110000-0000-4000-8000-000000000003",
  /** Entsteht im Test durch Selbstanlage. */
  neu: "bb110000-0000-4000-8000-00000000000f",
};

const student = (studentId: string): Actor => ({ role: "student", studentId });
const parent = (parentId: string, studentId: string): Actor => ({
  role: "parent",
  parentId,
  studentId,
});

describe.skipIf(!testDbAvailable())("RLS: Kind, Elternkonto, Verknüpfung", () => {
  let app: ReturnType<typeof connectAsAppRole>;
  let admin: ReturnType<typeof connectAsMigrationRole>;

  const aufraeumen = async () => {
    await admin.client`delete from student where id in (${S.mia}, ${S.ben}, ${S.lea}, ${S.neu})`;
    await admin.client`delete from parent_account where id in (${P.one}, ${P.two})`;
  };

  beforeAll(async () => {
    admin = connectAsMigrationRole();
    await aufraeumen();
    await admin.client`
      insert into student (id, first_name, grade_level, parent_email) values
        (${S.mia}, 'Mia', 8, ${P.mailOne}),
        (${S.ben}, 'Ben', 5, ${P.mailOne}),
        (${S.lea}, 'Lea', 8, ${P.mailTwo})`;
    await admin.client`
      insert into parent_account (id, auth_user_id, email, name) values
        (${P.one}, ${P.authOne}, ${P.mailOne}, 'Elternteil Eins'),
        (${P.two}, ${P.authTwo}, ${P.mailTwo}, 'Elternteil Zwei')`;
    // Nur Elternteil Eins ist verknüpft – und gleich mit zwei Kindern.
    await admin.client`
      insert into parent_student (parent_account_id, student_id, consent_at) values
        (${P.one}, ${S.mia}, now()),
        (${P.one}, ${S.ben}, now())`;
    app = connectAsAppRole();
  });

  afterAll(async () => {
    if (admin) {
      await aufraeumen();
      await admin.close();
    }
    await app?.close();
  });

  test("ohne jeden Kontext sind alle drei Tabellen leer", async () => {
    for (const tabelle of ["student", "parent_account", "parent_student"]) {
      const rows = await app.db.execute(sql`select 1 from ${sql.identifier(tabelle)}`);
      expect(rows, tabelle).toHaveLength(0);
    }
  });

  // --- Selbstanlage (ADR 0005) --------------------------------------------

  test("ein Kind legt sein Profil selbst an", async () => {
    await runWithActor(app.db, student(S.neu), (tx) =>
      tx.execute(
        sql`insert into student (id, first_name, grade_level, parent_email)
            values (${S.neu}, 'Neu', 7, 'irgendwer@example.test')`,
      ),
    );
    const [zeile] = await admin.client<{ first_name: string }[]>`
      select first_name from student where id = ${S.neu}`;
    expect(zeile.first_name).toBe("Neu");
  });

  test("dasselbe Kind entsteht kein zweites Mal", async () => {
    const fehler = await runWithActor(app.db, student(S.neu), (tx) =>
      tx.execute(
        sql`insert into student (id, first_name, grade_level) values (${S.neu}, 'Nochmal', 7)`,
      ),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/duplicate key|student_pkey/i);
  });

  test("niemand legt ein Kind an, auf das der eigene Kontext nicht zeigt", async () => {
    const fremd = "bb110000-0000-4000-8000-0000000000ee";
    const fehler = await runWithActor(app.db, student(S.neu), (tx) =>
      tx.execute(
        sql`insert into student (id, first_name, grade_level) values (${fremd}, 'Fremd', 7)`,
      ),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/row-level security/i);
  });

  // --- Sichtbarkeit --------------------------------------------------------

  test("ein Kind sieht nur sich selbst – Geschwister nicht", async () => {
    const zeilen = await runWithActor(app.db, student(S.mia), (tx) =>
      tx.execute<{ first_name: string }>(sql`select first_name from student`),
    );
    expect(zeilen.map((r) => r.first_name)).toEqual(["Mia"]);
  });

  test("ein Kind sieht, wer mit ihm verknüpft ist", async () => {
    const zeilen = await runWithActor(app.db, student(S.mia), (tx) =>
      tx.execute<{ name: string }>(sql`select name from parent_account`),
    );
    expect(zeilen.map((r) => r.name)).toEqual(["Elternteil Eins"]);
  });

  test("ein unverknüpftes Kind sieht kein Elternkonto und arbeitet trotzdem", async () => {
    const sicht = await runWithActor(app.db, student(S.lea), async (tx) => ({
      eltern: await tx.execute(sql`select 1 from parent_account`),
      selbst: await tx.execute<{ first_name: string }>(sql`select first_name from student`),
    }));
    expect(sicht.eltern).toHaveLength(0);
    expect(sicht.selbst.map((r) => r.first_name)).toEqual(["Lea"]);
  });

  test("ein Elternteil sieht das gewählte Kind, nicht das Geschwister daneben", async () => {
    const zeilen = await runWithActor(app.db, parent(P.one, S.mia), (tx) =>
      tx.execute<{ first_name: string }>(sql`select first_name from student`),
    );
    expect(zeilen.map((r) => r.first_name)).toEqual(["Mia"]);
  });

  // --- Die Anmeldeschleuse für den Eltern-Login ----------------------------

  test("die Auth-ID gibt das eigene Konto und beide Kinder frei – mehr nicht", async () => {
    const sicht = await runWithLoginKey(app.db, "tutr.auth_user_id", P.authOne, async (tx) => ({
      konten: await tx.execute<{ name: string }>(sql`select name from parent_account`),
      kinder: await tx.execute<{ first_name: string }>(
        sql`select first_name from student order by first_name`,
      ),
    }));
    expect(sicht.konten.map((r) => r.name)).toEqual(["Elternteil Eins"]);
    expect(sicht.kinder.map((r) => r.first_name)).toEqual(["Ben", "Mia"]);
  });

  test("ein unverknüpftes Elternteil sieht kein Kind", async () => {
    const kinder = await runWithLoginKey(app.db, "tutr.auth_user_id", P.authTwo, (tx) =>
      tx.execute(sql`select 1 from student`),
    );
    expect(kinder).toHaveLength(0);
  });

  test("die Anmeldeschleuse darf nicht schreiben", async () => {
    // Kein Fehler, sondern null getroffene Zeilen: Für UPDATE filtert Postgres
    // über die USING-Klauseln der UPDATE-Policies, und es gibt hier keine.
    await runWithLoginKey(app.db, "tutr.auth_user_id", P.authOne, (tx) =>
      tx.execute(sql`update parent_account set name = 'gekapert'`),
    );
    const [zeile] = await admin.client<{ name: string }[]>`
      select name from parent_account where id = ${P.one}`;
    expect(zeile.name).toBe("Elternteil Eins");
  });

  // --- Der Beitritt: die wichtigste Bedingung ------------------------------

  test("ein Elternteil verknüpft sich mit einem Kind, das seine Adresse nennt", async () => {
    await runWithActor(app.db, parent(P.two, S.lea), (tx) =>
      tx.execute(
        sql`insert into parent_student (parent_account_id, student_id, consent_at)
            values (${P.two}, ${S.lea}, now())`,
      ),
    );
    const zeilen = await admin.client`
      select 1 from parent_student where parent_account_id = ${P.two} and student_id = ${S.lea}`;
    expect(zeilen).toHaveLength(1);
    await admin.client`delete from parent_student where parent_account_id = ${P.two}`;
  });

  test("ein Elternteil verknüpft sich NICHT mit einem fremden Kind", async () => {
    // Elternteil Zwei kennt Mias ID, aber Mia hat eine andere Adresse
    // hinterlegt. Ohne app.parent_may_link() wäre der Beitritt ein Einfallstor.
    const fehler = await runWithActor(app.db, parent(P.two, S.mia), (tx) =>
      tx.execute(
        sql`insert into parent_student (parent_account_id, student_id) values (${P.two}, ${S.mia})`,
      ),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/row-level security/i);

    const zeilen = await admin.client`
      select 1 from parent_student where parent_account_id = ${P.two} and student_id = ${S.mia}`;
    expect(zeilen).toHaveLength(0);
  });

  test("ein Elternteil verknüpft kein Kind mit einem fremden Konto", async () => {
    const fehler = await runWithActor(app.db, parent(P.two, S.lea), (tx) =>
      tx.execute(
        sql`insert into parent_student (parent_account_id, student_id) values (${P.one}, ${S.lea})`,
      ),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/row-level security/i);
  });

  test("ein Kind verknüpft sich nicht selbst", async () => {
    const fehler = await runWithActor(app.db, student(S.lea), (tx) =>
      tx.execute(
        sql`insert into parent_student (parent_account_id, student_id) values (${P.two}, ${S.lea})`,
      ),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/row-level security/i);
  });

  // --- Löschen (Vorbereitung F-06e) ---------------------------------------

  test("das Löschen eines Elternkontos lässt die Kinder stehen", async () => {
    await admin.client`
      insert into parent_account (id, auth_user_id, email, name)
      values ('aa110000-0000-4000-8000-00000000000d', gen_random_uuid(), 'weg@example.test', 'Weg')`;
    await admin.client`delete from parent_account where id = 'aa110000-0000-4000-8000-00000000000d'`;

    const kinder = await admin.client`select 1 from student where id in (${S.mia}, ${S.ben})`;
    expect(kinder).toHaveLength(2);
  });

  test("das Löschen eines Kindes nimmt seine Verknüpfung mit, nicht die des Geschwisters", async () => {
    await admin.client`
      insert into student (id, first_name, grade_level, parent_email)
      values ('bb110000-0000-4000-8000-00000000000d', 'Weg', 9, ${P.mailOne})`;
    await admin.client`
      insert into parent_student (parent_account_id, student_id)
      values (${P.one}, 'bb110000-0000-4000-8000-00000000000d')`;
    await admin.client`delete from student where id = 'bb110000-0000-4000-8000-00000000000d'`;

    const verbleibend = await admin.client<{ student_id: string }[]>`
      select student_id from parent_student where parent_account_id = ${P.one} order by student_id`;
    expect(verbleibend.map((r) => r.student_id).sort()).toEqual([S.mia, S.ben].sort());
  });
});
