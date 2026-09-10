import { sql } from "drizzle-orm";

/**
 * „Diese Vokabel darf abgefragt werden" – als SQL (V-09).
 *
 * Die Gegenprobe zu `withDerivedUnsicher()` in `review-list.ts`: Was dort
 * ein „prüfen" trägt, wird hier vom Üben ausgeschlossen. Zwei Fassungen
 * derselben Regel, weil sie an zwei Orten gebraucht wird – die Liste kennt
 * alle Zeilen eines Sets im Speicher, die Übungsabfrage darf dafür nicht
 * erst alle Vokabeln laden. `review-list.test.ts` und die Policy-Tests
 * halten beide Fassungen an denselben Beispielen gegeneinander.
 *
 * **Erwartet den Alias `vi` für `vocab_item`.** Bewusst eine Konstante und
 * kein Alias-Parameter: `sql.raw()` für einen Bezeichner wäre eine
 * Injektionsfläche, die dieser Anwendungsfall nicht braucht.
 *
 * `vi.id is null` lässt Lernziel-Karten (M-03, `card.vocab_item_id` null)
 * durch – die kommen aus einem Left Join und haben gar keine Vokabelzeile,
 * die man prüfen könnte.
 *
 * Warum überhaupt: Eine Zeile, bei der noch unklar ist, ob sie richtig ist,
 * abzufragen heißt, dem Kind womöglich Falsches als richtig zu bestätigen.
 * Erst akzeptieren (oder korrigieren, oder wegwerfen), dann üben.
 */
export const practiceReadySql = sql`(
  vi.id is null or (
    btrim(vi.term) <> '' and btrim(vi.translation) <> ''
    and (
      vi.confirmed_at is not null
      or (
        not vi.recognition_uncertain
        and not exists (
          select 1 from vocab_item other
          where other.student_id = vi.student_id
            and other.subject_id = vi.subject_id
            and other.id <> vi.id
            and lower(btrim(other.term)) = lower(btrim(vi.term))
            and lower(btrim(other.translation)) <> lower(btrim(vi.translation))
        )
      )
    )
  )
)`;
