-- Waypoints: "can visitors stamp here" is its own switch (spots.stampable) instead of the kind "stamp", so a temple or a
-- viewpoint can be either. Hand-ordered (the generated SQL would fail on existing rows): the switch is filled from the
-- old kind first, then the kind list is replaced. An old stamp place becomes kind "other" with the switch on (an admin
-- can pick temple or sutra mound later); no row, stamp or rally link is touched.
ALTER TABLE "spots" ADD COLUMN "stampable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "spots" SET "stampable" = true WHERE "kind" = 'stamp';--> statement-breakpoint
ALTER TABLE "spots" DROP CONSTRAINT "spots_publish_requires_permission";--> statement-breakpoint
ALTER TABLE "spots" ALTER COLUMN "kind" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "spots" ALTER COLUMN "kind" SET DATA TYPE text;--> statement-breakpoint
UPDATE "spots" SET "kind" = 'other' WHERE "kind" = 'stamp';--> statement-breakpoint
DROP TYPE "public"."spot_kind";--> statement-breakpoint
CREATE TYPE "public"."spot_kind" AS ENUM('temple', 'mound', 'view', 'turn', 'danger', 'toilet', 'rest_area', 'drinking_water', 'vending_machine', 'bus_stop', 'station', 'parking', 'other');--> statement-breakpoint
ALTER TABLE "spots" ALTER COLUMN "kind" SET DATA TYPE "public"."spot_kind" USING "kind"::"public"."spot_kind";--> statement-breakpoint
ALTER TABLE "spots" ALTER COLUMN "kind" SET DEFAULT 'other';--> statement-breakpoint
ALTER TABLE "spots" ADD CONSTRAINT "spots_publish_requires_permission" CHECK (not "spots"."published" or "spots"."permission_confirmed" or not "spots"."stampable");
