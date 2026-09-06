import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { dbEnv } from "@/lib/env";

const { DATABASE_URL } = dbEnv();

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
};

/**
 * postgres.js-Verbindung. `prepare: false` ist für den Supabase Transaction
 * Pooler (PgBouncer, Port 6543) zwingend – Prepared Statements werden dort
 * nicht unterstützt. In der Entwicklung über `globalThis` wiederverwendet,
 * damit HMR nicht bei jedem Reload neue Verbindungen öffnet.
 */
export const sql = globalForDb.sql ?? postgres(DATABASE_URL, { prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.sql = sql;
}

export const db = drizzle({ client: sql });
