import { sql } from "drizzle-orm";

import { withAuthUser, type Actor } from "@/db/actor";

/**
 * Vom bestätigten Supabase-Login zum Actor (F-05, umgestellt in F-11).
 *
 * Zwei Regeln aus ADR 0006, die zusammen fast allen Code hier ersetzen, den
 * es vorher gab:
 *
 * 1. **Ein Kind entsteht nur durch die eigene Registrierung.** Ein Login
 *    legt nichts an – vorher entstand hier bei jedem ersten Eltern-Login eine
 *    Familie, was seit ADR 0005 leere Geisterfamilien neben den echten
 *    erzeugt hätte.
 * 2. **Ein Elternkonto entsteht nur durch den Beitritt zu einem bestehenden
 *    Kind** (F-06b). Wer sich anmeldet und mit niemandem verknüpft ist, sieht
 *    einen leeren Zustand statt frisch angelegter Daten.
 *
 * Das Nachschlagen läuft über die Anmeldeschleuse `tutr.auth_user_id`
 * (ADR 0006 D3): Nach dem Magic Link steht die Auth-ID fest, ein Kind aber
 * noch nicht.
 */

export type ParentLogin = {
  parentId: string;
  email: string;
  /** Verknüpfte Kinder, nach Vorname sortiert. Kann leer sein. */
  students: { id: string; firstName: string }[];
};

type AccountRow = { id: string; email: string };
type StudentRow = { id: string; first_name: string };

/**
 * Elternkonto und verknüpfte Kinder in einem Zug. Beides in derselben
 * Schleuse, weil die Policies `parent_student_self` und
 * `student_read_for_parent_login` genau darauf ausgelegt sind.
 */
export async function parentLogin(authUserId: string): Promise<ParentLogin | null> {
  return withAuthUser(authUserId, async (tx) => {
    const accounts = await tx.execute<AccountRow>(
      sql`select id, email from parent_account limit 1`,
    );
    const account = accounts[0];
    if (!account) return null;

    const students = await tx.execute<StudentRow>(
      sql`select id, first_name from student order by first_name`,
    );

    return {
      parentId: account.id,
      email: account.email,
      students: students.map((s) => ({ id: s.id, firstName: s.first_name })),
    };
  });
}

/**
 * Der Actor für ein angemeldetes Elternteil, das ein bestimmtes Kind ansieht.
 *
 * `studentId` muss aus `parentLogin().students` stammen – genau dort wurde
 * die Berechtigung geprüft. Danach fragt keine Policy mehr danach, sie
 * vergleichen nur noch `student_id` (ADR 0006 D2).
 */
export function parentActor(login: ParentLogin, studentId: string): Actor | null {
  if (!login.students.some((s) => s.id === studentId)) return null;
  return { role: "parent", parentId: login.parentId, studentId };
}
