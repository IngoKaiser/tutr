# RLS-Policies

Eine Datei je Aggregat, lexikalisch angewandt von `scripts/db-apply.mts`
(`npm run db:migrate`, für die Test-DB `npm run db:migrate:test`). Die
Dateien müssen **idempotent** sein: `drop policy if exists` vor jedem
`create policy`.

Grundlage: [ADR 0004](../../../docs/adr/0004-datenmodell-rls.md). Die
RLS-Matrix dort ist die Referenz dafür, wer was sehen darf.

## Checkliste für jede neue Tabelle

1. **`family_id`-Spalte.** Policies vergleichen genau diese Spalte, ohne
   Join. Zwei Ausprägungen:
   - Familiendaten: `not null`, plus zusammengesetzter Fremdschlüssel
     (`(student_id, family_id) → student(id, family_id)`), damit eine
     familienübergreifende Verknüpfung strukturell unmöglich ist (D2).
   - Referenzdaten: `nullable`, `NULL` = kuratiert (D7).
2. **Unique-Anker,** wenn spätere Tabellen zusammengesetzt referenzieren
   sollen: `unique (id, family_id)`, bei Bedarf auch `(id, student_id)`
   oder `(id, subject_id)` – siehe `topic` in `curriculum.ts`.
3. **Policy-Datei hier** mit `grant` für `tutr_app` und `enable row level
security`.
4. **Policy-Test** in der Testdatei des Aggregats. Mindestens: fremde
   Familie sieht nichts, und die Schreibrechte stimmen.
5. **Zeile in der RLS-Matrix** in ADR 0004 D4.

## Die drei Muster

**Familieneigen, Eltern schreiben** (`school_year`, `subject`,
`school_year_textbook`): Eltern `for all` auf die ganze Familie, Kind
`for select` zusätzlich gefiltert auf `student_id = app.student_id()`,
damit Geschwisterprofile getrennt bleiben.

**Familieneigen, Kind schreibt** (`topic`, `learning_objective`): umgekehrt
– Kind `for all` auf die eigenen Zeilen, Eltern `for select` auf die
Familie.

**Kuratiert oder eigen** (`textbook`, `chapter`, `school_profile`): braucht
**zwei** Policies, keine einzige.

```sql
for select using (family_id is null or family_id = app.family_id())
for all    using (family_id = app.family_id())
       with check (family_id = app.family_id());
```

Eine einzelne `for all`-Policy, deren `USING` auch `NULL` zulässt, wäre
angreifbar: Bei `UPDATE` filtert `USING` die Zielzeilen, eine kuratierte
Zeile passiert diesen Filter, und `WITH CHECK` ist durch dasselbe Update
erfüllbar, das `family_id` auf die eigene Familie setzt. Die Zeile wäre
für alle anderen Familien gekapert. Kuratierte Daten schreibt deshalb
ausschließlich die Migrationsrolle.

## Was der Metatest erzwingt

`src/db/rls.test.ts` lässt CI fehlschlagen, sobald eine Tabelle in `public`
ohne RLS oder ohne Policy bleibt. Er ersetzt kein Nachdenken über die
Richtung der Policy – nur über ihr Vorhandensein.

## Eltern sehen nie Tutor-Verläufe

`tutor_session` und `tutor_message` bekommen **keine** Eltern-Policy. Die
Zusammenfassung für Eltern ist eine eigene Tabelle
(`tutor_session_summary`), weil Postgres keine spaltenweise Sichtbarkeit
innerhalb einer Policy kennt (D4).
