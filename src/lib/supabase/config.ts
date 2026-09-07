/**
 * Ist Supabase überhaupt konfiguriert?
 *
 * Mit `SKIP_ENV_VALIDATION=1` (CI-Build, E2E-Lauf) liefert `clientEnv()`
 * undefinierte Werte, statt zu prüfen. `createServerClient` wirft damit – und
 * weil der Proxy bei jeder Anfrage läuft, läge die gesamte App still.
 *
 * Statt eines Absturzes gibt es hier eine Antwort, mit der Aufrufer umgehen
 * können. Wie sie damit umgehen, hängt von der Umgebung ab und steht an der
 * jeweiligen Aufrufstelle – nicht hier.
 */
export type SupabaseConfig = { url: string; key: string };

export function supabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}
