import type postgres from "postgres";

// Endung ausgeschrieben: `scripts/db-seed.mts` wird von Node direkt
// ausgeführt, und dort löst der ESM-Resolver keine erweiterungslosen
// Pfade auf. Bundler und Vitest stört sie nicht.
import { SEED_IDS, SEED_PARENT_EMAIL } from "./seed-ids.ts";

/**
 * Beispieldaten für Entwicklung und Tests (F-04e, umgestellt in F-11).
 *
 * Drei Kinder: zwei mit demselben Elternkonto verknüpft (Geschwister), eines
 * ohne jede Verknüpfung. Genau diese Konstellation macht sichtbar, was die
 * Policies nach ADR 0006 leisten: Ein Elternteil sieht beide eigenen Kinder,
 * die Kinder sehen einander nicht, und ein Kind ohne Elternkonto arbeitet
 * trotzdem – die Umkehrung aus ADR 0005.
 *
 * Läuft als Migrations-Rolle und umgeht damit RLS – das ist bei einem Seed
 * beabsichtigt (CLAUDE.md erlaubt direkten Zugriff in Seeds).
 *
 * Idempotent, und zwar eng: Die Funktion löscht ausschließlich ihre eigenen,
 * festen IDs und legt sie neu an. Fremde Zeilen fasst sie nie an.
 */

export { SEED_IDS, SEED_PARENT_EMAIL };

export async function seed(sql: postgres.Sql): Promise<void> {
  await sql`set client_min_messages = warning`;

  // Aufräumen: nur die eigenen Wurzeln, der Rest hängt per Kaskade daran.
  await sql`
    delete from student
    where id in (${SEED_IDS.studentOne}, ${SEED_IDS.siblingOne}, ${SEED_IDS.studentTwo})`;
  await sql`
    delete from parent_account where id in (${SEED_IDS.parentOne}, ${SEED_IDS.parentTwo})`;
  await sql`delete from textbook where id = ${SEED_IDS.textbookCurated}`;

  // --- Kuratiertes Lehrwerk (student_id is null, ADR 0004 D7) ---
  await sql`
    insert into textbook (id, student_id, title, subject, grade_level, publisher, source)
    values (${SEED_IDS.textbookCurated}, null, 'Découvertes 4', 'Französisch', 8, 'Klett', 'manuell')`;
  await sql`
    insert into chapter (student_id, textbook_id, title, pages, sequence, units)
    values
      (null, ${SEED_IDS.textbookCurated}, 'Unité 3 · Une journée particulière', '48–67', 3, ARRAY['3.1', '3.2']),
      (null, ${SEED_IDS.textbookCurated}, 'Unité 4 · En vacances', '68–85', 4, ARRAY['4.1'])`;

  // --- Kinder. Pseudonym: Vorname, Jahrgang, Klasse – sonst nichts (§11). ---
  // Die Elternadresse ist der Wiederherstellungsanker und die Bedingung, unter
  // der sich ein Elternkonto verknüpfen darf (`app.parent_may_link`).
  await sql`
    insert into student (id, first_name, grade_level, class_name, parent_email) values
      (${SEED_IDS.studentOne}, 'Mia', 8, '8c', ${SEED_PARENT_EMAIL}),
      (${SEED_IDS.siblingOne}, 'Ben', 5, '5a', ${SEED_PARENT_EMAIL}),
      (${SEED_IDS.studentTwo}, 'Lea', 8, '8b', 'andere@example.org')`;

  // --- Elternkonten ---
  await sql`
    insert into parent_account (id, auth_user_id, email, name) values
      (${SEED_IDS.parentOne}, gen_random_uuid(), ${SEED_PARENT_EMAIL}, 'Elternteil A'),
      (${SEED_IDS.parentTwo}, gen_random_uuid(), 'andere@example.org', 'Elternteil B')`;

  // Ein Elternteil, zwei Kinder – der Fall, an dem das Familienmodell
  // gescheitert ist (ADR 0006). Lea bleibt bewusst unverknüpft.
  await sql`
    insert into parent_student (parent_account_id, student_id, consent_at) values
      (${SEED_IDS.parentOne}, ${SEED_IDS.studentOne}, now()),
      (${SEED_IDS.parentOne}, ${SEED_IDS.siblingOne}, now())`;

  // --- Schuljahre: genau eins pro Schüler aktiv (§9, partieller Unique-Index) ---
  await sql`
    insert into school_year (id, student_id, label, grade_level, class_name, start_date, end_date, status)
    values
      (${SEED_IDS.schoolYearOne}, ${SEED_IDS.studentOne}, '2026/27', 8, '8c', '2026-08-01', '2027-07-31', 'aktiv'),
      (${SEED_IDS.schoolYearSibling}, ${SEED_IDS.siblingOne}, '2026/27', 5, '5a', '2026-08-01', '2027-07-31', 'aktiv'),
      (${SEED_IDS.schoolYearTwo}, ${SEED_IDS.studentTwo}, '2026/27', 8, '8b', '2026-08-01', '2027-07-31', 'aktiv')`;

  // --- Fächer: hängen am Schüler, nicht am Schuljahr (ADR 0004 D6) ---
  await sql`
    insert into subject (id, student_id, name) values
      (${SEED_IDS.subjectFrench}, ${SEED_IDS.studentOne}, 'Französisch'),
      (${SEED_IDS.subjectMaths}, ${SEED_IDS.studentOne}, 'Mathematik')`;
  await sql`
    insert into subject (student_id, name)
    select ${SEED_IDS.studentOne}, unnest(ARRAY['Deutsch', 'Englisch', 'Biologie', 'PGW'])`;

  // Lehrwerk für Französisch in diesem Schuljahr (§8 lehrwerke{fach→id})
  await sql`
    insert into school_year_textbook (student_id, school_year_id, subject_id, textbook_id)
    values (${SEED_IDS.studentOne}, ${SEED_IDS.schoolYearOne}, ${SEED_IDS.subjectFrench}, ${SEED_IDS.textbookCurated})`;

  // --- Themen mit Lernzielen ---
  await sql`
    insert into topic (id, student_id, subject_id, school_year_id, title, source, status, sequence, pathway_stage, self_assessment)
    values
      (${SEED_IDS.topicVerbes}, ${SEED_IDS.studentOne}, ${SEED_IDS.subjectFrench}, ${SEED_IDS.schoolYearOne},
       'Les verbes pronominaux', 'Lehrwerk Unité 3', 'aktiv', 1, 'festigen', 'grundlagen'),
      (${SEED_IDS.topicEquations}, ${SEED_IDS.studentOne}, ${SEED_IDS.subjectMaths}, ${SEED_IDS.schoolYearOne},
       'Quadratische Gleichungen', 'eigenes Thema', 'aktiv', 1, 'festigen', 'gehoert')`;

  await sql`
    insert into learning_objective (student_id, topic_id, title, description_grundlegend, description_regel, description_erhoeht)
    values
      (${SEED_IDS.studentOne}, ${SEED_IDS.topicVerbes},
       'Reflexivpronomen richtig zuordnen',
       'Erkennt reflexive Verben im Text.',
       'Bildet reflexive Verben in allen Personen im Präsens.',
       'Verwendet sie sicher in Verneinung und Frage.'),
      (${SEED_IDS.studentOne}, ${SEED_IDS.topicVerbes},
       'Reflexive Verben im Passé composé',
       'Kennt das Hilfsverb être.',
       'Bildet das Passé composé mit korrekter Angleichung.',
       'Erklärt die Angleichung bei vorangestelltem Objekt.'),
      (${SEED_IDS.studentOne}, ${SEED_IDS.topicEquations},
       'Quadratische Gleichungen lösen',
       'Löst Gleichungen der Form x² = a.',
       'Wendet die p-q-Formel sicher an.',
       'Wählt zwischen Faktorisieren, quadratischer Ergänzung und Formel.')`;

  // Vorläufer über Themen hinweg – laut §3 ausdrücklich erlaubt und erwünscht.
  await sql`
    insert into objective_prerequisite (student_id, objective_id, prerequisite_objective_id)
    select ${SEED_IDS.studentOne}, spaeter.id, frueher.id
    from learning_objective spaeter, learning_objective frueher
    where spaeter.title = 'Reflexive Verben im Passé composé'
      and frueher.title = 'Reflexivpronomen richtig zuordnen'
      and spaeter.student_id = ${SEED_IDS.studentOne}
      and frueher.student_id = ${SEED_IDS.studentOne}`;

  // --- Das unverknüpfte Kind: bewusst mager. Es beweist, dass ein Kind
  //     ohne Elternkonto funktioniert (ADR 0005). ---
  await sql`insert into subject (student_id, name) values (${SEED_IDS.studentTwo}, 'Französisch')`;
}
