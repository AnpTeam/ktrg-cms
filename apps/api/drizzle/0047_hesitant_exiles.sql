CREATE TABLE "spot_routes" (
	"spot_id" uuid NOT NULL,
	"route_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "spot_routes_spot_id_route_id_pk" PRIMARY KEY("spot_id","route_id"),
	CONSTRAINT "spot_routes_position_not_negative" CHECK ("spot_routes"."position" >= 0)
);
--> statement-breakpoint
ALTER TABLE "spot_routes" ADD CONSTRAINT "spot_routes_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_routes" ADD CONSTRAINT "spot_routes_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spot_routes_route_idx" ON "spot_routes" USING btree ("route_id");
--> statement-breakpoint
CREATE VIEW "route_spots" AS
  SELECT "route_id", "id" AS "spot_id" FROM "spots"
  UNION ALL
  SELECT "route_id", "spot_id" FROM "spot_routes";
