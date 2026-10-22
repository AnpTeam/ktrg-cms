ALTER TABLE "banners" ADD COLUMN "image_credit" text;--> statement-breakpoint
ALTER TABLE "places" ADD COLUMN "photo_credit" text;--> statement-breakpoint
ALTER TABLE "route_translations" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "photo_credit" text;--> statement-breakpoint
ALTER TABLE "spot_translations" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "spots" ADD COLUMN "photo_credit" text;