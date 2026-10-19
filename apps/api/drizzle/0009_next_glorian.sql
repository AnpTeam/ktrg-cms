CREATE TYPE "public"."spot_kind" AS ENUM('stamp', 'turn', 'danger', 'view', 'toilet', 'rest_area', 'drinking_water', 'vending_machine', 'bus_stop', 'station', 'parking', 'other');--> statement-breakpoint
ALTER TABLE "spots" DROP CONSTRAINT "spots_publish_requires_permission";--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "history_ja" text;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "history_en" text;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "access_ja" text;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "access_en" text;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "spots" ADD COLUMN "kind" "spot_kind" DEFAULT 'stamp' NOT NULL;--> statement-breakpoint
ALTER TABLE "spots" ADD COLUMN "photo_url" text;--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_publish_requires_permission" CHECK (not "spots"."published" or "spots"."permission_confirmed" or "spots"."kind" <> 'stamp');