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
 * Policy-Tests für Passkey und Gerätesitzung (F-06, umgestellt in F-11).
 *
 * Drei Dinge muss dieser Aufbau beweisen, sonst trägt er nicht:
 * 1. Die beiden Anmeldeschleusen geben wirklich nur *eine* Zeile frei – sonst
 *    wäre die Umgehung des Actor-Kontexts ein Loch statt einer Schleuse.
 * 2. Geschwister sehen weder Passkeys noch Sessions voneinander, obwohl sie
 *    sich ein Elternkonto teilen.
 * 3. Ein Elternteil sieht die Geräte des gewählten Kindes – und nur die.
 *
 * Läuft nur bei `npm run db:test` (RUN_DB_TESTS=1).
 */
loadTestEnv();

const PARENT = {
  id: "aa500000-0000-4000-8000-000000000001",
  auth: "aa500000-0000-4000-8000-0000000000a1",
  mail: "auth-test@example.test",
};
const S = {
  mia: "bb500000-0000-4000-8000-000000000001",
  ben: "bb500000-0000-4000-8000-000000000002",
  /** Ohne Elternkonto – beweist, dass ein Kind allein funktioniert. */
  lea: "bb500000-0000-4000-8000-000000000003",
  /** Entsteht im Test durch Selbstanlage samt Passkey. */
  neu: "bb500000-0000-4000-8000-00000000000f",
};

const CRED = { mia: "cred-mia-test", ben: "cred-ben-test", lea: "cred-lea-test" };
const HASH = { mia: "hash-mia-test", ben: "hash-ben-test", lea: "hash-lea-test" };

const student = (studentId: string): Actor => ({ role: "student", studentId });
const parent = (studentId: string): Actor => ({
  role: "parent",
  parentId: PARENT.id,
  studentId,
});

describe.skipIf(!testDbAvailable())("RLS: Passkey und Session des Kindes", () => {
  let app: ReturnType<typeof connectAsAppRole>;
  let admin: ReturnType<typeof connectAsMigrationRole>;

  const aufraeumen = async () => {
    await admin.client`delete from student where id in (${S.mia}, ${S.ben}, ${S.lea}, ${S.neu})`;
    await admin.client`delete from parent_account where id = ${PARENT.id}`;
  };

  beforeAll(async () => {
    admin = connectAsMigrationRole();
    await aufraeumen();
    await admin.client`
      insert into student (id, first_name, grade_level, parent_email) values
        (${S.mia}, 'Mia', 8, ${PARENT.mail}),
        (${S.ben}, 'Ben', 5, ${PARENT.mail}),
        (${S.lea}, 'Lea', 8, 'niemand@example.test')`;
    await admin.client`
      insert into parent_account (id, auth_user_id, email, name)
      values (${PARENT.id}, ${PARENT.auth}, ${PARENT.mail}, 'Elternteil')`;
    await admin.client`
      insert into parent_student (parent_account_id, student_id, consent_at) values
        (${PARENT.id}, ${S.mia}, now()),
        (${PARENT.id}, ${S.ben}, now())`;
    await admin.client`
      insert into student_credential (student_id, credential_id, public_key) values
        (${S.mia}, ${CRED.mia}, 'pk-mia'),
        (${S.ben}, ${CRED.ben}, 'pk-ben'),
        (${S.lea}, ${CRED.lea}, 'pk-lea')`;
    await admin.client`
      insert into student_session (student_id, token_hash, expires_at) values
        (${S.mia}, ${HASH.mia}, now() + interval '30 days'),
        (${S.ben}, ${HASH.ben}, now() + interval '30 days'),
        (${S.lea}, ${HASH.lea}, now() + interval '30 days')`;
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

  // --- Die Anmeldeschleuse über die Credential-ID --------------------------

  test("die Credential-ID gibt genau eine Zeile frei, nicht die Tabelle", async () => {
    const zeilen = await runWithLoginKey(app.db, "tutr.credential_id", CRED.mia, (tx) =>
      // Bewusst ohne where: Die Policy allein muss filtern.
      tx.execute<{ credential_id: string; student_id: string }>(
        sql`select credential_id, student_id from student_credential`,
      ),
    );
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].credential_id).toBe(CRED.mia);
    expect(zeilen[0].student_id).toBe(S.mia);
  });

  test("eine unbekannte Credential-ID liefert nichts", async () => {
    const zeilen = await runWithLoginKey(app.db, "tutr.credential_id", "gibt-es-nicht", (tx) =>
      tx.execute(sql`select 1 from student_credential`),
    );
    expect(zeilen).toHaveLength(0);
  });

  test("die Schleuse öffnet keine andere Tabelle", async () => {
    const sicht = await runWithLoginKey(app.db, "tutr.credential_id", CRED.mia, async (tx) => ({
      kinder: await tx.execute(sql`select 1 from student`),
      eltern: await tx.execute(sql`select 1 from parent_account`),
      sessions: await tx.execute(sql`select 1 from student_session`),
    }));
    expect(sicht.kinder).toHaveLength(0);
    expect(sicht.eltern).toHaveLength(0);
    expect(sicht.sessions).toHaveLength(0);
  });

  test("die Schleuse schreibt nicht – auch nicht die eine sichtbare Zeile", async () => {
    // Kein Fehler, sondern null getroffene Zeilen: Für UPDATE filtert Postgres
    // über die USING-Klauseln der UPDATE-Policies, und es gibt hier keine.
    // Wer nur auf eine Ausnahme testet, übersieht diesen Fall.
    await runWithLoginKey(app.db, "tutr.credential_id", CRED.mia, (tx) =>
      tx.execute(sql`update student_credential set public_key = 'gekapert'`),
    );
    await runWithLoginKey(app.db, "tutr.credential_id", CRED.mia, (tx) =>
      tx.execute(sql`delete from student_credential`),
    );

    const zeilen = await admin.client<{ public_key: string }[]>`
      select public_key from student_credential where credential_id = ${CRED.mia}`;
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].public_key).toBe("pk-mia");
  });

  // --- Die Anmeldeschleuse über den Session-Hash ---------------------------

  test("der Session-Hash gibt genau eine Zeile frei", async () => {
    const zeilen = await runWithLoginKey(app.db, "tutr.session_token_hash", HASH.lea, (tx) =>
      tx.execute<{ student_id: string }>(sql`select student_id from student_session`),
    );
    expect(zeilen).toHaveLength(1);
    expect(zeilen[0].student_id).toBe(S.lea);
  });

  test("ein unbekannter Session-Hash liefert nichts", async () => {
    const zeilen = await runWithLoginKey(app.db, "tutr.session_token_hash", "unbekannt", (tx) =>
      tx.execute(sql`select 1 from student_session`),
    );
    expect(zeilen).toHaveLength(0);
  });

  // --- Entstehung: Profil und Passkey in einer Transaktion -----------------

  test("ein Kind legt Profil und Passkey in einer Transaktion an", async () => {
    await runWithActor(app.db, student(S.neu), async (tx) => {
      await tx.execute(
        sql`insert into student (id, first_name, grade_level, parent_email)
            values (${S.neu}, 'Neu', 8, 'neu-eltern@example.test')`,
      );
      await tx.execute(
        sql`insert into student_credential (student_id, credential_id, public_key)
            values (${S.neu}, 'cred-neu-test', 'pk-neu')`,
      );
    });

    const [zeile] = await admin.client<{ first_name: string; parent_email: string }[]>`
      select first_name, parent_email from student where id = ${S.neu}`;
    expect(zeile.first_name).toBe("Neu");
    expect(zeile.parent_email).toBe("neu-eltern@example.test");
  });

  // --- Sichtbarkeit im Alltag ----------------------------------------------

  test("ein Kind sieht nur eigene Passkeys und Sessions – Geschwister nicht", async () => {
    const sicht = await runWithActor(app.db, student(S.mia), async (tx) => ({
      passkeys: await tx.execute<{ credential_id: string }>(
        sql`select credential_id from student_credential`,
      ),
      sessions: await tx.execute<{ token_hash: string }>(
        sql`select token_hash from student_session`,
      ),
    }));
    expect(sicht.passkeys.map((r) => r.credential_id)).toEqual([CRED.mia]);
    expect(sicht.sessions.map((r) => r.token_hash)).toEqual([HASH.mia]);
  });

  test("ein Kind schreibt seinen Zähler fort, den des Geschwisters nicht", async () => {
    await runWithActor(app.db, student(S.mia), (tx) =>
      tx.execute(sql`update student_credential set counter = 7`),
    );
    const zeilen = await admin.client<{ credential_id: string; counter: string }[]>`
      select credential_id, counter from student_credential
      where credential_id in (${CRED.mia}, ${CRED.ben}) order by credential_id`;
    expect(zeilen.map((r) => [r.credential_id, Number(r.counter)])).toEqual([
      [CRED.ben, 0],
      [CRED.mia, 7],
    ]);
  });

  /**
   * Der Kern von ADR 0006: Ein Elternteil ist mit beiden Kindern verknüpft,
   * sieht aber immer nur das gewählte. Vorher hätte es die ganze Familie
   * gesehen, weil die Policy `family_id` verglich.
   */
  test("ein Elternteil sieht die Geräte des gewählten Kindes, nicht die des Geschwisters", async () => {
    const sicht = await runWithActor(app.db, parent(S.mia), async (tx) => ({
      passkeys: await tx.execute<{ credential_id: string }>(
        sql`select credential_id from student_credential order by credential_id`,
      ),
      sessions: await tx.execute<{ token_hash: string }>(
        sql`select token_hash from student_session order by token_hash`,
      ),
    }));
    expect(sicht.passkeys.map((r) => r.credential_id)).toEqual([CRED.mia]);
    expect(sicht.sessions.map((r) => r.token_hash)).toEqual([HASH.mia]);
  });

  test("ein Elternteil meldet ein Gerät ab, statt die Zeile zu löschen", async () => {
    await runWithActor(app.db, parent(S.ben), (tx) =>
      tx.execute(sql`update student_session set revoked_at = now() where token_hash = ${HASH.ben}`),
    );
    const [zeile] = await admin.client<{ revoked_at: Date | null }[]>`
      select revoked_at from student_session where token_hash = ${HASH.ben}`;
    expect(zeile.revoked_at).not.toBeNull();
  });

  test("ein Elternteil schiebt keine Session zu einem anderen Kind", async () => {
    const fehler = await runWithActor(app.db, parent(S.mia), (tx) =>
      tx.execute(
        sql`update student_session set student_id = ${S.ben} where token_hash = ${HASH.mia}`,
      ),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/row-level security/i);
  });

  test("ein Elternteil legt keinen Passkey an", async () => {
    const fehler = await runWithActor(app.db, parent(S.mia), (tx) =>
      tx.execute(
        sql`insert into student_credential (student_id, credential_id, public_key)
            values (${S.mia}, 'cred-von-eltern', 'pk')`,
      ),
    ).catch((err: unknown) => err);
    expect(ursachenkette(fehler)).toMatch(/row-level security/i);
  });

  test("ein Elternteil entfernt einen verlorenen Passkey", async () => {
    await runWithActor(app.db, parent(S.ben), (tx) =>
      tx.execute(sql`delete from student_credential where credential_id = ${CRED.ben}`),
    );
    const zeilen = await admin.client`
      select 1 from student_credential where credential_id = ${CRED.ben}`;
    expect(zeilen).toHaveLength(0);
  });

  test("ein unverknüpftes Kind sieht nur sich selbst", async () => {
    const sicht = await runWithActor(app.db, student(S.lea), (tx) =>
      tx.execute<{ credential_id: string }>(sql`select credential_id from student_credential`),
    );
    expect(sicht.map((r) => r.credential_id)).toEqual([CRED.lea]);
  });
});
