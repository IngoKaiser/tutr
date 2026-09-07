CREATE TABLE "student_credential" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"family_id" uuid NOT NULL,
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
	"family_id" uuid NOT NULL,
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
ALTER TABLE "family" ADD COLUMN "parent_email" text;--> statement-breakpoint
ALTER TABLE "family" ADD COLUMN "consent_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "student_credential" ADD CONSTRAINT "student_credential_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_credential" ADD CONSTRAINT "student_credential_student_fk" FOREIGN KEY ("student_id","family_id") REFERENCES "public"."student"("id","family_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_session" ADD CONSTRAINT "student_session_family_id_family_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."family"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_session" ADD CONSTRAINT "student_session_student_fk" FOREIGN KEY ("student_id","family_id") REFERENCES "public"."student"("id","family_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "student_session_student_idx" ON "student_session" USING btree ("student_id");