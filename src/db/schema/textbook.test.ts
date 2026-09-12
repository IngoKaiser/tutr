// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, type Actor } from "../actor";
import {
  connectAsAppRole,
  connectAsMigrationRole,
  loadTestEnv,
  testDbAvailable,
  errorChain,
} from "../test-db";

/**
 * Policy-Tests für das kuratiert-oder-eigen-Muster (ADR 0004 D7) an
 * textbook / chapter / school_profile, dazu school_year_textbook.
 *
 * Der Kern ist der Kaper-Test: Eine kuratierte Zeile (student_id is null)
 * darf für die App-Rolle weder änderbar noch löschbar sein, und sie darf
 * auch keine anlegen. Sonst könnte ein Kind geteilte Referenzdaten für alle
 * anderen umschreiben.
 *
 * Läuft nur bei `npm run db:test` (RUN_DB_TESTS=1).
 */
loadTestEnv();

const A = {
  studentId: "eeee0000-0000-4000-8000-000000000002",
  schuljahr: "eeee0000-0000-4000-8000-000000000003",
  franzoesisch: "eeee0000-0000-4000-8000-000000000004",
  eigenesLehrwerk: "eeee0000-0000-4000-8000-000000000005",
};
const B = {
  studentId: "ffff0000-0000-4000-8000-000000000002",
  fremdesLehrwerk: "ffff0000-0000-4000-8000-000000000003",
};
const KURATIERT = {
  lehrwerk: "aaaa1111-0000-4000-8000-000000000001",
  schulprofil: "aaaa1111-0000-4000-8000-000000000002",
};

const student = (studentId: string): Actor => ({ role: "student", studentId });
const parent = (studentId: string): Actor => ({
  role: "parent",
  studentId,
  parentId: "aaaa2222-0000-4000-8000-000000000001",
});

describe.skipIf(!testDbAvailable())("RLS: Referenzdaten (kuratiert oder eigen)", () => {
  let app: ReturnType<typeof connectAsAppRole>;
  let admin: ReturnType<typeof connectAsMigrationRole>;

  beforeAll(async () => {
    admin = connectAsMigrationRole();
    await admin.client`delete from student where id in (${A.studentId}, ${B.studentId})`;
    await admin.client`delete from textbook where id in (${KURATIERT.lehrwerk})`;
    await admin.client`delete from school_profile where id in (${KURATIERT.schulprofil})`;

    await admin.client`
      insert into student (id, first_name, grade_level) values
        (${A.studentId}, 'Kind A', 8),
        (${B.studentId}, 'Kind B', 8)`;
    await admin.client`
      insert into school_year (id, student_id, label, grade_level, start_date, end_date, status)
      values (${A.schuljahr}, ${A.studentId}, '2026/27', 8, '2026-08-01', '2027-07-31', 'aktiv')`;
    await admin.client`
      insert into subject (id, student_id, name)
      values (${A.franzoesisch}, ${A.studentId}, 'Französisch')`;

    // Kuratiert: student_id is null – nur die Migrationsrolle darf das.
    await admin.client`
      insert into textbook (id, student_id, title, subject, publisher)
      values (${KURATIERT.lehrwerk}, null, 'Découvertes 4', 'Französisch', 'Klett')`;
    await admin.client`
      insert into school_profile (id, student_id, federal_state, school_type, name)
      values (${KURATIERT.schulprofil}, null, 'Hamburg', 'Gymnasium', 'Beispielschule')`;

    // Eigene Lehrwerke beider Kinder.
    await admin.client`
      insert into textbook (id, student_id, title, subject, source) values
        (${A.eigenesLehrwerk}, ${A.studentId}, 'Eigenes Heft A', 'Französisch', 'foto'),
        (${B.fremdesLehrwerk}, ${B.studentId}, 'Eigenes Heft B', 'Französisch', 'foto')`;

    app = connectAsAppRole();
  });

  afterAll(async () => {
    if (admin) {
      await admin.client`delete from student where id in (${A.studentId}, ${B.studentId})`;
      await admin.client`delete from textbook where id = ${KURATIERT.lehrwerk}`;
      await admin.client`delete from school_profile where id = ${KURATIERT.schulprofil}`;
      await admin.close();
    }
    await app?.close();
  });

  test("Ein Kind sieht kuratierte und eigene Lehrwerke, nicht die fremden", async () => {
    // Eingegrenzt auf die eigenen Fixtures: kuratierte Zeilen sind global
    // sichtbar, andere Testdateien legen ebenfalls welche an.
    const titel = await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute<{ title: string }>(sql`
        select title from textbook
        where id in (${KURATIERT.lehrwerk}, ${A.eigenesLehrwerk}, ${B.fremdesLehrwerk})
        order by title`),
    );
    expect(titel.map((r) => r.title)).toEqual(["Découvertes 4", "Eigenes Heft A"]);
  });

  test("Kaper-Schutz: kuratiertes Lehrwerk lässt sich nicht auf das eigene Kind umschreiben", async () => {
    await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute(sql`
        update textbook set student_id = ${A.studentId}, title = 'Gekapert'
        where id = ${KURATIERT.lehrwerk}`),
    );
    const [row] = await admin.client<{ title: string; student_id: string | null }[]>`
      select title, student_id from textbook where id = ${KURATIERT.lehrwerk}`;
    expect(row!.title).toBe("Découvertes 4");
    expect(row!.student_id).toBeNull();
  });

  test("Kaper-Schutz: kuratiertes Lehrwerk lässt sich nicht löschen", async () => {
    await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute(sql`delete from textbook where id = ${KURATIERT.lehrwerk}`),
    );
    const rows = await admin.client<{ id: string }[]>`
      select id from textbook where id = ${KURATIERT.lehrwerk}`;
    expect(rows).toHaveLength(1);
  });

  test("Die App-Rolle kann keine kuratierte Zeile anlegen", async () => {
    const error = await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute(sql`
        insert into textbook (student_id, title, subject)
        values (null, 'Schleichweg', 'Französisch')`),
    ).catch((err: unknown) => err);
    expect(errorChain(error)).toMatch(/row-level security/i);
  });

  test("Kind darf ein eigenes Lehrwerk anlegen (Foto vom Inhaltsverzeichnis)", async () => {
    const rows = await runWithActor(app.db, student(A.studentId), async (tx) => {
      const [lehrwerk] = await tx.execute<{ id: string }>(sql`
        insert into textbook (student_id, title, subject, source)
        values (${A.studentId}, 'Aus Foto erstellt', 'Französisch', 'foto')
        returning id`);
      await tx.execute(sql`
        insert into chapter (student_id, textbook_id, title, pages, sequence, units)
        values (${A.studentId}, ${lehrwerk!.id}, 'Unité 3', '34–51', 3, ARRAY['3.1', '3.2'])`);
      return tx.execute<{ title: string }>(
        sql`select title from chapter where textbook_id = ${lehrwerk!.id}`,
      );
    });
    expect(rows.map((r) => r.title)).toEqual(["Unité 3"]);
  });

  test("Schulprofil: kuratiertes Profil ist lesbar, aber nicht änderbar", async () => {
    const sicht = await runWithActor(app.db, parent(A.studentId), (tx) =>
      tx.execute<{ name: string }>(sql`select name from school_profile`),
    );
    expect(sicht.map((r) => r.name)).toEqual(["Beispielschule"]);

    await runWithActor(app.db, parent(A.studentId), (tx) =>
      tx.execute(sql`update school_profile set federal_state = 'Bayern'
        where id = ${KURATIERT.schulprofil}`),
    );
    const [row] = await admin.client<{ federal_state: string }[]>`
      select federal_state from school_profile where id = ${KURATIERT.schulprofil}`;
    expect(row!.federal_state).toBe("Hamburg");
  });

  test("school_year_textbook: Elternteil ordnet zu, Kind liest und ändert auch selbst (L-01, ADR 0009 D1 erweitert)", async () => {
    await runWithActor(app.db, parent(A.studentId), (tx) =>
      tx.execute(sql`
        insert into school_year_textbook (student_id, school_year_id, subject_id, textbook_id)
        values (${A.studentId}, ${A.schuljahr}, ${A.franzoesisch}, ${KURATIERT.lehrwerk})`),
    );

    const gelesen = await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute<{ textbook_id: string }>(sql`select textbook_id from school_year_textbook`),
    );
    expect(gelesen.map((r) => r.textbook_id)).toEqual([KURATIERT.lehrwerk]);

    // Seit L-01 darf das Kind die Zuordnung auch selbst ändern – anders als
    // vorher wirkt dieses Update jetzt tatsächlich.
    await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute(sql`
        update school_year_textbook set textbook_id = ${A.eigenesLehrwerk}
        where school_year_id = ${A.schuljahr}`),
    );
    const [row] = await admin.client<{ textbook_id: string }[]>`
      select textbook_id from school_year_textbook where school_year_id = ${A.schuljahr}`;
    expect(row!.textbook_id).toBe(A.eigenesLehrwerk);
  });

  test("school_year_textbook: ein Kind ordnet nichts einem fremden Kind zu", async () => {
    const error = await runWithActor(app.db, student(A.studentId), (tx) =>
      tx.execute(sql`
        insert into school_year_textbook (student_id, school_year_id, subject_id, textbook_id)
        values (${B.studentId}, ${A.schuljahr}, ${A.franzoesisch}, ${A.eigenesLehrwerk})`),
    ).catch((err: unknown) => err);
    expect(errorChain(error)).toMatch(/row-level security/i);
  });

  test("Pro Schuljahr und Fach nur ein Lehrwerk", async () => {
    const error = await runWithActor(app.db, parent(A.studentId), (tx) =>
      tx.execute(sql`
        insert into school_year_textbook (student_id, school_year_id, subject_id, textbook_id)
        values (${A.studentId}, ${A.schuljahr}, ${A.franzoesisch}, ${A.eigenesLehrwerk})`),
    ).catch((err: unknown) => err);
    expect(errorChain(error)).toMatch(/school_year_textbook_year_subject_key|duplicate key/i);
  });
});
