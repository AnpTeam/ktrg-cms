ALTER TABLE "spot_translations" ADD COLUMN "history" text;--> statement-breakpoint
ALTER TABLE "spots" ADD COLUMN "photos" jsonb DEFAULT '[]'::jsonb NOT NULL;