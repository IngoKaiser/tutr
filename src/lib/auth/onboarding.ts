import { sql } from "drizzle-orm";

import { withActor, withAuthUser, type Actor } from "@/db/actor";

/**
 * Vom bestätigten Supabase-Login zum Actor (F-05, umgestellt in F-11, F-06b).
 *
 * Zwei Regeln aus ADR 0006, die zusammen fast allen Code hier ersetzen, den
 * es vorher gab:
 *
 * 1. **Ein Kind entsteht nur durch die eigene Registrierung.** Ein Login
 *    legt nichts an – vorher entstand hier bei jedem ersten Eltern-Login eine
 *    Familie, was seit ADR 0005 leere Geisterfamilien neben den echten
 *    erzeugt hätte.
 * 2. **Ein Elternkonto entsteht nur durch den Beitritt zu einem bestehenden
 *    Kind.** Wer sich anmeldet und mit niemandem verknüpft ist, sieht einen
 *    leeren Zustand statt frisch angelegter Daten.
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
type CandidateRow = { id: string; first_name: string; grade_level: number };

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
 * Der Beitritt (F-06b, ADR 0006 D8): Existiert noch kein Elternkonto, sucht
 * diese Funktion Kinder, die genau diese – von Supabase bestätigte – Adresse
 * eingetragen haben, und verknüpft sich mit allen auf einmal.
 *
 * Kein zweiter Klick, keine separate Einwilligungs-Oberfläche: Der Magic-
 * Link-Login an dieser Adresse *ist* die Handlung, die laut D8 verknüpft.
 * `consent_at` wird deshalb sofort gesetzt.
 *
 * Passt die Adresse zu keinem Kind, entsteht **kein** Konto – das ist die
 * Regel aus D1, nicht ein Sonderfall. Der Aufrufer sieht dann denselben
 * leeren Zustand wie ein Elternteil, dessen einziges Kind gelöscht wurde
 * (`parentWithoutStudent`); ein eigenes Datenbankfeld dafür gäbe es nur, um
 * etwas zu speichern, das sich genauso gut jedes Mal neu prüfen lässt (D7).
 */
async function join(authUserId: string, email: string): Promise<ParentLogin | null> {
  const candidates = await withAuthUser(authUserId, (tx) =>
    tx.execute<CandidateRow>(
      sql`select id, first_name, grade_level from app.students_by_parent_email(${email})`,
    ),
  );
  if (candidates.length === 0) return null;

  const parentId = crypto.randomUUID();
  const name = email.split("@")[0] || "Elternteil";
  // studentId ist hier nur eine Typanforderung des Actors – die Policies für
  // parent_account und parent_student prüfen ihre eigenen Spalten, nicht
  // app.student_id() (ADR 0006 D2 gilt für die Lerndaten, nicht für die
  // Identität).
  const actor: Actor = { role: "parent", parentId, studentId: candidates[0].id };

  try {
    await withActor(actor, async (tx) => {
      await tx.execute(
        sql`insert into parent_account (id, auth_user_id, email, name)
            values (${parentId}, ${authUserId}, ${email}, ${name})`,
      );
      for (const candidate of candidates) {
        await tx.execute(
          sql`insert into parent_student (parent_account_id, student_id, consent_at)
              values (${parentId}, ${candidate.id}, now())`,
        );
      }
    });
  } catch {
    // Zwei gleichzeitige erste Logins derselben Adresse sind der einzige
    // erwartbare Fall: Der zweite läuft in `parent_account_auth_user_id_key`.
    // Statt den Fehler durchzureichen, einfach erneut nachschlagen – der
    // erste Versuch hat das Konto inzwischen angelegt.
    return parentLogin(authUserId);
  }

  return {
    parentId,
    email,
    students: candidates.map((c) => ({ id: c.id, firstName: c.first_name })),
  };
}

/** Der Einstiegspunkt nach jedem bestätigten Login: anmelden, sonst beitreten. */
export async function joinOrLogin(authUserId: string, email: string): Promise<ParentLogin | null> {
  const existing = await parentLogin(authUserId);
  if (existing) return existing;
  return join(authUserId, email);
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
