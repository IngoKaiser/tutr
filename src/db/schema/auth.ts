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

import { timestamps } from "./columns";
import { student } from "./student";

/**
 * Anmeldung des Kindes: Passkey und Gerätesitzung (F-06, ADR 0005/0006).
 *
 * Beides gehört dem Kind, nicht dem Gerät – deshalb hängen beide Tabellen an
 * `student` und tragen wie alle anderen `student_id` (ADR 0006 D1).
 */

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
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
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
    studentId: uuid("student_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    deviceLabel: text("device_label"),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    /** Abmelden setzt diesen Zeitstempel, statt die Zeile zu löschen. */
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.studentId], foreignColumns: [student.id] }).onDelete("cascade"),
    unique("student_session_token_hash_key").on(t.tokenHash),
    index("student_session_student_idx").on(t.studentId),
  ],
);
