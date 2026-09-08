import { cookies } from "next/headers";

import { STUDENT_SWITCH_COOKIE } from "./student-switch-shared";

/**
 * Welches Kind ein Elternteil mit mehreren gerade ansieht (F-06b).
 *
 * Keine eigene Berechtigungsprüfung nötig: Der Aufrufer übergibt die Liste
 * der tatsächlich verknüpften Kinder (`ParentLogin.students`), und das
 * gewählte muss darin vorkommen – sonst zählt das erste. Damit kann ein
 * veraltetes oder manipuliertes Cookie höchstens auf das erste Kind
 * zurückfallen, nie auf ein fremdes zeigen.
 */
export async function selectedStudentId(students: { id: string }[]): Promise<string | null> {
  if (students.length === 0) return null;

  const store = await cookies();
  const chosen = store.get(STUDENT_SWITCH_COOKIE)?.value;
  const match = students.find((s) => s.id === chosen);

  return (match ?? students[0]).id;
}
