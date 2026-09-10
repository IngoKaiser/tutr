import { redirect } from "next/navigation";

import { loginStatus } from "@/lib/auth/actor";

import { loadCalendar } from "./actions";
import { CalendarList } from "./calendar-list";

export const metadata = { title: "Prüfungen · tutr" };

/**
 * Prüfungskalender (K-01, Konzept §5/§6 M7).
 *
 * Die schmale Fassung: Termine von Hand. Lernplan, Probeprüfungen und Noten
 * (§6 M7 Rest) kommen später. Die Zeitfenster-Logik steckt in
 * `@/lib/calendar/upcoming` und ist dort unit-getestet; hier wird nur der
 * „heute"-Stichtag gesetzt (UTC, wie `daysUntil`) und weitergereicht.
 */
export default async function ExamsPage() {
  const { actor } = await loginStatus();
  if (!actor) redirect("/anmelden");

  const data = await loadCalendar();
  const todayISO = new Date().toISOString().slice(0, 10);

  // `canManage` ist hier immer wahr: beide Rollen dürfen Termine anlegen und
  // ändern (ADR 0004 D4, Zeile `calendar_event`) – anders als bei Themen und
  // Vokabeln. Der Schalter bleibt trotzdem, für eine spätere Nur-Lesen-Sicht.
  return (
    <CalendarList
      events={data?.events ?? null}
      subjects={data?.subjects ?? null}
      todayISO={todayISO}
      canManage
    />
  );
}
