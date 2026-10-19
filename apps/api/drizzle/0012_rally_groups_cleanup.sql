-- The rally model of 2026-10-19: a rally is made of places (rally_spots) or of courses (rally_routes), chosen when
-- it is created. 0011 moved the data; this drops what the old model needed. Hand-ordered: the enum value is renamed
-- (not dropped and recreated) so the existing sutra-mound rally keeps working as a rally of places.
DROP INDEX "rallies_one_mounds_uq";--> statement-breakpoint
DROP INDEX "rallies_route_uq";--> statement-breakpoint
ALTER TABLE "rallies" DROP CONSTRAINT "rallies_route_matches_kind";--> statement-breakpoint
ALTER TABLE "rallies" DROP CONSTRAINT "rallies_stamps_required_positive";--> statement-breakpoint
ALTER TABLE "rallies" DROP CONSTRAINT "rallies_dates_ordered";--> statement-breakpoint
ALTER TABLE "rallies" DROP CONSTRAINT "rallies_route_id_routes_id_fk";--> statement-breakpoint
ALTER TYPE "public"."rally_kind" RENAME VALUE 'mounds' TO 'places';--> statement-breakpoint
ALTER TABLE "rallies" DROP COLUMN "route_id";--> statement-breakpoint
ALTER TABLE "rallies" DROP COLUMN "verification";--> statement-breakpoint
ALTER TABLE "rallies" DROP COLUMN "stamps_required";--> statement-breakpoint
ALTER TABLE "rallies" DROP COLUMN "starts_at";--> statement-breakpoint
ALTER TABLE "rallies" DROP COLUMN "ends_at";
