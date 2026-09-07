CREATE TYPE "public"."pathway_stage" AS ENUM('vorschau', 'verstehen', 'festigen', 'anwenden', 'pruefen', 'nachbereitung');--> statement-breakpoint
CREATE TYPE "public"."school_year_status" AS ENUM('geplant', 'aktiv', 'archiviert');--> statement-breakpoint
CREATE TYPE "public"."self_assessment_level" AS ENUM('neu', 'gehoert', 'grundlagen', 'versteht_gut', 'sicher');--> statement-breakpoint
CREATE TYPE "public"."topic_status" AS ENUM('vorauswahl', 'aktiv');--> statement-breakpoint
CREATE TYPE "public"."textbook_source" AS ENUM('foto', 'manuell', 'claude_vorwissen', 'verlags_pdf');--> statement-breakpoint
CREATE TABLE "student_credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"public_key" text NOT NULL,
	"counter" bigint DEFAULT 0 NOT NULL,
	"transports" text[],
	"device_label" text,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_credential_credential_id_key" UNIQUE("credential_id")
);
--> statement-breakpoint
CREATE TABLE "student_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"device_label" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_session_token_hash_key" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "learning_objective" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description_grundlegend" text,
	"description_regel" text,
	"description_erhoeht" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_objective_id_student_id_key" UNIQUE("id","student_id")
);
--> statement-breakpoint
CREATE TABLE "objective_prerequisite" (
	"student_id" uuid NOT NULL,
	"objective_id" uuid NOT NULL,
	"prerequisite_objective_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "objective_prerequisite_pk" UNIQUE("objective_id","prerequisite_objective_id"),
	CONSTRAINT "objective_prerequisite_not_self" CHECK ("objective_prerequisite"."objective_id" <> "objective_prerequisite"."prerequisite_objective_id")
);
--> statement-breakpoint
CREATE TABLE "school_year" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"label" text NOT NULL,
	"grade_level" integer NOT NULL,
	"class_name" text,
	"school_profile_id" uuid,
	"curriculum_pack_id" uuid,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "school_year_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_year_id_student_id_key" UNIQUE("id","student_id")
);
--> statement-breakpoint
CREATE TABLE "subject" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subject_id_student_id_key" UNIQUE("id","student_id"),
	CONSTRAINT "subject_student_id_name_key" UNIQUE("student_id","name")
);
--> statement-breakpoint
CREATE TABLE "topic" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"school_year_id" uuid NOT NULL,
	"title" text NOT NULL,
	"source" text,
	"curriculum_node_ref" uuid,
	"textbook_ref" uuid,
	"status" "topic_status" NOT NULL,
	"sequence" integer DEFAULT 0 NOT NULL,
	"pathway_stage" "pathway_stage" DEFAULT 'vorschau' NOT NULL,
	"self_assessment" "self_assessment_level",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topic_id_subject_id_key" UNIQUE("id","subject_id"),
	CONSTRAINT "topic_id_student_id_key" UNIQUE("id","student_id")
);
--> statement-breakpoint
CREATE TABLE "student" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"grade_level" integer NOT NULL,
	"class_name" text,
	"parent_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_id_key" UNIQUE("id")
);
--> statement-breakpoint
CREATE TABLE "parent_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_account_auth_user_id_key" UNIQUE("auth_user_id"),
	CONSTRAINT "parent_account_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "parent_student" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_account_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_student_pair_key" UNIQUE("parent_account_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "chapter" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid,
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
	"student_id" uuid,
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
	"student_id" uuid,
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
ALTER TABLE "student_credential" ADD CONSTRAINT "student_credential_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_session" ADD CONSTRAINT "student_session_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_objective" ADD CONSTRAINT "learning_objective_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_objective" ADD CONSTRAINT "learning_objective_topic_id_student_id_topic_id_student_id_fk" FOREIGN KEY ("topic_id","student_id") REFERENCES "public"."topic"("id","student_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_prerequisite" ADD CONSTRAINT "objective_prerequisite_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_prerequisite" ADD CONSTRAINT "objective_prerequisite_objective_fk" FOREIGN KEY ("objective_id","student_id") REFERENCES "public"."learning_objective"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_prerequisite" ADD CONSTRAINT "objective_prerequisite_prerequisite_fk" FOREIGN KEY ("prerequisite_objective_id","student_id") REFERENCES "public"."learning_objective"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year" ADD CONSTRAINT "school_year_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_subject_id_student_id_subject_id_student_id_fk" FOREIGN KEY ("subject_id","student_id") REFERENCES "public"."subject"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_school_year_id_student_id_school_year_id_student_id_fk" FOREIGN KEY ("school_year_id","student_id") REFERENCES "public"."school_year"("id","student_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student" ADD CONSTRAINT "parent_student_parent_account_id_parent_account_id_fk" FOREIGN KEY ("parent_account_id") REFERENCES "public"."parent_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_student" ADD CONSTRAINT "parent_student_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chapter" ADD CONSTRAINT "chapter_textbook_id_textbook_id_fk" FOREIGN KEY ("textbook_id") REFERENCES "public"."textbook"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_textbook" ADD CONSTRAINT "school_year_textbook_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_textbook" ADD CONSTRAINT "school_year_textbook_school_year_fk" FOREIGN KEY ("school_year_id","student_id") REFERENCES "public"."school_year"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_textbook" ADD CONSTRAINT "school_year_textbook_subject_fk" FOREIGN KEY ("subject_id","student_id") REFERENCES "public"."subject"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year_textbook" ADD CONSTRAINT "school_year_textbook_textbook_id_textbook_id_fk" FOREIGN KEY ("textbook_id") REFERENCES "public"."textbook"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textbook" ADD CONSTRAINT "textbook_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_profile" ADD CONSTRAINT "school_profile_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_session_student_idx" ON "student_session" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "school_year_one_active_per_student" ON "school_year" USING btree ("student_id") WHERE "school_year"."status" = 'aktiv';