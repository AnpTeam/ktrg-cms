ALTER TABLE "routes" ADD COLUMN "line_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "line_source" text;