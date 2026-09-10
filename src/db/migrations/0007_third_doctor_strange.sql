CREATE TYPE "public"."ai_endpoint" AS ENUM('tutor', 'vision');--> statement-breakpoint
CREATE TYPE "public"."tutor_entry_point" AS ENUM('freie_frage', 'verstehen', 'vorschau', 'vertiefen', 'hausaufgabe', 'pruefung', 'nachbereitung');--> statement-breakpoint
CREATE TYPE "public"."tutor_message_role" AS ENUM('nutzer', 'tutor');--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"endpoint" "ai_endpoint" NOT NULL,
	"token_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "tutor_message_role" NOT NULL,
	"content" text NOT NULL,
	"token_count" integer,
	"language_ok" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tutor_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"topic_id" uuid,
	"title" text NOT NULL,
	"entry_point" "tutor_entry_point" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tutor_session_id_student_id_key" UNIQUE("id","student_id")
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_message" ADD CONSTRAINT "tutor_message_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_message" ADD CONSTRAINT "tutor_message_session_fk" FOREIGN KEY ("session_id","student_id") REFERENCES "public"."tutor_session"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_session" ADD CONSTRAINT "tutor_session_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_session" ADD CONSTRAINT "tutor_session_subject_fk" FOREIGN KEY ("subject_id","student_id") REFERENCES "public"."subject"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tutor_session" ADD CONSTRAINT "tutor_session_topic_fk" FOREIGN KEY ("topic_id","subject_id") REFERENCES "public"."topic"("id","subject_id") ON DELETE cascade ON UPDATE no action;