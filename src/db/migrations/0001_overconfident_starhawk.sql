ALTER TABLE "student" ADD COLUMN "recovery_token_hash" text;--> statement-breakpoint
ALTER TABLE "student" ADD COLUMN "recovery_expires_at" timestamp with time zone;