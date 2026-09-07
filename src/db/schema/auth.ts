import {
  bigint,
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

import { family, student } from "./family";

/**
 * Anmeldung des Kindes: Passkey und Session (F-06, ADR 0005).
 *
 * Das Kind hat bewusst keine E-Mail und kein Passwort. Der Passkey ist die
 * dauerhafte Anmeldung, die Session nur ein Zwischenspeicher. Beides gehört
 * dem Kind, nicht dem Gerät – deshalb hängen beide Tabellen an `student` und
 * schleppen wie alle anderen `family_id` mit (ADR 0004 D2).
 */

const zeitstempel = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/**
 * Ein Passkey. Auffindbar angelegt (`residentKey: "required"`), damit das
 * Gerät die Kontozuordnung trägt und die Anmeldung ohne Kennung auskommt –
 * die technische Voraussetzung, an der ADR 0005 hängt.
 *
 * Gespeichert wird nur der öffentliche Schlüssel. Der private verlässt das
 * Gerät nie; das ist der ganze Punkt von WebAuthn.
 */
export const studentCredential = pgTable(
  "student_credential",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull(),
    studentId: uuid("student_id").notNull(),
    // Base64url, wie WebAuthn sie liefert. Global eindeutig, nicht nur je Kind:
    // Beim Anmelden ist das Kind noch unbekannt, gesucht wird allein hierüber.
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    // Zähler gegen geklonte Authenticators. Viele Plattform-Passkeys lassen ihn
    // auf 0 – dann ist er wertlos, aber nie schädlich.
    counter: bigint("counter", { mode: "number" }).notNull().default(0),
    transports: text("transports").array(),
    /** Für die Geräteliste in der Elternansicht (F-06b). Frei benannt. */
    deviceLabel: text("device_label"),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    ...zeitstempel,
  },
  (t) => [
    foreignKey({ columns: [t.familyId], foreignColumns: [family.id] }).onDelete("cascade"),
    foreignKey({
      name: "student_credential_student_fk",
      columns: [t.studentId, t.familyId],
      foreignColumns: [student.id, student.familyId],
    }).onDelete("cascade"),
    unique("student_credential_credential_id_key").on(t.credentialId),
  ],
);

/**
 * Eine angemeldete Sitzung auf einem Gerät.
 *
 * Gespeichert wird der SHA-256 des Tokens, nicht das Token selbst: Wer die
 * Tabelle liest, kann sich damit nicht anmelden.
 *
 * Rollierend über 30 Tage (ADR 0005). Länger kauft kaum Bequemlichkeit – der
 * Passkey macht das Wiederkommen zu einem Fingertipp –, hielte aber eine
 * Sitzung auf einem verlorenen Gerät unnötig lange offen.
 */
export const studentSession = pgTable(
  "student_session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    familyId: uuid("family_id").notNull(),
    studentId: uuid("student_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    deviceLabel: text("device_label"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Abmelden setzt diesen Zeitstempel, statt die Zeile zu löschen. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...zeitstempel,
  },
  (t) => [
    foreignKey({ columns: [t.familyId], foreignColumns: [family.id] }).onDelete("cascade"),
    foreignKey({
      name: "student_session_student_fk",
      columns: [t.studentId, t.familyId],
      foreignColumns: [student.id, student.familyId],
    }).onDelete("cascade"),
    unique("student_session_token_hash_key").on(t.tokenHash),
    index("student_session_student_idx").on(t.studentId),
  ],
);
