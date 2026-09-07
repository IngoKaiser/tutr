import { timestamp } from "drizzle-orm/pg-core";

/**
 * Spalten, die jede Tabelle trägt (ADR 0004 D8). Lag bisher in jeder
 * Schemadatei einzeln – vier gleiche Kopien, die auseinanderlaufen konnten.
 */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
