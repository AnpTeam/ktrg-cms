ALTER TABLE "places" ADD COLUMN "near_spot_id" uuid;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_near_spot_id_spots_id_fk" FOREIGN KEY ("near_spot_id") REFERENCES "public"."spots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "places_near_spot_idx" ON "places" USING btree ("near_spot_id");