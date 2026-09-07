import type postgres from "postgres";

// Endung ausgeschrieben: `scripts/db-seed.mts` wird von Node direkt
// ausgeführt, und dort löst der ESM-Resolver keine erweiterungslosen
// Pfade auf. Bundler und Vitest stört sie nicht.
import { SEED_IDS } from "./seed-ids.ts";

/**
 * Beispieldaten für Entwicklung und Tests (F-04e).
 *
 * Zwei Familien mit je einem aktiven Schuljahr, dazu ein Geschwisterkind in
 * Familie A. Erst diese Konstellation macht sichtbar, was die Policies leisten:
 * Familien sehen einander nicht, Geschwister sehen einander nicht.
 *
 * Läuft als Migrations-Rolle und umgeht damit RLS – das ist bei einem Seed
 * beabsichtigt (CLAUDE.md erlaubt direkten Zugriff in Seeds).
 *
 * Idempotent, und zwar eng: Die Funktion löscht ausschließlich ihre eigenen,
 * festen IDs und legt sie neu an. Fremde Zeilen fasst sie nie an.
 */

export { SEED_IDS };

export async function seed(sql: postgres.Sql): Promise<void> {
  await sql`set client_min_messages = warning`;

  // Aufräumen: nur die eigenen Wurzeln, der Rest hängt per Kaskade daran.
  await sql`delete from family where id in (${SEED_IDS.familieA}, ${SEED_IDS.familieB})`;
  await sql`delete from textbook where id = ${SEED_IDS.lehrwerkKuratiert}`;

  // --- Kuratiertes Lehrwerk (family_id is null, ADR 0004 D7) ---
  await sql`
    insert into textbook (id, family_id, title, subject, grade_level, publisher, source)
    values (${SEED_IDS.lehrwerkKuratiert}, null, 'Découvertes 4', 'Französisch', 8, 'Klett', 'manuell')`;
  await sql`
    insert into chapter (family_id, textbook_id, title, pages, sequence, units)
    values
      (null, ${SEED_IDS.lehrwerkKuratiert}, 'Unité 3 · Une journée particulière', '48–67', 3, ARRAY['3.1', '3.2']),
      (null, ${SEED_IDS.lehrwerkKuratiert}, 'Unité 4 · En vacances', '68–85', 4, ARRAY['4.1'])`;

  // --- Familien ---
  await sql`
    insert into family (id, name) values
      (${SEED_IDS.familieA}, 'Familie A'),
      (${SEED_IDS.familieB}, 'Familie B')`;

  await sql`
    insert into parent_user (id, family_id, auth_user_id, name, consent_at) values
      (${SEED_IDS.elternteilA}, ${SEED_IDS.familieA}, gen_random_uuid(), 'Elternteil A', now()),
      (${SEED_IDS.elternteilB}, ${SEED_IDS.familieB}, gen_random_uuid(), 'Elternteil B', now())`;

  // Kind-Profile bleiben pseudonym: Vorname, Jahrgang, Klasse – sonst nichts (§11).
  await sql`
    insert into student (id, family_id, first_name, grade_level, class_name) values
      (${SEED_IDS.kindA}, ${SEED_IDS.familieA}, 'Mia', 8, '8c'),
      (${SEED_IDS.geschwisterA}, ${SEED_IDS.familieA}, 'Ben', 5, '5a'),
      (${SEED_IDS.kindB}, ${SEED_IDS.familieB}, 'Lea', 8, '8b')`;

  // --- Schuljahre: genau eins pro Schüler aktiv (§9, partieller Unique-Index) ---
  await sql`
    insert into school_year (id, family_id, student_id, label, grade_level, class_name, start_date, end_date, status)
    values
      (${SEED_IDS.schuljahrA}, ${SEED_IDS.familieA}, ${SEED_IDS.kindA}, '2026/27', 8, '8c', '2026-08-01', '2027-07-31', 'aktiv'),
      (${SEED_IDS.schuljahrGeschwister}, ${SEED_IDS.familieA}, ${SEED_IDS.geschwisterA}, '2026/27', 5, '5a', '2026-08-01', '2027-07-31', 'aktiv'),
      (${SEED_IDS.schuljahrB}, ${SEED_IDS.familieB}, ${SEED_IDS.kindB}, '2026/27', 8, '8b', '2026-08-01', '2027-07-31', 'aktiv')`;

  // --- Fächer: hängen am Schüler, nicht am Schuljahr (ADR 0004 D6) ---
  await sql`
    insert into subject (id, family_id, student_id, name) values
      (${SEED_IDS.franzoesisch}, ${SEED_IDS.familieA}, ${SEED_IDS.kindA}, 'Französisch'),
      (${SEED_IDS.mathematik}, ${SEED_IDS.familieA}, ${SEED_IDS.kindA}, 'Mathematik')`;
  await sql`
    insert into subject (family_id, student_id, name)
    select ${SEED_IDS.familieA}, ${SEED_IDS.kindA}, unnest(ARRAY['Deutsch', 'Englisch', 'Biologie', 'PGW'])`;

  // Lehrwerk für Französisch in diesem Schuljahr (§8 lehrwerke{fach→id})
  await sql`
    insert into school_year_textbook (family_id, student_id, school_year_id, subject_id, textbook_id)
    values (${SEED_IDS.familieA}, ${SEED_IDS.kindA}, ${SEED_IDS.schuljahrA}, ${SEED_IDS.franzoesisch}, ${SEED_IDS.lehrwerkKuratiert})`;

  // --- Themen mit Lernzielen ---
  await sql`
    insert into topic (id, family_id, student_id, subject_id, school_year_id, title, source, status, sequence, pathway_stage, self_assessment)
    values
      (${SEED_IDS.themaVerbes}, ${SEED_IDS.familieA}, ${SEED_IDS.kindA}, ${SEED_IDS.franzoesisch}, ${SEED_IDS.schuljahrA},
       'Les verbes pronominaux', 'Lehrwerk Unité 3', 'aktiv', 1, 'festigen', 'grundlagen'),
      (${SEED_IDS.themaGleichungen}, ${SEED_IDS.familieA}, ${SEED_IDS.kindA}, ${SEED_IDS.mathematik}, ${SEED_IDS.schuljahrA},
       'Quadratische Gleichungen', 'eigenes Thema', 'aktiv', 1, 'festigen', 'gehoert')`;

  await sql`
    insert into learning_objective (family_id, student_id, topic_id, title, description_grundlegend, description_regel, description_erhoeht)
    values
      (${SEED_IDS.familieA}, ${SEED_IDS.kindA}, ${SEED_IDS.themaVerbes},
       'Reflexivpronomen richtig zuordnen',
       'Erkennt reflexive Verben im Text.',
       'Bildet reflexive Verben in allen Personen im Präsens.',
       'Verwendet sie sicher in Verneinung und Frage.'),
      (${SEED_IDS.familieA}, ${SEED_IDS.kindA}, ${SEED_IDS.themaVerbes},
       'Reflexive Verben im Passé composé',
       'Kennt das Hilfsverb être.',
       'Bildet das Passé composé mit korrekter Angleichung.',
       'Erklärt die Angleichung bei vorangestelltem Objekt.'),
      (${SEED_IDS.familieA}, ${SEED_IDS.kindA}, ${SEED_IDS.themaGleichungen},
       'Quadratische Gleichungen lösen',
       'Löst Gleichungen der Form x² = a.',
       'Wendet die p-q-Formel sicher an.',
       'Wählt zwischen Faktorisieren, quadratischer Ergänzung und Formel.')`;

  // Vorläufer über Themen hinweg – laut §3 ausdrücklich erlaubt und erwünscht.
  await sql`
    insert into objective_prerequisite (family_id, student_id, objective_id, prerequisite_objective_id)
    select ${SEED_IDS.familieA}, ${SEED_IDS.kindA}, spaeter.id, frueher.id
    from learning_objective spaeter, learning_objective frueher
    where spaeter.title = 'Reflexive Verben im Passé composé'
      and frueher.title = 'Reflexivpronomen richtig zuordnen'
      and spaeter.family_id = ${SEED_IDS.familieA}
      and frueher.family_id = ${SEED_IDS.familieA}`;

  // --- Familie B: bewusst mager. Sie existiert, um Abgrenzung zu beweisen. ---
  await sql`
    insert into subject (family_id, student_id, name)
    values (${SEED_IDS.familieB}, ${SEED_IDS.kindB}, 'Französisch')`;
}
