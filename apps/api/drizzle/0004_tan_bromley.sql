CREATE TYPE "public"."rally_kind" AS ENUM('mounds', 'course');--> statement-breakpoint
CREATE TABLE "rally_spots" (
	"rally_id" uuid NOT NULL,
	"spot_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rally_spots_rally_id_spot_id_pk" PRIMARY KEY("rally_id","spot_id")
);
--> statement-breakpoint
DROP INDEX "rallies_single_row_uq";--> statement-breakpoint
ALTER TABLE "rallies" ADD COLUMN "kind" "rally_kind" DEFAULT 'course' NOT NULL;--> statement-breakpoint
ALTER TABLE "rallies" ADD COLUMN "name_ja" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "rallies" ADD COLUMN "name_en" text;--> statement-breakpoint
ALTER TABLE "rallies" ADD COLUMN "route_id" uuid;--> statement-breakpoint
ALTER TABLE "rallies" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
-- Until now there was exactly one rally (the permanent one over the sutra mounds). It becomes the mound rally,
-- before the constraints below, which a course-kind row without a route would break.
UPDATE "rallies" SET "kind" = 'mounds', "name_ja" = '経塚スタンプラリー', "name_en" = 'Sutra mound stamp rally', "sort_order" = 0;--> statement-breakpoint
ALTER TABLE "rally_spots" ADD CONSTRAINT "rally_spots_rally_id_rallies_id_fk" FOREIGN KEY ("rally_id") REFERENCES "public"."rallies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rally_spots" ADD CONSTRAINT "rally_spots_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rally_spots_spot_idx" ON "rally_spots" USING btree ("spot_id");--> statement-breakpoint
ALTER TABLE "rallies" ADD CONSTRAINT "rallies_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "rallies_one_mounds_uq" ON "rallies" USING btree ("kind") WHERE "rallies"."kind" = 'mounds';--> statement-breakpoint
CREATE UNIQUE INDEX "rallies_route_uq" ON "rallies" USING btree ("route_id");--> statement-breakpoint
ALTER TABLE "rallies" ADD CONSTRAINT "rallies_route_matches_kind" CHECK (("rallies"."kind" = 'mounds' and "rallies"."route_id" is null) or ("rallies"."kind" = 'course' and "rallies"."route_id" is not null));