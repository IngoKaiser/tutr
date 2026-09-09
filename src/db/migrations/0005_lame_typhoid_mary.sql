-- Schuljahr als Sichtfenster (F-16a, ADR 0009).
--
-- Von `drizzle-kit generate` nachbearbeitet, nicht unberührt übernommen:
-- `vocab_set.school_year_id` erst nullbar anlegen, befüllen, dann `set not
-- null` – dasselbe Muster wie 0003 für `vocab_item.subject_id`. Die
-- restliche Struktur bleibt aus dem Schema generiert.

CREATE TABLE "school_year_subject" (
	"student_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_year_subject_pair_key" UNIQUE("school_year_id","subject_id")
);
--> statement-breakpoint
ALTER TABLE "subject" ADD COLUMN "language" text;
--> statement-breakpoint

-- Erst nullbar, sonst scheitert das ALTER TABLE an vorhandenen Zeilen.
ALTER TABLE "vocab_set" ADD COLUMN "school_year_id" uuid;
--> statement-breakpoint

-- Jedes bestehende Set stammt aus dem *aktiven* Jahr seines Kindes – die
-- Tabelle gab es vorher nicht, also kann kein Set aus einem anderen Jahr
-- kommen.
UPDATE "vocab_set" vs
SET "school_year_id" = sy."id"
FROM "school_year" sy
WHERE sy."student_id" = vs."student_id" AND sy."status" = 'aktiv';
--> statement-breakpoint

-- Ein Set ohne aktives Schuljahr seines Kindes hätte keine eindeutige
-- Zuordnung – laut scheitern statt eines geratenen Werts, den der nächste
-- Schritt sonst klaglos in NOT NULL zwänge.
DO $$
DECLARE
  ohne_jahr integer;
BEGIN
  SELECT count(*) INTO ohne_jahr FROM "vocab_set" WHERE "school_year_id" IS NULL;
  IF ohne_jahr > 0 THEN
    RAISE EXCEPTION
      '% Vokabelset(s) ohne aktives Schuljahr des eigenen Kindes – Backfill für vocab_set.school_year_id nicht eindeutig. Von Hand auflösen, bevor diese Migration erneut läuft.',
      ohne_jahr;
  END IF;
END
$$;
--> statement-breakpoint

ALTER TABLE "vocab_set" ALTER COLUMN "school_year_id" SET NOT NULL;
--> statement-breakpoint

ALTER TABLE "school_year_subject" ADD CONSTRAINT "school_year_subject_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_subject" ADD CONSTRAINT "school_year_subject_year_fk" FOREIGN KEY ("school_year_id","student_id") REFERENCES "public"."school_year"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_subject" ADD CONSTRAINT "school_year_subject_subject_fk" FOREIGN KEY ("subject_id","student_id") REFERENCES "public"."subject"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_set" ADD CONSTRAINT "vocab_set_school_year_fk" FOREIGN KEY ("school_year_id","student_id") REFERENCES "public"."school_year"("id","student_id") ON DELETE restrict ON UPDATE no action;
