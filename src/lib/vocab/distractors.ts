/**
 * Falschantworten für Multiple Choice (V-02) – gezogen aus den anderen
 * Vokabeln derselben Session, keine erfundenen. Rein, damit die
 * Dopplungs- und Ausschlusslogik ohne Browser testbar ist.
 */

function shuffled<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}

/** Bis zu `count` andere Antworten, ohne die richtige und ohne Dopplungen. */
export function pickDistractors(
  pool: string[],
  correct: string,
  count: number,
  rng: () => number = Math.random,
): string[] {
  const normalizedCorrect = correct.trim().toLowerCase();
  const seen = new Set<string>();
  const candidates = pool.filter((value) => {
    const key = value.trim().toLowerCase();
    if (key === normalizedCorrect || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return shuffled(candidates, rng).slice(0, count);
}

/** Die vollständigen Optionen, richtige Antwort an zufälliger Stelle. */
export function buildMultipleChoiceOptions(
  pool: string[],
  correct: string,
  count: number,
  rng: () => number = Math.random,
): string[] {
  const distractors = pickDistractors(pool, correct, count, rng);
  return shuffled([correct, ...distractors], rng);
}
