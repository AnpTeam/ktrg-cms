ALTER TABLE "spots" ADD COLUMN "position_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "spots" ADD COLUMN "position_source" text;--> statement-breakpoint
-- Places that were already published had their positions entered by an admin, so they stay publishable.
UPDATE "spots" SET "position_verified" = true WHERE "published";--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_publish_requires_verified_position" CHECK (not "spots"."published" or "spots"."position_verified");