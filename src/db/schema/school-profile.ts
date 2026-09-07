import { foreignKey, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "./columns";
import { student } from "./student";

/**
 * Schulprofil (Konzept §7): Bundesland, Schulform, Notenschlüssel, Ferien,
 * Kalender-Import-Quelle. Optional – ohne Profil läuft alles über Lehrwerk
 * und eigene Themen.
 *
 * Folgt dem kuratiert-oder-eigen-Muster (ADR 0004 D7): Mehrere Kinder können
 * dieselbe Schule besuchen, ein kuratiertes Profil ist teilbar.
 */

export const schoolProfile = pgTable(
  "school_profile",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: NULL = kuratiert (ADR 0004 D7).
    studentId: uuid("student_id"),
    name: text("name"),
    // Freitext statt Enum: §7 verlangt ausdrücklich schulagnostisches
    // Design – anderes Bundesland, andere Schulform, gleiches System.
    federalState: text("federal_state").notNull(),
    schoolType: text("school_type").notNull(),
    // Offene Strukturen, darum JSONB (ADR 0004 D5). Notenschlüssel ist laut
    // §7 editierbar, Ferien sind Zeiträume je Bundesland und Schuljahr.
    // Zod-Schemata folgen mit den Tickets, die sie tatsächlich lesen.
    gradingScale: jsonb("grading_scale"),
    holidays: jsonb("holidays"),
    // z. B. "SchulDock s5849" oder eine ICS-URL (§7, §6 M7).
    calendarImportSource: text("calendar_import_source"),
    ...timestamps,
  },
  (t) => [foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade")],
);
