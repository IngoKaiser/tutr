import { sql, type SQL } from "drizzle-orm";

/**
 * Ein `text[]`-Wert für rohes SQL (`tx.execute(sql\`…\`)`).
 *
 * **Der Fund vom 12.9.2026:** `sql\`… set own_groups = ${eineListe} …\`` sieht
 * harmlos aus, ist es aber nicht – die zugrunde liegende `postgres`-
 * Bibliothek erkennt ein rohes JS-Array im rohen `sql`-Tag **nicht** als
 * Postgres-Array. Ohne einen erkannten Typ hängt sie die Elemente mit
 * `Array.prototype.toString()` aneinander (`"8.5,8.5 Eng"` statt
 * `{8.5,"8.5 Eng"}`), Postgres lehnt das dann als „malformed array literal"
 * ab. Betraf `speichereEigeneGruppen()` (`school_year.own_groups`) und
 * `uebernehmen()` (`calendar_event.groups`, K-03/K-04) – der „Weiter"-Knopf
 * der Gruppen-Einrichtung reagierte scheinbar gar nicht, weil die
 * verworfene Fehlermeldung nie bis in die Oberfläche kam (`void
 * gruppenEinrichtungSpeichern()` fängt die Ablehnung nicht ab).
 *
 * `ARRAY[$1, $2, …]::text[]` umgeht das: jedes Element ein eigener,
 * typsicher gebundener Parameter statt eines selbst gebauten Literals –
 * keine Escaping-Sonderfälle (Kommas, Anführungszeichen, geschweifte
 * Klammern in einem Gruppentoken wären beim Literal-Bauen ein eigenes
 * Fehlerfeld gewesen).
 */
export function pgTextArray(values: readonly string[]): SQL {
  if (values.length === 0) return sql`ARRAY[]::text[]`;
  return sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  )}]::text[]`;
}
