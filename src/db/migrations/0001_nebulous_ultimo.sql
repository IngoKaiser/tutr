CREATE TYPE "public"."textbook_source" AS ENUM('foto', 'manuell', 'claude_vorwissen', 'verlags_pdf');--> statement-breakpoint
CREATE TABLE "chapter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid,
	"textbook_id" uuid NOT NULL,
	"title" text NOT NULL,
	"pages" text,
	"sequence" integer DEFAULT 0 NOT NULL,
	"units" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_year_textbook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"textbook_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_year_textbook_year_subject_key" UNIQUE("school_year_id","subject_id")
);
--> statement-breakpoint
CREATE TABLE "textbook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid,
	"title" text NOT NULL,
	"subject" text NOT NULL,
	"grade_level" integer,
	"publisher" text,
	"source" textbook_source,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_profile" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid,
	"name" text,
	"federal_state" text NOT NULL,
	"school_type" text NOT NULL,
	"grading_scale" jsonb,
	"holidays" jsonb,
	"calendar_import_source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_textbook_id_textbook_id_fk" FOREIGN KEY ("textbook_id") REFERENCES "public"."textbook"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_textbook" ADD CONSTRAINT "school_year_textbook_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_textbook" ADD CONSTRAINT "school_year_textbook_student_fk" FOREIGN KEY ("student_id","family_id") REFERENCES "public"."student"("id","family_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_textbook" ADD CONSTRAINT "school_year_textbook_school_year_fk" FOREIGN KEY ("school_year_id","student_id") REFERENCES "public"."school_year"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_textbook" ADD CONSTRAINT "school_year_textbook_subject_fk" FOREIGN KEY ("subject_id","student_id") REFERENCES "public"."subject"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_textbook" ADD CONSTRAINT "school_year_textbook_textbook_id_textbook_id_fk" FOREIGN KEY ("textbook_id") REFERENCES "public"."textbook"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textbook" ADD CONSTRAINT "textbook_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_profile" ADD CONSTRAINT "school_profile_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;