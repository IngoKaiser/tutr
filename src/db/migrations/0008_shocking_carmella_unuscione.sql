CREATE TYPE "public"."homework_status" AS ENUM('offen', 'in_arbeit', 'geloest', 'loesung_gezeigt', 'uebersprungen');--> statement-breakpoint
CREATE TABLE "homework_task" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" text,
	"prompt" text NOT NULL,
	"status" "homework_status" DEFAULT 'offen' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"hint_level" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "homework_task_id_student_id_key" UNIQUE("id","student_id"),
	CONSTRAINT "homework_task_session_position_key" UNIQUE("session_id","position")
);
--> statement-breakpoint
ALTER TABLE "homework_task" ADD CONSTRAINT "homework_task_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "homework_task" ADD CONSTRAINT "homework_task_session_fk" FOREIGN KEY ("session_id","student_id") REFERENCES "public"."tutor_session"("id","student_id") ON DELETE cascade ON UPDATE no action;