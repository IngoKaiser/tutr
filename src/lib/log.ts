/**
 * Schützt Server-Logs vor Log-Injection (CodeQL `js/log-injection`).
 *
 * Ein Wert aus der Anfrage (z. B. eine ID aus dem Request-Body) landet ohne
 * Prüfung in `console.error(...)` – ein Zeilenumbruch darin könnte eine
 * gefälschte, harmlos aussehende Logzeile einschleusen. Entfernt nur
 * Zeilenumbrüche, verändert sonst nichts: Für ein Serverlog reicht das, eine
 * vollständige Eingabevalidierung ist hier nicht der Punkt.
 */
export function saniereFuerLog(wert: string): string {
  return wert.replace(/[\r\n]+/g, " ");
}
