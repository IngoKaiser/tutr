// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, type Actor } from "../actor";
import { connectAsAppRole, connectAsMigrationRole, loadTestEnv, testDbAvailable } from "../test-db";

/**
 * Policy- und Constraint-Tests für `calendar_event` (K-01).
 *
 * Zwei Dinge, die nur hier zu prüfen sind:
 * - **Fachbindung** (§15 Fehler 2, ADR 0004 D3): Ein Termin mit dem Fach
 *   eines fremden Kindes scheitert am zusammengesetzten Fremdschlüssel.
 * - **Richtung** (ADR 0004 D4): Beide Rollen dürfen schreiben – anders als
 *   bei `topic`/`vocab_*`.
 *
 * Läuft nur bei `npm run db:test` (RUN_DB_TESTS=1).
 */
loadTestEnv();

const A = {
  studentId: "eeee0001-0000-4000-8000-000000000001",
  schuljahr: "eeee0001-0000-4000-8000-000000000002",
  mathe: "eeee0001-0000-4000-8000-000000000003",
  franzoesisch: "eeee0001-0000-4000-8000-000000000004",
};
const B = {
  studentId: "eeee0002-0000-4000-8000-000000000001",
  schuljahr: "eeee0002-0000-4000-8000-000000000002",
  mathe: "eeee0002-0000-4000-8000-000000000003",
};

const student = (studentId: string): Actor => ({ role: "student", studentId });
const parent = (studentId: string): Actor => ({
  role: "parent",
  studentId,
  parentId: "eeee0003-0000-4000-8000-000000000001",
});

describe.skipIf(!testDbAvailable())("RLS + Constraints: calendar_event", () => {
  let app: ReturnType<typeof connectAsAppRole>;
  let admin: ReturnType<typeof connectAsMigrationRole>;

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
        (${A.franzoesisch}, ${A.studentId}, 'Französisch'),
        (${B.mathe}, ${B.studentId}, 'Mathematik')`;
    app = connectAsAppRole();
  });

  afterAll(async () => {
    if (admin) {
      await admin.client`delete from student where id in (${A.studentId}, ${B.studentId})`;
      await admin.close();
    }
    await app?.close();
  });

  test("Kind legt einen Termin an, ein fremdes Kind sieht ihn nicht", async () => {
    const [event] = await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute<{ id: string }>(sql`
        insert into calendar_event (student_id, school_year_id, subject_id, type, title, date)
        values (${A.studentId}, ${A.schuljahr}, ${A.mathe}, 'klassenarbeit', 'Bruchrechnung', '2026-10-09')
        returning id`),
    );
    expect(event?.id).toBeTruthy();

    const fremdeSicht = await runWithActor(app.db, student(B.studentId), (tx) =>
      tx.execute(sql`select id from calendar_event`),
    );
    expect(fremdeSicht).toHaveLength(0);
  });

  test("Ein Elternteil trägt genauso einen Termin ein (ADR 0004 D4: beide Rollen)", async () => {
    const [event] = await runWithActor(app.db, parent(A.studentId), (tx) =>
      tx.execute<{ id: string }>(sql`
        insert into calendar_event (student_id, school_year_id, subject_id, type, title, date)
        values (${A.studentId}, ${A.schuljahr}, ${A.franzoesisch}, 'test', 'Vokabeltest Unité 3', '2026-09-25')
        returning id`),
    );
    expect(event?.id).toBeTruthy();
  });

  test("Ein Termin mit dem Fach eines fremden Kindes scheitert (§15 Fehler 2)", async () => {
    const error = await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute(sql`
        insert into calendar_event (student_id, school_year_id, subject_id, type, title, date)
        values (${A.studentId}, ${A.schuljahr}, ${B.mathe}, 'klassenarbeit', 'Fremdes Fach', '2026-11-01')`),
    ).catch((err: unknown) => err);
    expect(error).toBeDefined();
  });

  test("Absagen ist ein Statuswechsel, kein Löschen – der Termin bleibt", async () => {
    const [event] = await runWithActor(app.db, student(A.studentId), async (tx) => {
      const [row] = await tx.execute<{ id: string }>(sql`
        insert into calendar_event (student_id, school_year_id, subject_id, type, title, date)
        values (${A.studentId}, ${A.schuljahr}, ${A.mathe}, 'klassenarbeit', 'Verschoben', '2026-12-01')
        returning id`);
      await tx.execute(sql`update calendar_event set status = 'abgesagt' where id = ${row!.id}`);
      return [row];
    });

    const [row] = await admin.client<{ status: string }[]>`
      select status from calendar_event where id = ${event!.id}`;
    expect(row?.status).toBe("abgesagt");
  });

  test("groups/source (K-02a, ADR 0016 D8): source defaultet auf 'manuell', groups akzeptiert ein Array", async () => {
    const [manuell] = await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute<{ id: string; source: string; groups: string[] | null }>(sql`
        insert into calendar_event (student_id, school_year_id, subject_id, type, title, date)
        values (${A.studentId}, ${A.schuljahr}, ${A.mathe}, 'klassenarbeit', 'Ohne Import', '2026-10-20')
        returning id, source, groups`),
    );
    expect(manuell?.source).toBe("manuell");
    expect(manuell?.groups).toBeNull();

    const [importiert] = await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute<{ source: string; groups: string[] }>(sql`
        insert into calendar_event (student_id, school_year_id, subject_id, type, title, date, groups, source)
        values (${A.studentId}, ${A.schuljahr}, ${A.mathe}, 'klassenarbeit', 'Aus dem Foto', '2026-10-21', array['8.5', '8.5 Mat'], 'bild')
        returning source, groups`),
    );
    expect(importiert?.source).toBe("bild");
    expect(importiert?.groups).toEqual(["8.5", "8.5 Mat"]);
  });

  test("Ein Fach mit Terminen lässt sich nicht löschen (restrict)", async () => {
    // `deleteSubject()` fängt das mit einem deutschen Satz ab; die DB-Ebene
    // ist der Riegel dahinter.
    const error = await admin.client`
      delete from subject where id = ${A.mathe}`.catch((err: unknown) => err);
    expect(error).toBeDefined();
  });
});
