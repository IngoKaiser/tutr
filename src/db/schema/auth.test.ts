// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, runWithAnmeldeschluessel, type Actor } from "../actor";
import {
  connectAsAppRole,
  connectAsMigrationRole,
  loadTestEnv,
  testDbAvailable,
  ursachenkette,
} from "../test-db";

/**
 * Policy-Tests für die Anmeldung des Kindes (F-06, ADR 0005).
 *
 * Drei Dinge muss dieser Aufbau beweisen, sonst trägt er nicht:
 * 1. Die beiden Anmeldewege geben wirklich nur *eine* Zeile frei – sonst wäre
 *    die Umgehung des Actor-Kontexts ein Loch statt einer Schleuse.
 * 2. Ein Kind kann Familie und Profil genau einmal anlegen, und nur die
 *    eigenen – die Entstehung nach ADR 0005 darf kein Einfallstor sein.
 * 3. Geschwister und fremde Familien sehen weder Passkeys noch Sessions.
 *
 * Läuft nur bei `npm run db:test` (RUN_DB_TESTS=1).
 */
loadTestEnv();

const A = {
  family: "a5000000-0000-4000-8000-000000000001",
  parent: "a5000000-0000-4000-8000-000000000002",
  kind1: "a5000000-0000-4000-8000-000000000003",
  kind2: "a5000000-0000-4000-8000-000000000004",
};
const B = {
  family: "b5000000-0000-4000-8000-000000000001",
  parent: "b5000000-0000-4000-8000-000000000002",
  kind1: "b5000000-0000-4000-8000-000000000003",
};
/** Die Familie, die im Test durch das Kind selbst entsteht. */
const C = {
  family: "c5000000-0000-4000-8000-000000000001",
  kind: "c5000000-0000-4000-8000-000000000003",
};

const CRED = { a1: "cred-a1-test", a2: "cred-a2-test", b1: "cred-b1-test" };
const HASH = { a1: "hash-a1-test", a2: "hash-a2-test", b1: "hash-b1-test" };

const elternteil = (familyId: string, userId: string): Actor => ({
  role: "parent",
  familyId,
  userId,
});
const kind = (familyId: string, studentId: string): Actor => ({
  role: "student",
  familyId,
  studentId,
});

describe.skipIf(!testDbAvailable())("RLS: Passkey und Session des Kindes", () => {
  let app: ReturnType<typeof connectAsAppRole>;
  let admin: ReturnType<typeof connectAsMigrationRole>;

  const aufraeumen = async () => {
    await admin.client`delete from family where id in (${A.family}, ${B.family}, ${C.family})`;
  };

  beforeAll(async () => {
    admin = connectAsMigrationRole();
    await aufraeumen();
    await admin.client`
      insert into family (id, name) values (${A.family}, 'Familie A'), (${B.family}, 'Familie B')`;
    await admin.client`
      insert into parent_user (id, family_id, auth_user_id, name) values
        (${A.parent}, ${A.family}, gen_random_uuid(), 'Elternteil A'),
        (${B.parent}, ${B.family}, gen_random_uuid(), 'Elternteil B')`;
    await admin.client`
      insert into student (id, family_id, first_name, grade_level) values
        (${A.kind1}, ${A.family}, 'Kind A1', 8),
        (${A.kind2}, ${A.family}, 'Kind A2', 5),
        (${B.kind1}, ${B.family}, 'Kind B1', 8)`;
    await admin.client`
      insert into student_credential (family_id, student_id, credential_id, public_key) values
        (${A.family}, ${A.kind1}, ${CRED.a1}, 'pk-a1'),
        (${A.family}, ${A.kind2}, ${CRED.a2}, 'pk-a2'),
        (${B.family}, ${B.kind1}, ${CRED.b1}, 'pk-b1')`;
    await admin.client`
      insert into student_session (family_id, student_id, token_hash, expires_at) values
        (${A.family}, ${A.kind1}, ${HASH.a1}, now() + interval '30 days'),
        (${A.family}, ${A.kind2}, ${HASH.a2}, now() + interval '30 days'),
        (${B.family}, ${B.kind1}, ${HASH.b1}, now() + interval '30 days')`;
    app = connectAsAppRole();
  });

  afterAll(async () => {
    if (admin) {
      await aufraeumen();
      await admin.close();
    }
    await app?.close();
  });

  test("ohne jeden Kontext sind beide Tabellen leer", async () => {
    for (const tabelle of ["student_credential", "student_session"]) {
      const rows = await app.db.execute(sql`select 1 from ${sql.identifier(tabelle)}`);
      expect(rows, tabelle).toHaveLength(0);
    }
  });

  // --- Der Anmeldeweg über die Credential-ID -------------------------------

  test("die Credential-ID gibt genau eine Zeile frei, nicht die Tabelle", async () => {
    const zeilen = await runWithAnmeldeschluessel(
      app.db,
      "tutr.credential_id",
      CRED.a1,
      (tx) =>
        tx.execute<{ credential_id: string; student_id: string }>(
          sql`select credential_id, student_id from student_credential`,
        ),
      // Bewusst ohne where: Die Policy allein muss filtern.
    );
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].credential_id).toBe(CRED.a1);
    expect(zeilen[0].student_id).toBe(A.kind1);
  });

  test("eine unbekannte Credential-ID liefert nichts", async () => {
    const zeilen = await runWithAnmeldeschluessel(
      app.db,
      "tutr.credential_id",
      "gibt-es-nicht",
      (tx) => tx.execute(sql`select 1 from student_credential`),
    );
    expect(zeilen).toHaveLength(0);
  });

  test("der Anmeldeweg öffnet keine anderen Tabellen", async () => {
    const sicht = await runWithAnmeldeschluessel(
      app.db,
      "tutr.credential_id",
      CRED.a1,
      async (tx) => ({
        familien: await tx.execute(sql`select 1 from family`),
        kinder: await tx.execute(sql`select 1 from student`),
        sessions: await tx.execute(sql`select 1 from student_session`),
      }),
    );
    expect(sicht.familien).toHaveLength(0);
    expect(sicht.kinder).toHaveLength(0);
    expect(sicht.sessions).toHaveLength(0);
  });

  test("der Anmeldeweg schreibt nicht – auch nicht die eine sichtbare Zeile", async () => {
    // Kein Fehler, sondern null getroffene Zeilen: Für UPDATE filtert Postgres
    // über die USING-Klauseln der UPDATE-Policies, und es gibt hier keine.
    // Wer nur auf eine Ausnahme testet, übersieht diesen Fall.
    await runWithAnmeldeschluessel(app.db, "tutr.credential_id", CRED.a1, (tx) =>
      tx.execute(sql`update student_credential set public_key = 'gekapert'`),
    );
    await runWithAnmeldeschluessel(app.db, "tutr.credential_id", CRED.a1, (tx) =>
      tx.execute(sql`delete from student_credential`),
    );

    const zeilen = await admin.client<{ public_key: string }[]>`
      select public_key from student_credential where credential_id = ${CRED.a1}`;
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].public_key).toBe("pk-a1");
  });

  // --- Der Prüfweg über den Session-Hash -----------------------------------

  test("der Session-Hash gibt genau eine Zeile frei", async () => {
    const zeilen = await runWithAnmeldeschluessel(
      app.db,
      "tutr.session_token_hash",
      HASH.b1,
      (tx) =>
        tx.execute<{ student_id: string; family_id: string }>(
          sql`select student_id, family_id from student_session`,
        ),
    );
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].student_id).toBe(B.kind1);
    expect(zeilen[0].family_id).toBe(B.family);
  });

  test("ein unbekannter Session-Hash liefert nichts", async () => {
    const zeilen = await runWithAnmeldeschluessel(
      app.db,
      "tutr.session_token_hash",
      "unbekannt",
      (tx) => tx.execute(sql`select 1 from student_session`),
    );
    expect(zeilen).toHaveLength(0);
  });

  // --- Entstehung: das Kind legt Familie und Profil an ----------------------

  test("ein Kind legt Familie, Profil und Passkey in einer Transaktion an", async () => {
    await runWithActor(app.db, kind(C.family, C.kind), async (tx) => {
      await tx.execute(
        sql`insert into family (id, name, parent_email) values (${C.family}, 'Familie C', 'eltern@example.org')`,
      );
      await tx.execute(
        sql`insert into student (id, family_id, first_name, grade_level, class_name)
            values (${C.kind}, ${C.family}, 'Kind C', 8, '8c')`,
      );
      await tx.execute(
        sql`insert into student_credential (family_id, student_id, credential_id, public_key)
            values (${C.family}, ${C.kind}, 'cred-c-test', 'pk-c')`,
      );
    });

    const [zeile] = await admin.client<{ name: string; parent_email: string }[]>`
      select name, parent_email from family where id = ${C.family}`;
    expect(zeile.name).toBe("Familie C");
    expect(zeile.parent_email).toBe("eltern@example.org");
  });

  test("dieselbe Familie entsteht kein zweites Mal", async () => {
    const fehler = await runWithActor(app.db, kind(C.family, C.kind), (tx) =>
      tx.execute(sql`insert into family (id, name) values (${C.family}, 'Zweitversuch')`),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/duplicate key|family_pkey/i);
  });

  test("ein Kind legt kein zweites Profil in der eigenen Familie an", async () => {
    const fehler = await runWithActor(app.db, kind(C.family, C.kind), (tx) =>
      tx.execute(
        sql`insert into student (family_id, first_name, grade_level)
            values (${C.family}, 'Untergeschoben', 8)`,
      ),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/row-level security/i);
  });

  test("niemand legt eine Familie an, auf die der eigene Kontext nicht zeigt", async () => {
    // Dass ein Actor „seine" Familie anlegen darf, ist Absicht – so entstehen
    // sowohl das Elternkonto (F-05) als auch die Kind-Registrierung (F-06).
    // Die Grenze ist die ID: Sie muss die des eigenen Kontexts sein.
    const fremd = "c5000000-0000-4000-8000-0000000000ee";
    for (const actor of [kind(C.family, C.kind), elternteil(A.family, A.parent)]) {
      const fehler = await runWithActor(app.db, actor, (tx) =>
        tx.execute(sql`insert into family (id, name) values (${fremd}, 'Nicht meine')`),
      ).catch((err: unknown) => err);
      expect(ursachenkette(fehler), actor.role).toMatch(/row-level security/i);
    }
  });

  // --- Sichtbarkeit im Alltag ----------------------------------------------

  test("ein Kind sieht nur eigene Passkeys und Sessions – Geschwister nicht", async () => {
    const sicht = await runWithActor(app.db, kind(A.family, A.kind1), async (tx) => ({
      passkeys: await tx.execute<{ credential_id: string }>(
        sql`select credential_id from student_credential`,
      ),
      sessions: await tx.execute<{ token_hash: string }>(
        sql`select token_hash from student_session`,
      ),
    }));
    expect(sicht.passkeys.map((r) => r.credential_id)).toEqual([CRED.a1]);
    expect(sicht.sessions.map((r) => r.token_hash)).toEqual([HASH.a1]);
  });

  test("ein Kind schreibt seinen Zähler fort, den des Geschwisters nicht", async () => {
    await runWithActor(app.db, kind(A.family, A.kind1), (tx) =>
      tx.execute(sql`update student_credential set counter = 7`),
    );
    const zeilen = await admin.client<{ credential_id: string; counter: string }[]>`
      select credential_id, counter from student_credential
      where credential_id in (${CRED.a1}, ${CRED.a2}) order by credential_id`;
    expect(zeilen.map((r) => [r.credential_id, Number(r.counter)])).toEqual([
      [CRED.a1, 7],
      [CRED.a2, 0],
    ]);
  });

  test("ein Elternteil sieht die Geräte der Familie, aber keine fremden", async () => {
    const sicht = await runWithActor(app.db, elternteil(A.family, A.parent), async (tx) => ({
      passkeys: await tx.execute<{ credential_id: string }>(
        sql`select credential_id from student_credential order by credential_id`,
      ),
      sessions: await tx.execute<{ token_hash: string }>(
        sql`select token_hash from student_session order by token_hash`,
      ),
    }));
    expect(sicht.passkeys.map((r) => r.credential_id)).toEqual([CRED.a1, CRED.a2]);
    expect(sicht.sessions.map((r) => r.token_hash)).toEqual([HASH.a1, HASH.a2]);
  });

  test("ein Elternteil meldet ein Gerät ab, statt die Zeile zu löschen", async () => {
    await runWithActor(app.db, elternteil(A.family, A.parent), (tx) =>
      tx.execute(sql`update student_session set revoked_at = now() where token_hash = ${HASH.a2}`),
    );
    const [zeile] = await admin.client<{ revoked_at: Date | null }[]>`
      select revoked_at from student_session where token_hash = ${HASH.a2}`;
    expect(zeile.revoked_at).not.toBeNull();
  });

  test("ein Elternteil schiebt keine Session in eine fremde Familie", async () => {
    const fehler = await runWithActor(app.db, elternteil(A.family, A.parent), (tx) =>
      tx.execute(
        sql`update student_session set family_id = ${B.family}, student_id = ${B.kind1}
            where token_hash = ${HASH.a1}`,
      ),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/row-level security/i);
  });

  test("ein Elternteil legt keinen Passkey an", async () => {
    const fehler = await runWithActor(app.db, elternteil(A.family, A.parent), (tx) =>
      tx.execute(
        sql`insert into student_credential (family_id, student_id, credential_id, public_key)
            values (${A.family}, ${A.kind1}, 'cred-von-eltern', 'pk')`,
      ),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/row-level security/i);
  });

  test("ein Elternteil entfernt einen verlorenen Passkey", async () => {
    await runWithActor(app.db, elternteil(A.family, A.parent), (tx) =>
      tx.execute(sql`delete from student_credential where credential_id = ${CRED.a2}`),
    );
    const zeilen = await admin.client`
      select 1 from student_credential where credential_id = ${CRED.a2}`;
    expect(zeilen).toHaveLength(0);
  });

  test("eine fremde Familie sieht weder Passkeys noch Sessions", async () => {
    const sicht = await runWithActor(app.db, elternteil(B.family, B.parent), async (tx) => ({
      passkeys: await tx.execute<{ credential_id: string }>(
        sql`select credential_id from student_credential`,
      ),
      sessions: await tx.execute<{ token_hash: string }>(
        sql`select token_hash from student_session`,
      ),
    }));
    expect(sicht.passkeys.map((r) => r.credential_id)).toEqual([CRED.b1]);
    expect(sicht.sessions.map((r) => r.token_hash)).toEqual([HASH.b1]);
  });
});
