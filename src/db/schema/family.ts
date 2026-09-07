import { foreignKey, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

/**
 * Familie, Elternkonto und Kind-Profil – die Wurzel des Datenmodells.
 * Siehe docs/konzept.md §8 und docs/adr/0004-datenmodell-rls.md.
 *
 * Zwei Muster gelten hier und in allen späteren Aggregaten:
 * 1. Jede Tabelle trägt `family_id`; die Policies vergleichen genau diese Spalte.
 * 2. Fremdschlüssel schleppen `family_id` mit, damit eine familienübergreifende
 *    Verknüpfung strukturell unmöglich ist – kein Trigger, keine Prüfung im Code.
 */

const zeitstempel = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const family = pgTable("family", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  ...zeitstempel,
});

/**
 * Elternteil = Kontoinhaber (ADR 0002). Die Anmeldung läuft über Supabase Auth;
 * hier steht nur die Verknüpfung zur Familie. Kein Passwort, keine Session.
 *
 * `consentAt` dokumentiert die Einwilligung zur Nutzung durch das Kind
 * (Konzept §11: „bestätigt im Onboarding, dokumentiert mit Zeitstempel").
 */
export const parentUser = pgTable(
  "parent_user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull(),
    // Supabase-Auth-Nutzer. Bewusst ohne Fremdschlüssel in das auth-Schema,
    // damit Migrationen und Tests ohne Supabase-Auth-Fixtures auskommen.
    authUserId: uuid("auth_user_id").notNull(),
    name: text("name").notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true }),
    ...zeitstempel,
  },
  (t) => [
    foreignKey({ columns: [t.familyId], foreignColumns: [family.id] }).onDelete("cascade"),
    unique("parent_user_auth_user_id_key").on(t.authUserId),
    // Ankerpunkt für zusammengesetzte Fremdschlüssel späterer Tabellen.
    unique("parent_user_id_family_id_key").on(t.id, t.familyId),
  ],
);

/**
 * Kind-Profil, pseudonym: nur Vorname, Jahrgangsstufe, Klasse. Kein Geburtsdatum,
 * keine E-Mail, keine Schul-ID (Konzept §11, ADR 0002).
 *
 * Der Jahrgang steht hier nur als Startwert für das Onboarding – die
 * maßgebliche Zeitscheibe ist `school_year` (F-04c, Konzept §9).
 */
export const student = pgTable(
  "student",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull(),
    firstName: text("first_name").notNull(),
    gradeLevel: integer("grade_level").notNull(),
    className: text("class_name"),
    ...zeitstempel,
  },
  (t) => [
    foreignKey({ columns: [t.familyId], foreignColumns: [family.id] }).onDelete("cascade"),
    unique("student_id_family_id_key").on(t.id, t.familyId),
  ],
);
