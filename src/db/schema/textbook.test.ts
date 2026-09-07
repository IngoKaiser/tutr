// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, type Actor } from "../actor";
import {
  connectAsAppRole,
  connectAsMigrationRole,
  loadTestEnv,
  testDbAvailable,
  ursachenkette,
} from "../test-db";

/**
 * Policy-Tests für das kuratiert-oder-eigen-Muster (ADR 0004 D7) an
 * textbook / chapter / school_profile, dazu school_year_textbook.
 *
 * Der Kern ist der Kaper-Test: Eine kuratierte Zeile (family_id is null)
 * darf für die App-Rolle weder änderbar noch löschbar sein, und sie darf
 * auch keine anlegen. Sonst könnte eine Familie geteilte Referenzdaten für
 * alle anderen Familien umschreiben.
 *
 * Läuft nur bei `npm run db:test` (RUN_DB_TESTS=1).
 */
loadTestEnv();

const A = {
  family: "eeee0000-0000-4000-8000-000000000001",
  kind: "eeee0000-0000-4000-8000-000000000002",
  schuljahr: "eeee0000-0000-4000-8000-000000000003",
  franzoesisch: "eeee0000-0000-4000-8000-000000000004",
  eigenesLehrwerk: "eeee0000-0000-4000-8000-000000000005",
};
const B = {
  family: "ffff0000-0000-4000-8000-000000000001",
  kind: "ffff0000-0000-4000-8000-000000000002",
  fremdesLehrwerk: "ffff0000-0000-4000-8000-000000000003",
};
const KURATIERT = {
  lehrwerk: "aaaa1111-0000-4000-8000-000000000001",
  schulprofil: "aaaa1111-0000-4000-8000-000000000002",
};

const kind = (familyId: string, studentId: string): Actor => ({
  role: "student",
  familyId,
  studentId,
});
const elternteil = (familyId: string): Actor => ({
  role: "parent",
  familyId,
  userId: "aaaa2222-0000-4000-8000-000000000001",
});

describe.skipIf(!testDbAvailable())("RLS: Referenzdaten (kuratiert oder eigen)", () => {
  let app: ReturnType<typeof connectAsAppRole>;
  let admin: ReturnType<typeof connectAsMigrationRole>;

  beforeAll(async () => {
    admin = connectAsMigrationRole();
    await admin.client`delete from family where id in (${A.family}, ${B.family})`;
    await admin.client`delete from textbook where id in (${KURATIERT.lehrwerk})`;
    await admin.client`delete from school_profile where id in (${KURATIERT.schulprofil})`;

    await admin.client`
      insert into family (id, name) values (${A.family}, 'Familie A'), (${B.family}, 'Familie B')`;
    await admin.client`
      insert into student (id, family_id, first_name, grade_level) values
        (${A.kind}, ${A.family}, 'Kind A', 8),
        (${B.kind}, ${B.family}, 'Kind B', 8)`;
    await admin.client`
      insert into school_year (id, family_id, student_id, label, grade_level, start_date, end_date, status)
      values (${A.schuljahr}, ${A.family}, ${A.kind}, '2026/27', 8, '2026-08-01', '2027-07-31', 'aktiv')`;
    await admin.client`
      insert into subject (id, family_id, student_id, name)
      values (${A.franzoesisch}, ${A.family}, ${A.kind}, 'Französisch')`;

    // Kuratiert: family_id is null – nur die Migrationsrolle darf das.
    await admin.client`
      insert into textbook (id, family_id, title, subject, publisher)
      values (${KURATIERT.lehrwerk}, null, 'Découvertes 4', 'Französisch', 'Klett')`;
    await admin.client`
      insert into school_profile (id, family_id, federal_state, school_type, name)
      values (${KURATIERT.schulprofil}, null, 'Hamburg', 'Gymnasium', 'Beispielschule')`;

    // Eigene Lehrwerke beider Familien.
    await admin.client`
      insert into textbook (id, family_id, title, subject, source) values
        (${A.eigenesLehrwerk}, ${A.family}, 'Eigenes Heft A', 'Französisch', 'foto'),
        (${B.fremdesLehrwerk}, ${B.family}, 'Eigenes Heft B', 'Französisch', 'foto')`;

    app = connectAsAppRole();
  });

  afterAll(async () => {
    if (admin) {
      await admin.client`delete from family where id in (${A.family}, ${B.family})`;
      await admin.client`delete from textbook where id = ${KURATIERT.lehrwerk}`;
      await admin.client`delete from school_profile where id = ${KURATIERT.schulprofil}`;
      await admin.close();
    }
    await app?.close();
  });

  test("Familie sieht kuratierte und eigene Lehrwerke, nicht die fremden", async () => {
    // Eingegrenzt auf die eigenen Fixtures: kuratierte Zeilen sind global
    // sichtbar, andere Testdateien legen ebenfalls welche an.
    const titel = await runWithActor(app.db, kind(A.family, A.kind), (tx) =>
      tx.execute<{ title: string }>(sql`
        select title from textbook
        where id in (${KURATIERT.lehrwerk}, ${A.eigenesLehrwerk}, ${B.fremdesLehrwerk})
        order by title`),
    );
    expect(titel.map((r) => r.title)).toEqual(["Découvertes 4", "Eigenes Heft A"]);
  });

  test("Kaper-Schutz: kuratiertes Lehrwerk lässt sich nicht auf die eigene Familie umschreiben", async () => {
    await runWithActor(app.db, kind(A.family, A.kind), (tx) =>
      tx.execute(sql`
        update textbook set family_id = ${A.family}, title = 'Gekapert'
        where id = ${KURATIERT.lehrwerk}`),
    );
    const [row] = await admin.client<{ title: string; family_id: string | null }[]>`
      select title, family_id from textbook where id = ${KURATIERT.lehrwerk}`;
    expect(row!.title).toBe("Découvertes 4");
    expect(row!.family_id).toBeNull();
  });

  test("Kaper-Schutz: kuratiertes Lehrwerk lässt sich nicht löschen", async () => {
    await runWithActor(app.db, kind(A.family, A.kind), (tx) =>
      tx.execute(sql`delete from textbook where id = ${KURATIERT.lehrwerk}`),
    );
    const rows = await admin.client<{ id: string }[]>`
      select id from textbook where id = ${KURATIERT.lehrwerk}`;
    expect(rows).toHaveLength(1);
  });

  test("Die App-Rolle kann keine kuratierte Zeile anlegen", async () => {
    const fehler = await runWithActor(app.db, kind(A.family, A.kind), (tx) =>
      tx.execute(sql`
        insert into textbook (family_id, title, subject)
        values (null, 'Schleichweg', 'Französisch')`),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/row-level security/i);
  });

  test("Kind darf ein eigenes Lehrwerk anlegen (Foto vom Inhaltsverzeichnis)", async () => {
    const zeilen = await runWithActor(app.db, kind(A.family, A.kind), async (tx) => {
      const [lehrwerk] = await tx.execute<{ id: string }>(sql`
        insert into textbook (family_id, title, subject, source)
        values (${A.family}, 'Aus Foto erstellt', 'Französisch', 'foto')
        returning id`);
      await tx.execute(sql`
        insert into chapter (family_id, textbook_id, title, pages, sequence, units)
        values (${A.family}, ${lehrwerk!.id}, 'Unité 3', '34–51', 3, ARRAY['3.1', '3.2'])`);
      return tx.execute<{ title: string }>(
        sql`select title from chapter where textbook_id = ${lehrwerk!.id}`,
      );
    });
    expect(zeilen.map((r) => r.title)).toEqual(["Unité 3"]);
  });

  test("Schulprofil: kuratiertes Profil ist lesbar, aber nicht änderbar", async () => {
    const sicht = await runWithActor(app.db, elternteil(A.family), (tx) =>
      tx.execute<{ name: string }>(sql`select name from school_profile`),
    );
    expect(sicht.map((r) => r.name)).toEqual(["Beispielschule"]);

    await runWithActor(app.db, elternteil(A.family), (tx) =>
      tx.execute(sql`update school_profile set federal_state = 'Bayern'
        where id = ${KURATIERT.schulprofil}`),
    );
    const [row] = await admin.client<{ federal_state: string }[]>`
      select federal_state from school_profile where id = ${KURATIERT.schulprofil}`;
    expect(row!.federal_state).toBe("Hamburg");
  });

  test("school_year_textbook: Elternteil ordnet zu, Kind liest nur", async () => {
    await runWithActor(app.db, elternteil(A.family), (tx) =>
      tx.execute(sql`
        insert into school_year_textbook (family_id, student_id, school_year_id, subject_id, textbook_id)
        values (${A.family}, ${A.kind}, ${A.schuljahr}, ${A.franzoesisch}, ${KURATIERT.lehrwerk})`),
    );

    const gelesen = await runWithActor(app.db, kind(A.family, A.kind), (tx) =>
      tx.execute<{ textbook_id: string }>(sql`select textbook_id from school_year_textbook`),
    );
    expect(gelesen.map((r) => r.textbook_id)).toEqual([KURATIERT.lehrwerk]);

    await runWithActor(app.db, kind(A.family, A.kind), (tx) =>
      tx.execute(sql`
        update school_year_textbook set textbook_id = ${A.eigenesLehrwerk}`),
    );
    const [row] = await admin.client<{ textbook_id: string }[]>`
      select textbook_id from school_year_textbook where school_year_id = ${A.schuljahr}`;
    expect(row!.textbook_id).toBe(KURATIERT.lehrwerk);
  });

  test("Pro Schuljahr und Fach nur ein Lehrwerk", async () => {
    const fehler = await runWithActor(app.db, elternteil(A.family), (tx) =>
      tx.execute(sql`
        insert into school_year_textbook (family_id, student_id, school_year_id, subject_id, textbook_id)
        values (${A.family}, ${A.kind}, ${A.schuljahr}, ${A.franzoesisch}, ${A.eigenesLehrwerk})`),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/school_year_textbook_year_subject_key|duplicate key/i);
  });
});
