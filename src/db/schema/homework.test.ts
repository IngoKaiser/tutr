// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, type Actor } from "../actor";
import { connectAsAppRole, connectAsMigrationRole, loadTestEnv, testDbAvailable } from "../test-db";

/**
 * Policy- und Constraint-Tests für `homework_task` (T-03).
 *
 * Der wichtigste Test ist der zweite: **Eltern sehen nichts.** Das ist die
 * Umsetzung von [ADR 0012](../../../docs/adr/0012-eltern-sehen-was-nicht-wie-gut.md)
 * D3 und weicht bewusst von ADR 0004 D4 ab, wo `homework_task` noch als
 * „Eltern lesen Status/Zeit“ stand. Ohne diesen Test würde eine spätere
 * `_parent`-Policy unbemerkt durchrutschen.
 *
 * Läuft nur bei `npm run db:test` (RUN_DB_TESTS=1).
 */
loadTestEnv();

const A = {
  studentId: "aaaa0001-0000-4000-8000-000000000001",
  schuljahr: "aaaa0001-0000-4000-8000-000000000002",
  mathe: "aaaa0001-0000-4000-8000-000000000003",
};
const B = {
  studentId: "aaaa0002-0000-4000-8000-000000000001",
  schuljahr: "aaaa0002-0000-4000-8000-000000000002",
  mathe: "aaaa0002-0000-4000-8000-000000000003",
};

const student = (studentId: string): Actor => ({ role: "student", studentId });
const parent = (studentId: string): Actor => ({
  role: "parent",
  studentId,
  parentId: "aaaa0003-0000-4000-8000-000000000001",
});

describe.skipIf(!testDbAvailable())("RLS + Constraints: homework_task", () => {
  let app: ReturnType<typeof connectAsAppRole>;
  let admin: ReturnType<typeof connectAsMigrationRole>;
  let sessionA = "";

  beforeAll(async () => {
    admin = connectAsMigrationRole();
    await admin.client`delete from student where id in (${A.studentId}, ${B.studentId})`;
    await admin.client`
      insert into student (id, first_name, grade_level) values
        (${A.studentId}, 'Kind A', 8), (${B.studentId}, 'Kind B', 8)`;
    await admin.client`
      insert into school_year (id, student_id, label, grade_level, start_date, end_date, status)
      values
        (${A.schuljahr}, ${A.studentId}, '2026/27', 8, '2026-08-01', '2027-07-31', 'aktiv'),
        (${B.schuljahr}, ${B.studentId}, '2026/27', 8, '2026-08-01', '2027-07-31', 'aktiv')`;
    await admin.client`
      insert into subject (id, student_id, name) values
        (${A.mathe}, ${A.studentId}, 'Mathematik'),
        (${B.mathe}, ${B.studentId}, 'Mathematik')`;
    const [s] = await admin.client<{ id: string }[]>`
      insert into tutor_session (student_id, subject_id, title, entry_point)
      values (${A.studentId}, ${A.mathe}, 'Hausaufgabe S. 114', 'hausaufgabe')
      returning id`;
    sessionA = s!.id;
    app = connectAsAppRole();
  });

  afterAll(async () => {
    if (admin) {
      await admin.client`delete from student where id in (${A.studentId}, ${B.studentId})`;
      await admin.close();
    }
    await app?.close();
  });

  test("Das Kind legt Aufgaben an und liest sie wieder", async () => {
    await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute(sql`
        insert into homework_task (student_id, session_id, position, label, prompt) values
          (${A.studentId}, ${sessionA}, 1, '5a', 'Loese 3x + 5 = 20'),
          (${A.studentId}, ${sessionA}, 2, '5b', 'Loese 4x - 2 = 10')`),
    );

    const eigene = await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute<{ position: number }>(sql`select position from homework_task order by position`),
    );
    expect(eigene).toHaveLength(2);
  });

  test("Ein Elternteil sieht keine Aufgaben – es gibt keine Eltern-Policy (ADR 0012 D3)", async () => {
    const elternSicht = await runWithActor(app.db, parent(A.studentId), (tx) =>
      tx.execute(sql`select id from homework_task`),
    );
    expect(elternSicht).toHaveLength(0);
  });

  test("Ein Elternteil kann auch nichts schreiben", async () => {
    const error = await runWithActor(app.db, parent(A.studentId), (tx) =>
      tx.execute(sql`
        insert into homework_task (student_id, session_id, position, prompt)
        values (${A.studentId}, ${sessionA}, 99, 'Elternaufgabe')`),
    ).catch((err: unknown) => err);
    expect(error).toBeDefined();
  });

  test("Ein fremdes Kind sieht nichts", async () => {
    const fremd = await runWithActor(app.db, student(B.studentId), (tx) =>
      tx.execute(sql`select id from homework_task`),
    );
    expect(fremd).toHaveLength(0);
  });

  test("Eine Aufgabe an der Sitzung eines fremden Kindes scheitert am Schlüssel", async () => {
    const error = await runWithActor(app.db, student(B.studentId), (tx) =>
      tx.execute(sql`
        insert into homework_task (student_id, session_id, position, prompt)
        values (${B.studentId}, ${sessionA}, 1, 'Fremde Sitzung')`),
    ).catch((err: unknown) => err);
    expect(error).toBeDefined();
  });

  test("Zwei Aufgaben auf derselben Position in einer Sitzung gehen nicht", async () => {
    const error = await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute(sql`
        insert into homework_task (student_id, session_id, position, prompt)
        values (${A.studentId}, ${sessionA}, 1, 'Doppelte Position')`),
    ).catch((err: unknown) => err);
    expect(error).toBeDefined();
  });

  test("Versuche und Hinweisstufe lassen sich fortschreiben – der Zustand lebt hier, nicht im Modell", async () => {
    await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute(sql`
        update homework_task set attempts = 2, hint_level = 3, status = 'loesung_gezeigt'
        where session_id = ${sessionA} and position = 1`),
    );
    const [zeile] = await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute<{ attempts: number; hint_level: number; status: string }>(sql`
        select attempts, hint_level, status from homework_task
        where session_id = ${sessionA} and position = 1`),
    );
    expect(zeile?.attempts).toBe(2);
    expect(zeile?.hint_level).toBe(3);
    expect(zeile?.status).toBe("loesung_gezeigt");
  });

  test("Wird die Sitzung gelöscht, gehen die Aufgaben mit", async () => {
    await admin.client`delete from tutor_session where id = ${sessionA}`;
    const [rest] = await admin.client<{ n: string }[]>`
      select count(*)::text as n from homework_task where session_id = ${sessionA}`;
    expect(Number(rest?.n)).toBe(0);
  });
});
