ALTER TABLE "users" ADD COLUMN "restricted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "restricted_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "restriction_reason" text;