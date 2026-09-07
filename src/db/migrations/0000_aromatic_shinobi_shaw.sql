CREATE TYPE "public"."pathway_stage" AS ENUM('vorschau', 'verstehen', 'festigen', 'anwenden', 'pruefen', 'nachbereitung');--> statement-breakpoint
CREATE TYPE "public"."school_year_status" AS ENUM('geplant', 'aktiv', 'archiviert');--> statement-breakpoint
CREATE TYPE "public"."self_assessment_level" AS ENUM('neu', 'gehoert', 'grundlagen', 'versteht_gut', 'sicher');--> statement-breakpoint
CREATE TYPE "public"."topic_status" AS ENUM('vorauswahl', 'aktiv');--> statement-breakpoint
CREATE TABLE "learning_objective" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description_grundlegend" text,
	"description_regel" text,
	"description_erhoeht" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "learning_objective_id_student_id_key" UNIQUE("id","student_id"),
	CONSTRAINT "learning_objective_id_family_id_key" UNIQUE("id","family_id")
);
--> statement-breakpoint
CREATE TABLE "objective_prerequisite" (
	"family_id" uuid NOT NULL,
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
	"family_id" uuid NOT NULL,
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
	CONSTRAINT "school_year_id_student_id_key" UNIQUE("id","student_id"),
	CONSTRAINT "school_year_id_family_id_key" UNIQUE("id","family_id")
);
--> statement-breakpoint
CREATE TABLE "subject" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subject_id_student_id_key" UNIQUE("id","student_id"),
	CONSTRAINT "subject_id_family_id_key" UNIQUE("id","family_id"),
	CONSTRAINT "subject_student_id_name_key" UNIQUE("student_id","name")
);
--> statement-breakpoint
CREATE TABLE "topic" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
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
	CONSTRAINT "topic_id_student_id_key" UNIQUE("id","student_id"),
	CONSTRAINT "topic_id_family_id_key" UNIQUE("id","family_id")
);
--> statement-breakpoint
CREATE TABLE "family" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parent_user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"auth_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"consent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "parent_user_auth_user_id_key" UNIQUE("auth_user_id"),
	CONSTRAINT "parent_user_id_family_id_key" UNIQUE("id","family_id")
);
--> statement-breakpoint
CREATE TABLE "student" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
	"first_name" text NOT NULL,
	"grade_level" integer NOT NULL,
	"class_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_id_family_id_key" UNIQUE("id","family_id")
);
--> statement-breakpoint
ALTER TABLE "learning_objective" ADD CONSTRAINT "learning_objective_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_objective" ADD CONSTRAINT "learning_objective_student_id_family_id_student_id_family_id_fk" FOREIGN KEY ("student_id","family_id") REFERENCES "public"."student"("id","family_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_objective" ADD CONSTRAINT "learning_objective_topic_id_student_id_topic_id_student_id_fk" FOREIGN KEY ("topic_id","student_id") REFERENCES "public"."topic"("id","student_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_prerequisite" ADD CONSTRAINT "objective_prerequisite_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_prerequisite" ADD CONSTRAINT "objective_prerequisite_student_fk" FOREIGN KEY ("student_id","family_id") REFERENCES "public"."student"("id","family_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_prerequisite" ADD CONSTRAINT "objective_prerequisite_objective_fk" FOREIGN KEY ("objective_id","student_id") REFERENCES "public"."learning_objective"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objective_prerequisite" ADD CONSTRAINT "objective_prerequisite_prerequisite_fk" FOREIGN KEY ("prerequisite_objective_id","student_id") REFERENCES "public"."learning_objective"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year" ADD CONSTRAINT "school_year_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_year" ADD CONSTRAINT "school_year_student_id_family_id_student_id_family_id_fk" FOREIGN KEY ("student_id","family_id") REFERENCES "public"."student"("id","family_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subject" ADD CONSTRAINT "subject_student_id_family_id_student_id_family_id_fk" FOREIGN KEY ("student_id","family_id") REFERENCES "public"."student"("id","family_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_student_id_family_id_student_id_family_id_fk" FOREIGN KEY ("student_id","family_id") REFERENCES "public"."student"("id","family_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_subject_id_student_id_subject_id_student_id_fk" FOREIGN KEY ("subject_id","student_id") REFERENCES "public"."subject"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topic" ADD CONSTRAINT "topic_school_year_id_student_id_school_year_id_student_id_fk" FOREIGN KEY ("school_year_id","student_id") REFERENCES "public"."school_year"("id","student_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_user" ADD CONSTRAINT "parent_user_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student" ADD CONSTRAINT "student_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "school_year_one_active_per_student" ON "school_year" USING btree ("student_id") WHERE "school_year"."status" = 'aktiv';