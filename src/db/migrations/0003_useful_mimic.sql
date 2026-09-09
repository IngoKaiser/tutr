-- Fachbindung im Vokabelmodell (V-05, ADR 0008 D1/D2).
--
-- Von `drizzle-kit generate` nachbearbeitet, nicht unberührt übernommen: Eine
-- `not null`-Spalte auf einer gefüllten Tabelle braucht drei Schritte
-- (nullbar anlegen, befüllen, dann erst `set not null`), das erzeugt
-- drizzle-kit nicht von selbst. Die Struktur bleibt aus dem Schema generiert,
-- nur der Backfill dazwischen ist von Hand.

ALTER TABLE "vocab_set_item" DROP CONSTRAINT "vocab_set_item_set_fk";
--> statement-breakpoint
ALTER TABLE "vocab_set_item" DROP CONSTRAINT "vocab_set_item_item_fk";
--> statement-breakpoint

-- Erst nullbar, sonst scheitert das ALTER TABLE selbst an vorhandenen Zeilen.
ALTER TABLE "vocab_item" ADD COLUMN "subject_id" uuid;
--> statement-breakpoint
ALTER TABLE "vocab_set_item" ADD COLUMN "subject_id" uuid;
--> statement-breakpoint

-- `vocab_set_item.subject_id` ist unzweideutig: Sie kopiert nur das Fach des
-- Sets, an dem die Zeile ohnehin schon hängt.
UPDATE "vocab_set_item" vsi
SET "subject_id" = vs."subject_id"
FROM "vocab_set" vs
WHERE vs."id" = vsi."vocab_set_id";
--> statement-breakpoint

-- `vocab_item.subject_id` leitet sich aus den Sets ab, in denen die Vokabel
-- steckt – eindeutig nur, wenn sie in genau einem Fach vorkommt. Bricht hart
-- ab statt zu raten, wenn eine Vokabel in Sets verschiedener Fächer steckt:
-- Das wäre ein echter Datenkonflikt, den ADR 0008 D1 gerade ausschließen
-- soll, kein Fall für eine automatische Wahl.
DO $$
DECLARE
  mehrdeutig integer;
BEGIN
  SELECT count(*) INTO mehrdeutig FROM (
    SELECT vi.id
    FROM "vocab_item" vi
    JOIN "vocab_set_item" vsi ON vsi."vocab_item_id" = vi."id"
    GROUP BY vi.id
    HAVING count(DISTINCT vsi."subject_id") > 1
  ) mehrdeutige_items;

  IF mehrdeutig > 0 THEN
    RAISE EXCEPTION
      '% Vokabel(n) stecken in Sets verschiedener Fächer – Backfill für vocab_item.subject_id nicht eindeutig. Von Hand auflösen, bevor diese Migration erneut läuft.',
      mehrdeutig;
  END IF;
END
$$;
--> statement-breakpoint

UPDATE "vocab_item" vi
SET "subject_id" = einzig.subject_id
FROM (
  SELECT DISTINCT ON (vsi."vocab_item_id") vsi."vocab_item_id", vsi."subject_id"
  FROM "vocab_set_item" vsi
) einzig
WHERE einzig."vocab_item_id" = vi."id";
--> statement-breakpoint

-- Eine Vokabel in keinem Set (möglich seit `deleteSet()`, V-03a) hat keine
-- Quelle für den Backfill – genau der Fall, den ADR 0008 D1 als zweiten
-- Grund für die eigene Spalte nennt. Auch hier: laut scheitern statt eine
-- Vokabel mit leerem Fach durchzulassen, die der nächste Schritt sonst
-- klaglos in NOT NULL zwänge.
DO $$
DECLARE
  ohne_set integer;
BEGIN
  SELECT count(*) INTO ohne_set FROM "vocab_item" WHERE "subject_id" IS NULL;
  IF ohne_set > 0 THEN
    RAISE EXCEPTION
      '% Vokabel(n) stecken in keinem Set – kein Fach für den Backfill ableitbar. Von Hand einem Fach zuordnen, bevor diese Migration erneut läuft.',
      ohne_set;
  END IF;
END
$$;
--> statement-breakpoint

ALTER TABLE "vocab_item" ALTER COLUMN "subject_id" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "vocab_set_item" ALTER COLUMN "subject_id" SET NOT NULL;
--> statement-breakpoint

-- Erst die Unique-Constraints, gegen die die neuen zusammengesetzten
-- Fremdschlüssel unten zeigen – Postgres verlangt das Ziel vor dem Verweis
-- (42830 "no unique constraint matching given keys", sonst).
ALTER TABLE "vocab_item" ADD CONSTRAINT "vocab_item_id_student_id_subject_id_key" UNIQUE("id","student_id","subject_id");--> statement-breakpoint
ALTER TABLE "vocab_set" ADD CONSTRAINT "vocab_set_id_student_id_subject_id_key" UNIQUE("id","student_id","subject_id");--> statement-breakpoint

ALTER TABLE "vocab_item" ADD CONSTRAINT "vocab_item_subject_fk" FOREIGN KEY ("subject_id","student_id") REFERENCES "public"."subject"("id","student_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_set_item" ADD CONSTRAINT "vocab_set_item_set_fk" FOREIGN KEY ("vocab_set_id","student_id","subject_id") REFERENCES "public"."vocab_set"("id","student_id","subject_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_set_item" ADD CONSTRAINT "vocab_set_item_item_fk" FOREIGN KEY ("vocab_item_id","student_id","subject_id") REFERENCES "public"."vocab_item"("id","student_id","subject_id") ON DELETE cascade ON UPDATE no action;
