ALTER TABLE "sessions" ADD COLUMN "rotated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "previous_token_hash" text;--> statement-breakpoint
CREATE INDEX "sessions_previous_token_idx" ON "sessions" USING btree ("previous_token_hash");