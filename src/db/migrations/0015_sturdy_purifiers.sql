CREATE TYPE "public"."calendar_event_source" AS ENUM('manuell', 'bild', 'datei');--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "groups" text[];--> statement-breakpoint
ALTER TABLE "calendar_event" ADD COLUMN "source" "calendar_event_source" DEFAULT 'manuell' NOT NULL;--> statement-breakpoint
ALTER TABLE "school_year" ADD COLUMN "own_groups" text[];