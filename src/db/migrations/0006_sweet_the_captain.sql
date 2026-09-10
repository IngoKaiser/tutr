CREATE TYPE "public"."calendar_event_status" AS ENUM('geplant', 'abgesagt');--> statement-breakpoint
CREATE TYPE "public"."calendar_event_type" AS ENUM('klassenarbeit', 'test', 'muendlich', 'abgabe', 'sonstiges');--> statement-breakpoint
CREATE TABLE "calendar_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"type" "calendar_event_type" NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"status" "calendar_event_status" DEFAULT 'geplant' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "calendar_event_id_student_id_key" UNIQUE("id","student_id"),
	CONSTRAINT "calendar_event_id_subject_id_key" UNIQUE("id","subject_id")
);
--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_subject_fk" FOREIGN KEY ("subject_id","student_id") REFERENCES "public"."subject"("id","student_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calendar_event" ADD CONSTRAINT "calendar_event_school_year_fk" FOREIGN KEY ("school_year_id","student_id") REFERENCES "public"."school_year"("id","student_id") ON DELETE cascade ON UPDATE no action;