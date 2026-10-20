CREATE TYPE "public"."place_category" AS ENUM('souvenir_shop', 'restaurant', 'cafe', 'convenience_store', 'toilet', 'rest_area', 'drinking_water', 'vending_machine', 'station', 'bus_stop', 'parking', 'other');--> statement-breakpoint
CREATE TYPE "public"."place_status" AS ENUM('open', 'closed', 'seasonal', 'gone', 'unknown');--> statement-breakpoint
CREATE TABLE "place_translations" (
	"place_id" uuid NOT NULL,
	"locale" "content_locale" NOT NULL,
	"name" text,
	"description" text,
	"hours" text,
	"closed_days" text,
	CONSTRAINT "place_translations_place_id_locale_pk" PRIMARY KEY("place_id","locale"),
	CONSTRAINT "place_translations_ja_name" CHECK ("place_translations"."locale" <> 'ja' or "place_translations"."name" is not null)
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" "place_category" DEFAULT 'other' NOT NULL,
	"route_id" uuid,
	"lat" double precision,
	"lng" double precision,
	"position_verified" boolean DEFAULT false NOT NULL,
	"position_source" text,
	"address" text,
	"phone" text,
	"website" text,
	"photo_url" text,
	"status" "place_status" DEFAULT 'unknown' NOT NULL,
	"last_verified" date,
	"listing_confirmed" boolean DEFAULT false NOT NULL,
	"listing_note" text,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_lat_range" CHECK ("places"."lat" is null or "places"."lat" between -90 and 90),
	CONSTRAINT "places_lng_range" CHECK ("places"."lng" is null or "places"."lng" between -180 and 180),
	CONSTRAINT "places_coordinates_together" CHECK (("places"."lat" is null) = ("places"."lng" is null)),
	CONSTRAINT "places_publish_requires_position" CHECK (not "places"."published" or ("places"."lat" is not null and "places"."position_verified")),
	CONSTRAINT "places_publish_requires_listing" CHECK (not "places"."published" or "places"."listing_confirmed")
);
--> statement-breakpoint
ALTER TABLE "place_translations" ADD CONSTRAINT "place_translations_place_id_places_id_fk" FOREIGN KEY ("place_id") REFERENCES "public"."places"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "places_route_idx" ON "places" USING btree ("route_id");