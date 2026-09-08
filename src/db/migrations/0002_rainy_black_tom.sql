CREATE TYPE "public"."card_state" AS ENUM('neu', 'lernen', 'wiederholen', 'erneut_lernen');--> statement-breakpoint
CREATE TYPE "public"."review_rating" AS ENUM('nochmal', 'schwierig', 'gut', 'leicht');--> statement-breakpoint
CREATE TYPE "public"."vocab_direction" AS ENUM('vorwaerts', 'rueckwaerts');--> statement-breakpoint
CREATE TABLE "card" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"vocab_item_id" uuid,
	"objective_id" uuid,
	"direction" "vocab_direction",
	"fsrs_state" jsonb NOT NULL,
	"due_at" timestamp with time zone DEFAULT now() NOT NULL,
	"state" "card_state" DEFAULT 'neu' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_id_student_id_key" UNIQUE("id","student_id"),
	CONSTRAINT "card_vocab_item_direction_key" UNIQUE("vocab_item_id","direction"),
	CONSTRAINT "card_exactly_one_source" CHECK ((vocab_item_id is not null) <> (objective_id is not null)),
	CONSTRAINT "card_direction_only_for_vocab" CHECK ((vocab_item_id is null) = (direction is null))
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"card_id" uuid NOT NULL,
	"rating" "review_rating" NOT NULL,
	"reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"response_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vocab_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"term" text NOT NULL,
	"translation" text NOT NULL,
	"part_of_speech" text,
	"example" text,
	"hint" text,
	"page" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vocab_item_id_student_id_key" UNIQUE("id","student_id")
);
--> statement-breakpoint
CREATE TABLE "vocab_set" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"chapter_id" uuid,
	"unit" text,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vocab_set_id_student_id_key" UNIQUE("id","student_id")
);
--> statement-breakpoint
CREATE TABLE "vocab_set_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"vocab_set_id" uuid NOT NULL,
	"vocab_item_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vocab_set_item_pair_key" UNIQUE("vocab_set_id","vocab_item_id")
);
--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_vocab_item_fk" FOREIGN KEY ("vocab_item_id","student_id") REFERENCES "public"."vocab_item"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card" ADD CONSTRAINT "card_objective_fk" FOREIGN KEY ("objective_id","student_id") REFERENCES "public"."learning_objective"("id","student_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_card_fk" FOREIGN KEY ("card_id","student_id") REFERENCES "public"."card"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_item" ADD CONSTRAINT "vocab_item_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_set" ADD CONSTRAINT "vocab_set_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_set" ADD CONSTRAINT "vocab_set_subject_fk" FOREIGN KEY ("subject_id","student_id") REFERENCES "public"."subject"("id","student_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_set" ADD CONSTRAINT "vocab_set_chapter_id_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapter"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_set_item" ADD CONSTRAINT "vocab_set_item_student_id_student_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."student"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_set_item" ADD CONSTRAINT "vocab_set_item_set_fk" FOREIGN KEY ("vocab_set_id","student_id") REFERENCES "public"."vocab_set"("id","student_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vocab_set_item" ADD CONSTRAINT "vocab_set_item_item_fk" FOREIGN KEY ("vocab_item_id","student_id") REFERENCES "public"."vocab_item"("id","student_id") ON DELETE cascade ON UPDATE no action;