CREATE TABLE "tutor_session_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutor_session_summary_session_id_key" UNIQUE("session_id")
);
--> statement-breakpoint
ALTER TABLE "tutor_session_summary" ADD CONSTRAINT "tutor_session_summary_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_session_summary" ADD CONSTRAINT "tutor_session_summary_session_fk" FOREIGN KEY ("session_id","student_id") REFERENCES "public"."tutor_session"("id","student_id") ON DELETE cascade ON UPDATE no action;