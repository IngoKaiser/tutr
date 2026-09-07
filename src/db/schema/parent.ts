import { foreignKey, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "./columns";
import { student } from "./student";

/**
 * Elternkonto und die Beziehung zum Kind (ADR 0006 D1).
 *
 * `parent_account` ist die **Identität**: eine Zeile je Anmelde-Identität.
 * Hier hängt später das Abo – ein Konto, N Kinder, eine Zahlung. Genau
 * deshalb ist es eine eigene Entität und kein Feld an einer Familie: Eine
 * Familie kann ein Elternteil nicht eindeutig adressieren, sobald es mehreren
 * angehört.
 *
 * `parent_student` ist die **Beziehung** und trägt die Einwilligung je Kind.
 * Eingewilligt wird in die Nutzung durch *ein* Kind, nicht in einen Container.
 */

export const parentAccount = pgTable(
  "parent_account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Supabase-Auth-Nutzer. Bewusst ohne Fremdschlüssel in das auth-Schema,
    // damit Migrationen und Tests ohne Supabase-Auth-Fixtures auskommen.
    authUserId: uuid("auth_user_id").notNull(),
    /** Die von Supabase **bestätigte** Adresse – der Gegensatz zu `student.parent_email`. */
    email: text("email").notNull(),
    name: text("name").notNull(),
    ...timestamps,
  },
  (t) => [
    unique("parent_account_auth_user_id_key").on(t.authUserId),
    unique("parent_account_email_key").on(t.email),
  ],
);

/**
 * Wer darf für wen handeln.
 *
 * Entsteht durch die Handlung des **Elternteils**: Das Kind nennt nur eine
 * Adresse, verknüpft wird erst, wer sich über einen Magic Link an dieser
 * Adresse ausweist. Damit ist eine spätere „Freigabe durch die Eltern" schon
 * der Mechanismus und müsste nur eine Konsequenz bekommen (ADR 0006 D8).
 *
 * Ein Zählerfeld an `parent_account` gibt es bewusst nicht: Was sich zählen
 * lässt, wird nicht gespeichert (D7).
 */
export const parentStudent = pgTable(
  "parent_student",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    parentAccountId: uuid("parent_account_id").notNull(),
    studentId: uuid("student_id").notNull(),
    /** Zeitpunkt der Einwilligung – je Kind, nicht je Konto (Konzept §11). */
    consentAt: timestamp("consent_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.parentAccountId], foreignColumns: [parentAccount.id] }).onDelete(
      "cascade",
    ),
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    unique("parent_student_pair_key").on(t.parentAccountId, t.studentId),
  ],
);
