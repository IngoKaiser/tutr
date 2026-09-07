// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, type Actor } from "../actor";
import { connectAsAppRole, connectAsMigrationRole, loadTestEnv, testDbAvailable } from "../test-db";

/**
 * Policy- und Constraint-Tests für school_year, subject, topic,
 * learning_objective, objective_prerequisite (F-04c).
 *
 * Zwei Fächer für Familie A ermöglichen den zentralen Test: eine Prüfung/ein
 * Kalender-Event darf nur Themen ihres eigenen Fachs verknüpfen (§15 Fehler
 * 2) – hier direkt am Insert von topic geprüft, weil topic selbst schon die
 * (subject_id, student_id)-Bindung trägt.
 *
 * Läuft nur bei `npm run db:test` (RUN_DB_TESTS=1).
 */
loadTestEnv();

const A = {
  family: "cccccccc-0000-4000-8000-000000000001",
  kind: "cccccccc-0000-4000-8000-000000000002",
  mathe: "cccccccc-0000-4000-8000-000000000003",
  franzoesisch: "cccccccc-0000-4000-8000-000000000004",
  schuljahr: "cccccccc-0000-4000-8000-000000000005",
};
const B = {
  family: "dddddddd-0000-4000-8000-000000000001",
  kind: "dddddddd-0000-4000-8000-000000000002",
  mathe: "dddddddd-0000-4000-8000-000000000003",
  schuljahr: "dddddddd-0000-4000-8000-000000000004",
};

const kind = (familyId: string, studentId: string): Actor => ({
  role: "student",
  familyId,
  studentId,
});
const elternteil = (familyId: string): Actor => ({
  role: "parent",
  familyId,
  userId: "eeeeeeee-0000-4000-8000-000000000001",
});

describe.skipIf(!testDbAvailable())(
  "RLS + Constraints: school_year, subject, topic, learning_objective",
  () => {
    let app: ReturnType<typeof connectAsAppRole>;
    let admin: ReturnType<typeof connectAsMigrationRole>;

    beforeAll(async () => {
      admin = connectAsMigrationRole();
      await admin.client`delete from family where id in (${A.family}, ${B.family})`;
      await admin.client`
      insert into family (id, name) values (${A.family}, 'Familie A'), (${B.family}, 'Familie B')`;
      await admin.client`
      insert into student (id, family_id, first_name, grade_level) values
        (${A.kind}, ${A.family}, 'Kind A', 8),
        (${B.kind}, ${B.family}, 'Kind B', 8)`;
      await admin.client`
      insert into school_year (id, family_id, student_id, label, grade_level, start_date, end_date, status)
      values
        (${A.schuljahr}, ${A.family}, ${A.kind}, '2026/27', 8, '2026-08-01', '2027-07-31', 'aktiv'),
        (${B.schuljahr}, ${B.family}, ${B.kind}, '2026/27', 8, '2026-08-01', '2027-07-31', 'aktiv')`;
      await admin.client`
      insert into subject (id, family_id, student_id, name) values
        (${A.mathe}, ${A.family}, ${A.kind}, 'Mathematik'),
        (${A.franzoesisch}, ${A.family}, ${A.kind}, 'Französisch'),
        (${B.mathe}, ${B.family}, ${B.kind}, 'Mathematik')`;
      app = connectAsAppRole();
    });

    afterAll(async () => {
      if (admin) {
        await admin.client`delete from family where id in (${A.family}, ${B.family})`;
        await admin.close();
      }
      await app?.close();
    });

    test("Fachbindung (§15 Fehler 2): topic mit Fach einer fremden Familie scheitert an der DB", async () => {
      const fehler = await runWithActor(app.db, kind(A.family, A.kind), (tx) =>
        tx.execute(sql`
        insert into topic (family_id, student_id, subject_id, school_year_id, title, status)
        values (${A.family}, ${A.kind}, ${B.mathe}, ${A.schuljahr}, 'Fremdes Fach', 'aktiv')
      `),
      ).catch((err: unknown) => err);
      expect(fehler).toBeDefined();
    });

    test("Ein aktives Schuljahr pro Schüler: zweites 'aktiv' scheitert am partiellen Unique-Index", async () => {
      const fehler = await runWithActor(app.db, elternteil(A.family), (tx) =>
        tx.execute(sql`
        insert into school_year (family_id, student_id, label, grade_level, start_date, end_date, status)
        values (${A.family}, ${A.kind}, 'Zweites aktives Jahr', 9, '2027-08-01', '2028-07-31', 'aktiv')
      `),
      ).catch((err: unknown) => err);
      expect(fehler).toBeDefined();

      const rows = await admin.client<{ n: string }[]>`
      select count(*)::text as n from school_year where student_id = ${A.kind} and status = 'aktiv'`;
      expect(rows[0]?.n).toBe("1");
    });

    test("Ein zweites 'geplant'-Schuljahr ist erlaubt (Sommer-Assistent, nur 'aktiv' ist begrenzt)", async () => {
      await runWithActor(app.db, elternteil(A.family), (tx) =>
        tx.execute(sql`
        insert into school_year (family_id, student_id, label, grade_level, start_date, end_date, status)
        values (${A.family}, ${A.kind}, '2027/28 (geplant)', 9, '2027-08-01', '2028-07-31', 'geplant')
      `),
      );
      const rows = await admin.client<{ n: string }[]>`
      select count(*)::text as n from school_year where student_id = ${A.kind}`;
      expect(rows[0]?.n).toBe("2");
    });

    test("Elternteil sieht Fächer und Schuljahr, ändert aber kein Thema", async () => {
      const [topicRow] = await admin.client<{ id: string }[]>`
      insert into topic (family_id, student_id, subject_id, school_year_id, title, status)
      values (${A.family}, ${A.kind}, ${A.mathe}, ${A.schuljahr}, 'Bruchrechnung', 'aktiv')
      returning id`;

      const sicht = await runWithActor(app.db, elternteil(A.family), async (tx) => ({
        faecher: await tx.execute<{ name: string }>(sql`select name from subject order by name`),
        themen: await tx.execute<{ title: string }>(sql`select title from topic`),
      }));
      expect(sicht.faecher.map((r) => r.name)).toEqual(["Französisch", "Mathematik"]);
      expect(sicht.themen.map((r) => r.title)).toEqual(["Bruchrechnung"]);

      await runWithActor(app.db, elternteil(A.family), (tx) =>
        tx.execute(sql`update topic set title = 'Umbenannt' where id = ${topicRow!.id}`),
      );
      const [row] = await admin.client<{ title: string }[]>`
      select title from topic where id = ${topicRow!.id}`;
      expect(row!.title).toBe("Bruchrechnung");
      // Kein manuelles Aufräumen hier: learning_objective -> topic ist
      // on-delete-restrict (Lernhistorie darf nicht mit dem Thema
      // verschwinden). afterAll räumt über die Familie kaskadierend auf.
    });

    test("Kind kann eigenes Thema mit Lernziel und Vorläufer anlegen", async () => {
      const ids = await runWithActor(app.db, kind(A.family, A.kind), async (tx) => {
        const [t] = await tx.execute<{ id: string }>(sql`
        insert into topic (family_id, student_id, subject_id, school_year_id, title, status)
        values (${A.family}, ${A.kind}, ${A.mathe}, ${A.schuljahr}, 'Quadratische Gleichungen', 'aktiv')
        returning id`);
        const [vorlaeufer] = await tx.execute<{ id: string }>(sql`
        insert into learning_objective (family_id, student_id, topic_id, title)
        values (${A.family}, ${A.kind}, ${t!.id}, 'Lineare Gleichungen lösen')
        returning id`);
        const [ziel] = await tx.execute<{ id: string }>(sql`
        insert into learning_objective (family_id, student_id, topic_id, title)
        values (${A.family}, ${A.kind}, ${t!.id}, 'Quadratische Gleichungen lösen')
        returning id`);
        await tx.execute(sql`
        insert into objective_prerequisite (family_id, student_id, objective_id, prerequisite_objective_id)
        values (${A.family}, ${A.kind}, ${ziel!.id}, ${vorlaeufer!.id})`);
        return { topicId: t!.id, vorlaeuferId: vorlaeufer!.id, zielId: ziel!.id };
      });

      const rows = await admin.client<{ title: string }[]>`
      select lo.title from objective_prerequisite op
      join learning_objective lo on lo.id = op.prerequisite_objective_id
      where op.objective_id = ${ids.zielId}`;
      expect(rows.map((r) => r.title)).toEqual(["Lineare Gleichungen lösen"]);
    });

    test("Ein Lernziel kann nicht sein eigener Vorläufer sein", async () => {
      const fehler = await runWithActor(app.db, kind(A.family, A.kind), async (tx) => {
        const [t] = await tx.execute<{ id: string }>(sql`
        insert into topic (family_id, student_id, subject_id, school_year_id, title, status)
        values (${A.family}, ${A.kind}, ${A.mathe}, ${A.schuljahr}, 'Selbstbezug-Test', 'aktiv')
        returning id`);
        const [ziel] = await tx.execute<{ id: string }>(sql`
        insert into learning_objective (family_id, student_id, topic_id, title)
        values (${A.family}, ${A.kind}, ${t!.id}, 'Zirkulär')
        returning id`);
        await tx.execute(sql`
        insert into objective_prerequisite (family_id, student_id, objective_id, prerequisite_objective_id)
        values (${A.family}, ${A.kind}, ${ziel!.id}, ${ziel!.id})`);
      }).catch((err: unknown) => err);
      expect(fehler).toBeDefined();
    });

    test("Geschwister/fremde Familie sehen weder Fächer noch Schuljahr", async () => {
      const rows = await runWithActor(app.db, kind(B.family, B.kind), (tx) =>
        tx.execute<{ name: string }>(sql`select name from subject`),
      );
      expect(rows.map((r) => r.name)).toEqual(["Mathematik"]);
    });
  },
);
