/**
 * Termine sortieren, in Zeitfenster einteilen und beschriften (K-01, H-01).
 *
 * Rein und unit-testbar: kennt keine Datenbank, nur ISO-Datumsstrings
 * (`YYYY-MM-DD`) und ein „heute". Rechnet in UTC, damit das Ergebnis nicht
 * von der Zeitzone des Servers abhängt (wie `currentSchoolYear`).
 */

export type CalendarEventType = "klassenarbeit" | "test" | "muendlich" | "abgabe" | "sonstiges";
export type CalendarEventStatus = "geplant" | "abgesagt";

export type CalendarEvent = {
  id: string;
  subjectId: string;
  subjectName: string;
  type: CalendarEventType;
  title: string;
  /** ISO-Datum `YYYY-MM-DD`. */
  date: string;
  status: CalendarEventStatus;
};

const TAG_MS = 24 * 60 * 60 * 1000;

/** Ganze Tage von `today` bis zum Termin. Negativ, wenn der Termin vorbei ist. */
export function daysUntil(dateISO: string, today: Date): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  const ziel = Date.UTC(y!, m! - 1, d!);
  const heute = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((ziel - heute) / TAG_MS);
}

/**
 * Rückt der Termin nah genug heran, dass „Heute" ihn hervorhebt (H-01)?
 *
 * Eine Woche, weil das ungefähr der Zeitraum ist, in dem Vorbereitung noch
 * etwas ändert – und weil ein Countdown, der vier Wochen lang hervorgehoben
 * bleibt, nichts mehr unterscheidet. Vergangene Termine sind nie „bald";
 * `naechsterTermin()` filtert sie zwar schon weg, aber die Regel soll für
 * sich stimmen.
 */
export function istBald(days: number): boolean {
  return days >= 0 && days <= 7;
}

/**
 * Formatiert einen ISO-Tag als Kopfzeile, z. B. „Freitag, 11. September"
 * (H-01). `timeZone: "UTC"` passt zu `daysUntil()`: Beide lesen denselben
 * Tag aus demselben String, statt dass die Kopfzeile in einer Zeitzone
 * rutscht, in der die Countdown-Rechnung nicht rutscht.
 */
const TAGES_FORMAT = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

export function langesDatum(dateISO: string): string {
  return TAGES_FORMAT.format(new Date(`${dateISO}T00:00:00Z`));
}

/** „heute" · „morgen" · „in 5 Tagen" · „gestern" · „vor 3 Tagen". */
export function countdownLabel(days: number): string {
  if (days === 0) return "heute";
  if (days === 1) return "morgen";
  if (days === -1) return "gestern";
  if (days > 1) return `in ${days} Tagen`;
  return `vor ${-days} Tagen`;
}

export type HorizonBuckets = {
  /** Geplant, in den nächsten `weeks` Wochen – die Hauptliste. */
  kommend: CalendarEvent[];
  /** Geplant, aber weiter weg – „später im Schuljahr". */
  spaeter: CalendarEvent[];
  /** Vorbei oder abgesagt – die Historie. Neueste zuerst. */
  vergangen: CalendarEvent[];
};

/**
 * Teilt die Termine in drei Fenster. `weeks` ist das Sichtfenster der
 * Hauptliste (Standard 4, §6 M7). Ein abgesagter Termin gilt immer als
 * Historie, egal wann er ist – „behält Verlauf" (§6 M7).
 */
export function splitByHorizon(events: CalendarEvent[], today: Date, weeks = 4): HorizonBuckets {
  const grenze = weeks * 7;
  const kommend: CalendarEvent[] = [];
  const spaeter: CalendarEvent[] = [];
  const vergangen: CalendarEvent[] = [];

  for (const event of events) {
    const tage = daysUntil(event.date, today);
    if (event.status === "abgesagt" || tage < 0) {
      vergangen.push(event);
    } else if (tage <= grenze) {
      kommend.push(event);
    } else {
      spaeter.push(event);
    }
  }

  const nachDatum = (a: CalendarEvent, b: CalendarEvent) => a.date.localeCompare(b.date);
  kommend.sort(nachDatum);
  spaeter.sort(nachDatum);
  vergangen.sort((a, b) => b.date.localeCompare(a.date));

  return { kommend, spaeter, vergangen };
}

const TYPE_LABEL: Record<CalendarEventType, string> = {
  klassenarbeit: "Klassenarbeit",
  test: "Test",
  muendlich: "Mündlich",
  abgabe: "Abgabe",
  sonstiges: "Sonstiges",
};

export function eventTypeLabel(type: CalendarEventType): string {
  return TYPE_LABEL[type];
}

export const EVENT_TYPE_OPTIONS: { value: CalendarEventType; label: string }[] = (
  Object.keys(TYPE_LABEL) as CalendarEventType[]
).map((value) => ({ value, label: TYPE_LABEL[value] }));
