/**
 * Notenschlüssel: Prozent -> Note (1–6), konfigurierbar pro Schulprofil (Konzept §7).
 * Default orientiert sich an gängigen Hamburger Gymnasial-Schlüsseln; wird im Schulprofil überschrieben.
 */
export type GradeScale = Readonly<Record<1 | 2 | 3 | 4 | 5, number>>; // Mindest-Prozent für Note

export const DEFAULT_GRADE_SCALE: GradeScale = { 1: 92, 2: 81, 3: 67, 4: 50, 5: 30 };

export function percentToGrade(
  percent: number,
  scale: GradeScale = DEFAULT_GRADE_SCALE,
): 1 | 2 | 3 | 4 | 5 | 6 {
  if (!Number.isFinite(percent)) throw new RangeError("Prozentwert muss eine Zahl sein.");
  const p = Math.min(100, Math.max(0, percent));
  if (p >= scale[1]) return 1;
  if (p >= scale[2]) return 2;
  if (p >= scale[3]) return 3;
  if (p >= scale[4]) return 4;
  if (p >= scale[5]) return 5;
  return 6;
}

export function pointsToPercent(points: number, maxPoints: number): number {
  if (maxPoints <= 0) throw new RangeError("Maximalpunktzahl muss größer als 0 sein.");
  return Math.round((points / maxPoints) * 1000) / 10;
}
