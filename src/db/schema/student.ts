import { integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { timestamps } from "./columns";

/**
 * Das Kind – der Mandant (ADR 0006 D1).
 *
 * Jede Tabelle im Datenmodell trägt `student_id`, und jede Policy vergleicht
 * genau diese Spalte. Alles hängt per `on delete cascade` daran: Löscht ein
 * Kind sein Konto, geht seine Lernhistorie mit, und zwar vollständig, ohne
 * Aufräumliste.
 *
 * Das Profil bleibt pseudonym: Vorname, Jahrgang, Klasse. Kein Geburtsdatum,
 * keine eigene E-Mail, keine Schul-ID (Konzept §11).
 *
 * Ein Kind funktioniert ohne Elternkonto – das ist die Umkehrung aus ADR 0005
 * und der Grund, warum `student` und nicht ein Container die Wurzel ist.
 */
export const student = pgTable(
  "student",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    firstName: text("first_name").notNull(),
    gradeLevel: integer("grade_level").notNull(),
    /**
     * Nicht bei der Anmeldung gefragt (ADR 0005, Nachtrag). Ihr Verbraucher
     * ist der Gruppenfilter beim Klausurplan-Import (K-03); maßgeblich steht
     * sie dann am Schuljahr, hier ist sie nur ein Startwert.
     */
    className: text("class_name"),
    /**
     * Die Adresse, die das Kind eingetippt hat – **unbestätigt**.
     *
     * Sie ist der Wiederherstellungsanker, nicht die Einwilligung: Eingewilligt
     * hat erst, wer sich über einen Magic Link an dieser Adresse ausgewiesen
     * hat, und das steht als `consent_at` an `parent_student` (ADR 0006 D1).
     * Die bestätigte Adresse steht an `parent_account.email`.
     */
    parentEmail: text("parent_email"),
    /**
     * Wiederherstellung nach Passkey-Verlust (F-06d, ADR 0006 D4).
     *
     * Zwei Spalten statt einer eigenen Tabelle, absichtlich – der Token ist
     * einmalig: Ein neuer überschreibt den alten, Einlösen löscht beide.
     * Gespeichert wird nur der Hash, wie bei `student_session.token_hash`.
     * Verbraucht wird er ausschließlich über `app.redeem_recovery_token()`
     * (security definer), nie über einen gewöhnlichen UPDATE-Pfad – auch
     * nicht über `student_update_self` (F-06c): Diese Spalte taucht in
     * `updateOwnProfile()` schlicht nie im `SET` auf.
     */
    recoveryTokenHash: text("recovery_token_hash"),
    recoveryExpiresAt: timestamp("recovery_expires_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    // Ankerpunkt für die zusammengesetzten Fremdschlüssel der Folgetabellen:
    // Sie referenzieren (id, student_id), damit eine mandantenübergreifende
    // Verknüpfung strukturell unmöglich ist (ADR 0004 D2, auf student_id
    // umgestellt durch ADR 0006).
    unique("student_id_key").on(t.id),
  ],
);
