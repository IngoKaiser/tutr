import { sql } from "drizzle-orm";

import { withActor, type Actor } from "@/db/actor";

/**
 * Kontolöschung (F-06e, ADR 0006 D5/D6).
 *
 * Die Datenbank kennt nur eine Regel für alle drei Wege: `student_delete`
 * löscht die Zeile, auf die der eigene Actor-Kontext zeigt, `parent_account_
 * own` (schon vorhanden) die eigene Elternkonto-Zeile. Was hier steht, ist
 * nur noch die Unterscheidung, die die Datenbank bewusst nicht trifft: ob
 * benachrichtigt wird, und wen.
 *
 * Jede der drei Funktionen erwartet die passende Rolle und wirft sonst –
 * dieselbe Absicherung wie bei `issueRecoveryToken()`: ein Aufruf mit der
 * falschen Rolle ist ein Programmierfehler im Aufrufer, kein Zustand, den
 * die Oberfläche je erreichen sollte.
 */

type ParentRow = { id: string; email: string };
type NameRow = { first_name: string };

/** Ein Elternteil löscht das Kind, auf das sein Actor gerade zeigt. Keine Mail – es weiß es ja. */
export async function deleteChildAsParent(actor: Actor): Promise<void> {
  if (actor.role !== "parent") {
    throw new Error("deleteChildAsParent ist nur für Eltern-Actor gedacht.");
  }
  await withActor(actor, (tx) =>
    tx.execute(sql`delete from student where id = ${actor.studentId}`),
  );
}

export type NotifyParent = { email: string; remainingFirstNames: string[] };
export type SelfDeletionResult = { firstName: string; notify: NotifyParent[] };

/**
 * Ein Kind löscht sich selbst. Liest den eigenen Vornamen und die
 * verknüpften Eltern **vor** dem Löschen (danach zeigt der eigene
 * Actor-Kontext auf nichts mehr), löscht dann, und fragt erst danach – in
 * derselben Transaktion – bei `app.linked_students()` nach, wer je Elternteil
 * noch übrig ist. Die Kaskade hat das gelöschte Kind zu diesem Zeitpunkt
 * schon entfernt, ein manuelles Ausschließen entfällt dadurch.
 *
 * Verschickt selbst keine Mail – das bleibt Sache des Aufrufers (Server
 * Action), damit diese Funktion bei einem Mail-Ausfall trotzdem sauber
 * zurückgibt, was gelöscht wurde.
 */
export async function deleteSelfAsStudent(actor: Actor): Promise<SelfDeletionResult> {
  if (actor.role !== "student") {
    throw new Error("deleteSelfAsStudent ist nur für Kind-Actor gedacht.");
  }

  return withActor(actor, async (tx) => {
    const [self] = await tx.execute<NameRow>(
      sql`select first_name from student where id = ${actor.studentId}`,
    );
    const parents = await tx.execute<ParentRow>(sql`select id, email from parent_account`);

    await tx.execute(sql`delete from student where id = ${actor.studentId}`);

    const notify: NotifyParent[] = [];
    for (const parent of parents) {
      const remaining = await tx.execute<NameRow>(
        sql`select first_name from app.linked_students(${parent.id})`,
      );
      notify.push({
        email: parent.email,
        remainingFirstNames: remaining.map((r) => r.first_name),
      });
    }

    return { firstName: self?.first_name ?? "", notify };
  });
}

/** Ein Elternteil löscht das eigene Konto. Die Kinder bleiben unberührt (`parent_account_own`, `on delete cascade` nur auf `parent_student`). */
export async function deleteParentAccount(actor: Actor): Promise<void> {
  if (actor.role !== "parent") {
    throw new Error("deleteParentAccount ist nur für Eltern-Actor gedacht.");
  }
  await withActor(actor, (tx) =>
    tx.execute(sql`delete from parent_account where id = ${actor.parentId}`),
  );
}
