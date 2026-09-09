/**
 * Wie lange dauert ein Datenbankzugriff wirklich? (Ladezeiten-Untersuchung)
 *
 * Anlass: Angemeldete Seiten brauchen rund eine Sekunde, obwohl von außen
 * alles dagegen spricht – Vercel-Funktion und Supabase-Pooler stehen beide in
 * `eu-central-1`, die Antwort ist keine zwei Kilobyte groß, und seit dem
 * Runden-Fix sind es nur noch acht Datenbankrunden je Seite. Von außen lässt
 * sich eine angemeldete Seite nicht messen; diese Zeile schließt die Lücke.
 *
 * Bewusst schlicht: eine Zeile je Zugriff in die Serverausgabe, ablesbar in
 * den Vercel-Logs. Zusammen mit der Laufzeit, die Vercel je Aufruf selbst
 * ausweist, sagt die Differenz, wo die Zeit bleibt – Datenbank oder Rendern.
 *
 * **Auf Zeit gedacht.** Sobald die Frage beantwortet ist, kommt das wieder
 * raus. `TUTR_TIMING=aus` schaltet es ohne Deploy ab.
 */
export async function messeDb<T>(bezeichnung: string, fn: () => Promise<T>): Promise<T> {
  if (process.env.TUTR_TIMING === "aus") return fn();

  const start = Date.now();
  try {
    return await fn();
  } finally {
    console.log(`[db] ${bezeichnung} ${Date.now() - start}ms`);
  }
}
