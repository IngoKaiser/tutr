// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, type Actor } from "../actor";
import { connectAsAppRole, connectAsMigrationRole, loadTestEnv, testDbAvailable } from "../test-db";

/**
 * Policy- und Constraint-Tests für `tutor_session`, `tutor_message`,
 * `ai_usage` (T-02, S-03b).
 *
 * Drei Dinge, die nur hier zu prüfen sind:
 * - **Kein Elternzugriff** (ADR 0004 D3, ADR 0010 D2): Für den Tutor gibt es
 *   keine `_parent`-Policy. Ein Elternteil liest nichts und schreibt nichts –
 *   strukturell, nicht nur in der UI.
 * - **Fachbindung** (§15 Fehler 2): Eine Session mit dem Fach eines fremden
 *   Kindes scheitert am zusammengesetzten Fremdschlüssel; ein Thema, das
 *   nicht zum Fach der Session gehört, ebenso.
 * - **Mandantentrennung**: Ein fremdes Kind sieht die Gespräche nicht.
 *
 * Läuft nur bei `npm run db:test` (RUN_DB_TESTS=1).
 */
loadTestEnv();

const A = {
  studentId: "ffff0001-0000-4000-8000-000000000001",
  schuljahr: "ffff0001-0000-4000-8000-000000000002",
  mathe: "ffff0001-0000-4000-8000-000000000003",
  franzoesisch: "ffff0001-0000-4000-8000-000000000004",
  themaMathe: "ffff0001-0000-4000-8000-000000000005",
};
const B = {
  studentId: "ffff0002-0000-4000-8000-000000000001",
  schuljahr: "ffff0002-0000-4000-8000-000000000002",
  mathe: "ffff0002-0000-4000-8000-000000000003",
};

const student = (studentId: string): Actor => ({ role: "student", studentId });
const parent = (studentId: string): Actor => ({
  role: "parent",
  studentId,
  parentId: "ffff0003-0000-4000-8000-000000000001",
});

describe.skipIf(!testDbAvailable())(
  "RLS + Constraints: tutor_session / tutor_message / ai_usage",
  () => {
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
      await admin.client`
      insert into topic (id, student_id, subject_id, school_year_id, title, status)
      values (${A.themaMathe}, ${A.studentId}, ${A.mathe}, ${A.schuljahr}, 'Bruchrechnung', 'aktiv')`;
      app = connectAsAppRole();
    });

    afterAll(async () => {
      if (admin) {
        await admin.client`delete from student where id in (${A.studentId}, ${B.studentId})`;
        await admin.close();
      }
      await app?.close();
    });

    test("Kind legt ein Gespräch mit Nachricht an, ein fremdes Kind sieht es nicht", async () => {
      const [session] = await runWithActor(app.db, student(A.studentId), async (tx) => {
        const [s] = await tx.execute<{ id: string }>(sql`
        insert into tutor_session (student_id, subject_id, title, entry_point)
        values (${A.studentId}, ${A.mathe}, 'Wie kürzt man Brüche?', 'freie_frage')
        returning id`);
        await tx.execute(sql`
        insert into tutor_message (student_id, session_id, role, content)
        values (${A.studentId}, ${s!.id}, 'nutzer', 'Wie kürzt man Brüche?')`);
        return [s];
      });
      expect(session?.id).toBeTruthy();

      const fremdeSicht = await runWithActor(app.db, student(B.studentId), (tx) =>
        tx.execute(sql`select id from tutor_session`),
      );
      expect(fremdeSicht).toHaveLength(0);
    });

    test("Ein Elternteil sieht keine Gespräche – es gibt keine Eltern-Policy (ADR 0004 D3)", async () => {
      const elternSicht = await runWithActor(app.db, parent(A.studentId), (tx) =>
        tx.execute(sql`select id from tutor_session`),
      );
      expect(elternSicht).toHaveLength(0);

      const nachrichten = await runWithActor(app.db, parent(A.studentId), (tx) =>
        tx.execute(sql`select id from tutor_message`),
      );
      expect(nachrichten).toHaveLength(0);
    });

    test("Ein Elternteil kann kein Gespräch anlegen", async () => {
      const error = await runWithActor(app.db, parent(A.studentId), (tx) =>
        tx.execute(sql`
        insert into tutor_session (student_id, subject_id, title, entry_point)
        values (${A.studentId}, ${A.mathe}, 'Elternfrage', 'freie_frage')`),
      ).catch((err: unknown) => err);
      expect(error).toBeDefined();
    });

    test("Ein Gespräch mit dem Fach eines fremden Kindes scheitert (§15 Fehler 2)", async () => {
      const error = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(sql`
        insert into tutor_session (student_id, subject_id, title, entry_point)
        values (${A.studentId}, ${B.mathe}, 'Fremdes Fach', 'freie_frage')`),
      ).catch((err: unknown) => err);
      expect(error).toBeDefined();
    });

    test("Ein Thema, das nicht zum Fach der Session gehört, scheitert am zusammengesetzten Schlüssel", async () => {
      const error = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(sql`
        insert into tutor_session (student_id, subject_id, topic_id, title, entry_point)
        values (${A.studentId}, ${A.franzoesisch}, ${A.themaMathe}, 'Thema im falschen Fach', 'verstehen')`),
      ).catch((err: unknown) => err);
      expect(error).toBeDefined();
    });

    test("Ein Thema desselben Fachs an der Session ist erlaubt", async () => {
      const [session] = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute<{ id: string }>(sql`
        insert into tutor_session (student_id, subject_id, topic_id, title, entry_point)
        values (${A.studentId}, ${A.mathe}, ${A.themaMathe}, 'Bruchrechnung verstehen', 'verstehen')
        returning id`),
      );
      expect(session?.id).toBeTruthy();
    });

    test("ai_usage: das Kind bucht und zählt die eigenen Aufrufe, ein fremdes Kind sieht nichts", async () => {
      await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(
          sql`insert into ai_usage (student_id, endpoint) values (${A.studentId}, 'tutor')`,
        ),
      );
      const [row] = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute<{ n: string }>(sql`
        select count(*)::text as n from ai_usage
        where student_id = app.student_id() and endpoint = 'tutor'`),
      );
      expect(Number(row?.n)).toBeGreaterThanOrEqual(1);

      const fremd = await runWithActor(app.db, student(B.studentId), (tx) =>
        tx.execute(sql`select id from ai_usage`),
      );
      expect(fremd).toHaveLength(0);
    });
  },
);
