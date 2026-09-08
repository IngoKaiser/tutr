"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { STUDENT_SWITCH_COOKIE } from "./student-switch-shared";

/**
 * Setzt, welches Kind ein Elternteil ansieht. Server Action statt
 * `document.cookie`, aus demselben Grund wie beim Dev-Umschalter: Das Setzen
 * eines Cookies ist eine Mutation (CLAUDE.md).
 *
 * Ob `studentId` zu diesem Elternteil gehört, prüft nicht diese Funktion,
 * sondern `selectedStudentId()` beim nächsten Lesen – ein manipuliertes
 * Cookie fällt dort auf das erste Kind zurück, öffnet aber nie ein fremdes.
 */
export async function setSelectedStudent(studentId: string): Promise<void> {
  const store = await cookies();
  store.set(STUDENT_SWITCH_COOKIE, studentId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}
