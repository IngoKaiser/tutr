"use client";

import { useTransition } from "react";

import { setSelectedStudent } from "@/lib/student-switch-action";

/**
 * Welches Kind ein Elternteil ansieht (F-06b). Nur sichtbar, wenn mehr als
 * eines verknüpft ist – bei einem Kind wäre die Wahl keine.
 */
export function StudentSwitch({
  students,
  current,
}: {
  students: { id: string; firstName: string }[];
  current: string;
}) {
  const [switching, startSwitch] = useTransition();

  if (students.length < 2) return null;

  return (
    <label className="flex items-center gap-1.5 text-xs">
      <span className="text-tinte-leise">Kind</span>
      <select
        value={current}
        disabled={switching}
        onChange={(e) => startSwitch(() => setSelectedStudent(e.target.value))}
        className="border-linie-stark bg-flaeche text-tinte focus-visible:outline-koenigsblau rounded-md border px-2 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1"
      >
        {students.map((s) => (
          <option key={s.id} value={s.id}>
            {s.firstName}
          </option>
        ))}
      </select>
    </label>
  );
}
