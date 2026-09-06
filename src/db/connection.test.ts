// @vitest-environment node
import { expect, test } from "vitest";

/**
 * Integrationstest: echte Verbindung zur Supabase-Datenbank.
 * Läuft nur bei `npm run db:check` (setzt RUN_DB_TESTS=1) mit gesetzter
 * DATABASE_URL. Im normalen `npm run check` / in CI wird er übersprungen,
 * damit der Pre-Commit-Hook nicht von einer laufenden DB abhängt.
 */
const enabled = process.env.RUN_DB_TESTS === "1" && Boolean(process.env.DATABASE_URL);

test.skipIf(!enabled)("verbindet sich mit der Supabase-Datenbank (SELECT 1)", async () => {
  const { sql } = await import("./index");
  try {
    const rows = await sql<{ ok: number }[]>`select 1 as ok`;
    expect(rows[0]?.ok).toBe(1);
  } finally {
    await sql.end();
  }
});
