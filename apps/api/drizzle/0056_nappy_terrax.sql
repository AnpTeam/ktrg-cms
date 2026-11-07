ALTER TABLE "users" ADD COLUMN "deletion_by_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deletion_appeal" text;