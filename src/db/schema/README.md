# Schema-Dateien

Eine Datei pro Aggregat. Mandant ist `student` (ADR 0006): Jede Tabelle trägt
`student_id`, jede Policy vergleicht genau diese Spalte.

| Datei               | Inhalt                                                        |
| ------------------- | ------------------------------------------------------------- |
| `columns.ts`        | Spalten, die jede Tabelle trägt (`created_at`, `updated_at`)  |
| `student.ts`        | Das Kind – die Wurzel des Modells                             |
| `parent.ts`         | `parent_account` (Identität, später Abo) und `parent_student` |
| `auth.ts`           | Passkey und Gerätesitzung des Kindes                          |
| `curriculum.ts`     | Schuljahr, Fach, Thema, Lernziel, Vorläufer                   |
| `textbook.ts`       | Lehrwerk-Registry und Zuordnung Schuljahr+Fach → Lehrwerk     |
| `school-profile.ts` | Schulprofil (kuratiert oder eigen)                            |

Noch offen: `cards.ts`, `calendar.ts`, `tutor.ts` – siehe `docs/konzept.md` §8
und den Backlog in `docs/PLAN.md`.
