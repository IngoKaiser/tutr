// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, type Actor } from "../actor";
import { connectAsAppRole, connectAsMigrationRole, loadTestEnv, testDbAvailable } from "../test-db";

/**
 * Policy- und Constraint-Tests für school_year, subject, topic,
 * learning_objective, objective_prerequisite (F-04c).
 *
 * Zwei Fächer für Kind A ermöglichen den zentralen Test: eine Prüfung/ein
 * Kalender-Event darf nur Themen ihres eigenen Fachs verknüpfen (§15 Fehler
 * 2) – hier direkt am Insert von topic geprüft, weil topic selbst schon die
 * (subject_id, student_id)-Bindung trägt.
 *
 * Mandant ist seit ADR 0006 das Kind; eine Familienspalte gibt es nicht mehr.
 *
 * Läuft nur bei `npm run db:test` (RUN_DB_TESTS=1).
 */
loadTestEnv();

const A = {
  studentId: "cccccccc-0000-4000-8000-000000000002",
  mathe: "cccccccc-0000-4000-8000-000000000003",
  franzoesisch: "cccccccc-0000-4000-8000-000000000004",
  schuljahr: "cccccccc-0000-4000-8000-000000000005",
};
const B = {
  studentId: "dddddddd-0000-4000-8000-000000000002",
  mathe: "dddddddd-0000-4000-8000-000000000003",
  schuljahr: "dddddddd-0000-4000-8000-000000000004",
};

const student = (studentId: string): Actor => ({ role: "student", studentId });
const parent = (studentId: string): Actor => ({
  role: "parent",
  studentId,
  parentId: "eeeeeeee-0000-4000-8000-000000000001",
});

describe.skipIf(!testDbAvailable())(
  "RLS + Constraints: school_year, subject, topic, learning_objective",
  () => {
    let app: ReturnType<typeof connectAsAppRole>;
    let admin: ReturnType<typeof connectAsMigrationRole>;

    beforeAll(async () => {
      admin = connectAsMigrationRole();
      await admin.client`delete from student where id in (${A.studentId}, ${B.studentId})`;
      await admin.client`
      insert into student (id, first_name, grade_level) values
        (${A.studentId}, 'Kind A', 8),
        (${B.studentId}, 'Kind B', 8)`;
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

    test("Fachbindung (§15 Fehler 2): topic mit dem Fach eines fremden Kindes scheitert an der DB", async () => {
      const error = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(sql`
        insert into topic (student_id, subject_id, school_year_id, title, status)
        values (${A.studentId}, ${B.mathe}, ${A.schuljahr}, 'Fremdes Fach', 'aktiv')
      `),
      ).catch((err: unknown) => err);
      expect(error).toBeDefined();
    });

    test("Ein aktives Schuljahr pro Schüler: zweites 'aktiv' scheitert am partiellen Unique-Index", async () => {
      const error = await runWithActor(app.db, parent(A.studentId), (tx) =>
        tx.execute(sql`
        insert into school_year (student_id, label, grade_level, start_date, end_date, status)
        values (${A.studentId}, 'Zweites aktives Jahr', 9, '2027-08-01', '2028-07-31', 'aktiv')
      `),
      ).catch((err: unknown) => err);
      expect(error).toBeDefined();

      const rows = await admin.client<{ n: string }[]>`
      select count(*)::text as n from school_year where student_id = ${A.studentId} and status = 'aktiv'`;
      expect(rows[0]?.n).toBe("1");
    });

    test("Ein zweites 'geplant'-Schuljahr ist erlaubt (Sommer-Assistent, nur 'aktiv' ist begrenzt)", async () => {
      await runWithActor(app.db, parent(A.studentId), (tx) =>
        tx.execute(sql`
        insert into school_year (student_id, label, grade_level, start_date, end_date, status)
        values (${A.studentId}, '2027/28 (geplant)', 9, '2027-08-01', '2028-07-31', 'geplant')
      `),
      );
      const rows = await admin.client<{ n: string }[]>`
      select count(*)::text as n from school_year where student_id = ${A.studentId}`;
      expect(rows[0]?.n).toBe("2");
    });

    test("own_groups (K-02a, ADR 0016 D3): bleibt NULL ohne eigene Angabe, akzeptiert ein Array", async () => {
      const [ohneAngabe] = await admin.client<{ own_groups: string[] | null }[]>`
      select own_groups from school_year where id = ${A.schuljahr}`;
      expect(ohneAngabe?.own_groups).toBeNull();

      await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(sql`
        update school_year set own_groups = array['8.5', '8.5 Eng', '8.5 Mat']
        where id = ${A.schuljahr}`),
      );
      const [gesetzt] = await admin.client<{ own_groups: string[] }[]>`
      select own_groups from school_year where id = ${A.schuljahr}`;
      expect(gesetzt?.own_groups).toEqual(["8.5", "8.5 Eng", "8.5 Mat"]);
    });

    test("Elternteil sieht Fächer und Schuljahr, ändert aber kein Thema", async () => {
      const [topicRow] = await admin.client<{ id: string }[]>`
      insert into topic (student_id, subject_id, school_year_id, title, status)
      values (${A.studentId}, ${A.mathe}, ${A.schuljahr}, 'Bruchrechnung', 'aktiv')
      returning id`;

      const sicht = await runWithActor(app.db, parent(A.studentId), async (tx) => ({
        faecher: await tx.execute<{ name: string }>(sql`select name from subject order by name`),
        themen: await tx.execute<{ title: string }>(sql`select title from topic`),
      }));
      expect(sicht.faecher.map((r) => r.name)).toEqual(["Französisch", "Mathematik"]);
      expect(sicht.themen.map((r) => r.title)).toEqual(["Bruchrechnung"]);

      await runWithActor(app.db, parent(A.studentId), (tx) =>
        tx.execute(sql`update topic set title = 'Umbenannt' where id = ${topicRow!.id}`),
      );
      const [row] = await admin.client<{ title: string }[]>`
      select title from topic where id = ${topicRow!.id}`;
      expect(row!.title).toBe("Bruchrechnung");
      // Kein manuelles Aufräumen hier: learning_objective -> topic ist
      // on-delete-restrict (Lernhistorie darf nicht mit dem Thema
      // verschwinden). afterAll räumt über das Kind kaskadierend auf.
    });

    test("Kind kann eigenes Thema mit Lernziel und Vorläufer anlegen", async () => {
      const ids = await runWithActor(app.db, student(A.studentId), async (tx) => {
        const [t] = await tx.execute<{ id: string }>(sql`
        insert into topic (student_id, subject_id, school_year_id, title, status)
        values (${A.studentId}, ${A.mathe}, ${A.schuljahr}, 'Quadratische Gleichungen', 'aktiv')
        returning id`);
        const [vorlaeufer] = await tx.execute<{ id: string }>(sql`
        insert into learning_objective (student_id, topic_id, title)
        values (${A.studentId}, ${t!.id}, 'Lineare Gleichungen lösen')
        returning id`);
        const [ziel] = await tx.execute<{ id: string }>(sql`
        insert into learning_objective (student_id, topic_id, title)
        values (${A.studentId}, ${t!.id}, 'Quadratische Gleichungen lösen')
        returning id`);
        await tx.execute(sql`
        insert into objective_prerequisite (student_id, objective_id, prerequisite_objective_id)
        values (${A.studentId}, ${ziel!.id}, ${vorlaeufer!.id})`);
        return { topicId: t!.id, vorlaeuferId: vorlaeufer!.id, zielId: ziel!.id };
      });

      const rows = await admin.client<{ title: string }[]>`
      select lo.title from objective_prerequisite op
      join learning_objective lo on lo.id = op.prerequisite_objective_id
      where op.objective_id = ${ids.zielId}`;
      expect(rows.map((r) => r.title)).toEqual(["Lineare Gleichungen lösen"]);
    });

    test("Ein Lernziel kann nicht sein eigener Vorläufer sein", async () => {
      const error = await runWithActor(app.db, student(A.studentId), async (tx) => {
        const [t] = await tx.execute<{ id: string }>(sql`
        insert into topic (student_id, subject_id, school_year_id, title, status)
        values (${A.studentId}, ${A.mathe}, ${A.schuljahr}, 'Selbstbezug-Test', 'aktiv')
        returning id`);
        const [ziel] = await tx.execute<{ id: string }>(sql`
        insert into learning_objective (student_id, topic_id, title)
        values (${A.studentId}, ${t!.id}, 'Zirkulär')
        returning id`);
        await tx.execute(sql`
        insert into objective_prerequisite (student_id, objective_id, prerequisite_objective_id)
        values (${A.studentId}, ${ziel!.id}, ${ziel!.id})`);
      }).catch((err: unknown) => err);
      expect(error).toBeDefined();
    });

    test("Ein fremdes Kind sieht weder Fächer noch Schuljahr des anderen", async () => {
      const rows = await runWithActor(app.db, student(B.studentId), (tx) =>
        tx.execute<{ name: string }>(sql`select name from subject`),
      );
      expect(rows.map((r) => r.name)).toEqual(["Mathematik"]);
    });

    // --- ADR 0009 D1: das Kind legt Fach und Schuljahr selbst an ---

    test("Kind legt eigenes Fach und Schuljahr selbst an – ohne Elternteil (ADR 0009 D1)", async () => {
      const angelegt = await runWithActor(app.db, student(A.studentId), async (tx) => {
        const [jahr] = await tx.execute<{ id: string }>(sql`
          insert into school_year (student_id, label, grade_level, start_date, end_date, status)
          values (${A.studentId}, '2027/28 (Kind-Anlage)', 9, '2027-08-01', '2028-07-31', 'geplant')
          returning id`);
        const [fach] = await tx.execute<{ id: string }>(sql`
          insert into subject (student_id, name) values (${A.studentId}, 'Spanisch')
          returning id`);
        return { jahrId: jahr!.id, fachId: fach!.id };
      });
      expect(angelegt.jahrId).toBeTruthy();
      expect(angelegt.fachId).toBeTruthy();

      // Aufräumen, damit der partielle Unique-Index (nur ein 'aktiv') und
      // die übrigen Tests unberührt bleiben – afterAll räumt erst am Ende.
      await admin.client`delete from school_year where id = ${angelegt.jahrId}`;
      await admin.client`delete from subject where id = ${angelegt.fachId}`;
    });

    test("Ein Kind kann kein Fach für ein fremdes Kind anlegen", async () => {
      const error = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(
          sql`insert into subject (student_id, name) values (${B.studentId}, 'Fremdes Fach')`,
        ),
      ).catch((err: unknown) => err);
      expect(error).toBeDefined();
    });

    test("Ein Elternteil legt weiterhin ein Fach an – ADR 0009 D1 ändert nur die Kind-Richtung", async () => {
      const [fach] = await runWithActor(app.db, parent(A.studentId), (tx) =>
        tx.execute<{ id: string }>(sql`
          insert into subject (student_id, name) values (${A.studentId}, 'Kunst') returning id`),
      );
      expect(fach?.id).toBeTruthy();
      await admin.client`delete from subject where id = ${fach!.id}`;
    });

    // --- ADR 0009 D2: welche Fächer in einem Schuljahr laufen ---

    test("Kind ordnet ein Fach dem eigenen Schuljahr zu, Elternteil sieht die Zuordnung", async () => {
      await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(sql`
          insert into school_year_subject (student_id, school_year_id, subject_id)
          values (${A.studentId}, ${A.schuljahr}, ${A.franzoesisch})`),
      );
      const gesehen = await runWithActor(app.db, parent(A.studentId), (tx) =>
        tx.execute<{ n: string }>(sql`
          select count(*)::text as n from school_year_subject
          where school_year_id = ${A.schuljahr} and subject_id = ${A.franzoesisch}`),
      );
      expect(gesehen[0]?.n).toBe("1");
    });

    test("Ein Fach lässt sich nicht dem Schuljahr eines fremden Kindes zuordnen", async () => {
      const error = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(sql`
          insert into school_year_subject (student_id, school_year_id, subject_id)
          values (${A.studentId}, ${B.schuljahr}, ${A.franzoesisch})`),
      ).catch((err: unknown) => err);
      expect(error).toBeDefined();
    });

    test("Ein fremdes Kind sieht die Zuordnung des anderen nicht", async () => {
      const rows = await runWithActor(app.db, student(B.studentId), (tx) =>
        tx.execute(sql`select 1 from school_year_subject`),
      );
      expect(rows).toHaveLength(0);
    });
  },
);
