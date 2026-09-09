// @vitest-environment node
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { runWithActor, type Actor } from "../actor";
import {
  connectAsAppRole,
  connectAsMigrationRole,
  errorChain,
  loadTestEnv,
  testDbAvailable,
} from "../test-db";

/**
 * Policy- und Constraint-Tests für vocab_set, vocab_item, vocab_set_item,
 * card, review (V-01).
 *
 * RLS-Richtung wie topic/learning_objective (ADR 0004 D4): Kind liest und
 * schreibt, Eltern lesen nur. Der interessante Teil ist nicht die Richtung –
 * die ist Kopie –, sondern die beiden Check-Constraints an `card`, die
 * dessen Generizität erzwingen: „genau eine Quelle" und „Richtung nur bei
 * einer Vokabelkarte".
 *
 * Läuft nur bei `npm run db:test` (RUN_DB_TESTS=1).
 */
loadTestEnv();

const A = {
  studentId: "99990000-0000-4000-8000-000000000001",
  subject: "99990000-0000-4000-8000-000000000002",
  schoolYear: "99990000-0000-4000-8000-000000000003",
  topic: "99990000-0000-4000-8000-000000000004",
  objective: "99990000-0000-4000-8000-000000000005",
  textbook: "99990000-0000-4000-8000-000000000006",
  chapter: "99990000-0000-4000-8000-000000000007",
};
const B = { studentId: "88880000-0000-4000-8000-000000000001" };

const student = (studentId: string): Actor => ({ role: "student", studentId });
const parent = (studentId: string): Actor => ({
  role: "parent",
  studentId,
  parentId: "77770000-0000-4000-8000-000000000001",
});

const FSRS_ROHDATEN = {
  due: "2026-09-08T00:00:00.000Z",
  stability: 0,
  difficulty: 0,
  elapsed_days: 0,
  scheduled_days: 0,
  learning_steps: 0,
  reps: 0,
  lapses: 0,
  state: 0,
};

describe.skipIf(!testDbAvailable())(
  "RLS + Constraints: vocab_set, vocab_item, vocab_set_item, card, review",
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
        insert into subject (id, student_id, name) values (${A.subject}, ${A.studentId}, 'Französisch')`;
      await admin.client`
        insert into school_year (id, student_id, label, grade_level, start_date, end_date, status)
        values (${A.schoolYear}, ${A.studentId}, '2026/27', 8, '2026-08-01', '2027-07-31', 'aktiv')`;
      await admin.client`
        insert into topic (id, student_id, subject_id, school_year_id, title, status)
        values (${A.topic}, ${A.studentId}, ${A.subject}, ${A.schoolYear}, 'Unité 3', 'aktiv')`;
      await admin.client`
        insert into learning_objective (id, student_id, topic_id, title)
        values (${A.objective}, ${A.studentId}, ${A.topic}, 'Passé composé')`;
      // Eigenes Lehrwerk, nicht kuratiert – reicht, um chapterId zu prüfen;
      // der kuratierte Fall ist schon in textbook.test.ts abgedeckt.
      await admin.client`
        insert into textbook (id, student_id, title, subject) values
          (${A.textbook}, ${A.studentId}, 'Découvertes', 'Französisch')`;
      await admin.client`
        insert into chapter (id, student_id, textbook_id, title, units)
        values (${A.chapter}, ${A.studentId}, ${A.textbook}, 'Kapitel 3', ARRAY['3A', '3B'])`;
      app = connectAsAppRole();
    });

    afterAll(async () => {
      if (admin) {
        await admin.client`delete from student where id in (${A.studentId}, ${B.studentId})`;
        await admin.close();
      }
      await app?.close();
    });

    test("ein Kind legt ein Set mit Fach- und Kapitelbindung an, das Elternteil sieht es nur", async () => {
      const [set] = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute<{ id: string }>(sql`
          insert into vocab_set (student_id, subject_id, school_year_id, chapter_id, unit, title)
          values (${A.studentId}, ${A.subject}, ${A.schoolYear}, ${A.chapter}, '3A', 'Unité 3A')
          returning id`),
      );
      expect(set?.id).toBeTruthy();

      const gesehen = await runWithActor(app.db, parent(A.studentId), (tx) =>
        tx.execute<{ title: string }>(sql`select title from vocab_set`),
      );
      expect(gesehen.map((r) => r.title)).toEqual(["Unité 3A"]);

      // Kein Fehler, sondern null getroffene Zeilen – dieselbe Postgres-
      // Eigenheit wie bei jeder anderen reinen SELECT-Policy im Projekt.
      await runWithActor(app.db, parent(A.studentId), (tx) =>
        tx.execute(sql`update vocab_set set title = 'gekapert' where id = ${set!.id}`),
      );
      const [row] = await admin.client<{ title: string }[]>`
        select title from vocab_set where id = ${set!.id}`;
      expect(row!.title).toBe("Unité 3A");
    });

    test("ein Vokabelset an ein fremdes Fach scheitert an der Fachbindung (§15 Fehler 2)", async () => {
      const fremdesFach = "99990000-0000-4000-8000-0000000000fa";
      await admin.client`
        insert into subject (id, student_id, name) values (${fremdesFach}, ${B.studentId}, 'Mathematik')`;

      const error = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(sql`
          insert into vocab_set (student_id, subject_id, school_year_id, title)
          values (${A.studentId}, ${fremdesFach}, ${A.schoolYear}, 'Fremdes Fach')`),
      ).catch((err: unknown) => err);
      expect(errorChain(error)).toMatch(/vocab_set_subject_fk|foreign key/i);

      await admin.client`delete from subject where id = ${fremdesFach}`;
    });

    test("ein Vokabelset an ein fremdes Schuljahr scheitert (F-16a, ADR 0009 D4)", async () => {
      const fremdesJahr = "99990000-0000-4000-8000-0000000000fc";
      await admin.client`
        insert into school_year (id, student_id, label, grade_level, start_date, end_date, status)
        values (${fremdesJahr}, ${B.studentId}, '2026/27', 8, '2026-08-01', '2027-07-31', 'aktiv')`;

      const error = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(sql`
          insert into vocab_set (student_id, subject_id, school_year_id, title)
          values (${A.studentId}, ${A.subject}, ${fremdesJahr}, 'Fremdes Jahr')`),
      ).catch((err: unknown) => err);
      expect(errorChain(error)).toMatch(/vocab_set_school_year_fk|foreign key/i);

      await admin.client`delete from school_year where id = ${fremdesJahr}`;
    });

    test("eine Vokabel steckt in mehreren Sets (n:m über vocab_set_item)", async () => {
      const ids = await runWithActor(app.db, student(A.studentId), async (tx) => {
        const [item] = await tx.execute<{ id: string }>(sql`
          insert into vocab_item (student_id, subject_id, term, translation)
          values (${A.studentId}, ${A.subject}, 'aller', 'gehen') returning id`);
        const [setEins] = await tx.execute<{ id: string }>(sql`
          insert into vocab_set (student_id, subject_id, school_year_id, title)
          values (${A.studentId}, ${A.subject}, ${A.schoolYear}, 'Set eins') returning id`);
        const [setZwei] = await tx.execute<{ id: string }>(sql`
          insert into vocab_set (student_id, subject_id, school_year_id, title)
          values (${A.studentId}, ${A.subject}, ${A.schoolYear}, 'Set zwei') returning id`);
        await tx.execute(sql`
          insert into vocab_set_item (student_id, vocab_set_id, vocab_item_id, subject_id) values
            (${A.studentId}, ${setEins!.id}, ${item!.id}, ${A.subject}),
            (${A.studentId}, ${setZwei!.id}, ${item!.id}, ${A.subject})`);
        return { itemId: item!.id };
      });

      const sets = await admin.client<{ title: string }[]>`
        select vs.title from vocab_set_item vsi
        join vocab_set vs on vs.id = vsi.vocab_set_id
        where vsi.vocab_item_id = ${ids.itemId} order by vs.title`;
      expect(sets.map((r) => r.title)).toEqual(["Set eins", "Set zwei"]);
    });

    // --- V-05, ADR 0008 D1/D2: Fachbindung von vocab_item/vocab_set_item ---

    test("eine Vokabel lässt sich nicht ohne Fach anlegen", async () => {
      const error = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(sql`
          insert into vocab_item (student_id, term, translation)
          values (${A.studentId}, 'partir', 'abfahren')`),
      ).catch((err: unknown) => err);
      expect(errorChain(error)).toMatch(/null value.*subject_id|not-null/i);
    });

    test("eine Vokabel eines Fachs lässt sich nicht in ein Set eines anderen Fachs hängen", async () => {
      const mathe = "99990000-0000-4000-8000-0000000000fb";
      await admin.client`
        insert into subject (id, student_id, name) values (${mathe}, ${A.studentId}, 'Mathematik')`;

      const error = await runWithActor(app.db, student(A.studentId), async (tx) => {
        const [item] = await tx.execute<{ id: string }>(sql`
          insert into vocab_item (student_id, subject_id, term, translation)
          values (${A.studentId}, ${A.subject}, 'venir', 'kommen') returning id`);
        const [mathSet] = await tx.execute<{ id: string }>(sql`
          insert into vocab_set (student_id, subject_id, school_year_id, title)
          values (${A.studentId}, ${mathe}, ${A.schoolYear}, 'Bruchrechnung') returning id`);
        // subject_id auf der Zeile stimmt mit dem Set überein (Mathematik),
        // nicht mit der Vokabel (Französisch) – genau der Fall, den der
        // zusammengesetzte Fremdschlüssel auf die Vokabel verhindern soll.
        return tx.execute(sql`
          insert into vocab_set_item (student_id, vocab_set_id, vocab_item_id, subject_id)
          values (${A.studentId}, ${mathSet!.id}, ${item!.id}, ${mathe})`);
      }).catch((err: unknown) => err);
      expect(errorChain(error)).toMatch(/vocab_set_item_item_fk|foreign key/i);

      await admin.client`delete from subject where id = ${mathe}`;
    });

    test("card: eine Karte ohne Vokabel und ohne Lernziel scheitert am Check", async () => {
      const error = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(sql`
          insert into card (student_id, fsrs_state) values (${A.studentId}, ${JSON.stringify(FSRS_ROHDATEN)}::jsonb)`),
      ).catch((err: unknown) => err);
      expect(errorChain(error)).toMatch(/card_exactly_one_source/);
    });

    test("card: eine Karte mit Vokabel UND Lernziel scheitert am selben Check", async () => {
      const [item] = await admin.client<{ id: string }[]>`
        insert into vocab_item (student_id, subject_id, term, translation)
        values (${A.studentId}, ${A.subject}, 'partir', 'abfahren') returning id`;

      const error = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(sql`
          insert into card (student_id, vocab_item_id, objective_id, direction, fsrs_state)
          values (${A.studentId}, ${item!.id}, ${A.objective}, 'vorwaerts', ${JSON.stringify(FSRS_ROHDATEN)}::jsonb)`),
      ).catch((err: unknown) => err);
      expect(errorChain(error)).toMatch(/card_exactly_one_source/);
    });

    test("card: eine Vokabelkarte ohne Richtung scheitert am zweiten Check", async () => {
      const [item] = await admin.client<{ id: string }[]>`
        insert into vocab_item (student_id, subject_id, term, translation)
        values (${A.studentId}, ${A.subject}, 'venir', 'kommen') returning id`;

      const error = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(sql`
          insert into card (student_id, vocab_item_id, fsrs_state)
          values (${A.studentId}, ${item!.id}, ${JSON.stringify(FSRS_ROHDATEN)}::jsonb)`),
      ).catch((err: unknown) => err);
      expect(errorChain(error)).toMatch(/card_direction_only_for_vocab/);
    });

    test("card: zwei Vokabelkarten (vorwärts + rückwärts) und eine Lernziel-Karte – beide Quellen funktionieren", async () => {
      const [item] = await admin.client<{ id: string }[]>`
        insert into vocab_item (student_id, subject_id, term, translation)
        values (${A.studentId}, ${A.subject}, 'devoir', 'müssen') returning id`;

      const cards = await runWithActor(app.db, student(A.studentId), async (tx) => {
        await tx.execute(sql`
          insert into card (student_id, vocab_item_id, direction, fsrs_state) values
            (${A.studentId}, ${item!.id}, 'vorwaerts', ${JSON.stringify(FSRS_ROHDATEN)}::jsonb),
            (${A.studentId}, ${item!.id}, 'rueckwaerts', ${JSON.stringify(FSRS_ROHDATEN)}::jsonb)`);
        return tx.execute(sql`
          insert into card (student_id, objective_id, fsrs_state)
          values (${A.studentId}, ${A.objective}, ${JSON.stringify(FSRS_ROHDATEN)}::jsonb) returning id`);
      });
      expect(cards).toHaveLength(1);

      // Zweite Karte in dieselbe Richtung für dieselbe Vokabel: verboten.
      const error = await runWithActor(app.db, student(A.studentId), (tx) =>
        tx.execute(sql`
          insert into card (student_id, vocab_item_id, direction, fsrs_state)
          values (${A.studentId}, ${item!.id}, 'vorwaerts', ${JSON.stringify(FSRS_ROHDATEN)}::jsonb)`),
      ).catch((err: unknown) => err);
      expect(errorChain(error)).toMatch(/card_vocab_item_direction_key/);
    });

    test("review hängt an einer Karte des eigenen Kindes und verschwindet mit ihr", async () => {
      const [item] = await admin.client<{ id: string }[]>`
        insert into vocab_item (student_id, subject_id, term, translation)
        values (${A.studentId}, ${A.subject}, 'savoir', 'wissen') returning id`;

      const reviewId = await runWithActor(app.db, student(A.studentId), async (tx) => {
        const [c] = await tx.execute<{ id: string }>(sql`
          insert into card (student_id, vocab_item_id, direction, fsrs_state)
          values (${A.studentId}, ${item!.id}, 'vorwaerts', ${JSON.stringify(FSRS_ROHDATEN)}::jsonb) returning id`);
        const [r] = await tx.execute<{ id: string }>(sql`
          insert into review (student_id, card_id, rating, response_ms)
          values (${A.studentId}, ${c!.id}, 'gut', 1200) returning id`);
        await tx.execute(sql`delete from card where id = ${c!.id}`);
        return r!.id;
      });

      const rows = await admin.client`select 1 from review where id = ${reviewId}`;
      expect(rows).toHaveLength(0);
    });

    test("ein fremdes Kind sieht weder Sets noch Vokabeln noch Karten von A", async () => {
      const sicht = await runWithActor(app.db, student(B.studentId), async (tx) => ({
        sets: await tx.execute(sql`select 1 from vocab_set`),
        items: await tx.execute(sql`select 1 from vocab_item`),
        cards: await tx.execute(sql`select 1 from card`),
      }));
      expect(sicht.sets).toHaveLength(0);
      expect(sicht.items).toHaveLength(0);
      expect(sicht.cards).toHaveLength(0);
    });
  },
);
