CREATE SEQUENCE "public"."user_public_id_seq";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "public_id" text DEFAULT lpad(((nextval('user_public_id_seq') * 48271) % 99999989)::text, 8, '0') NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_public_id_uq" ON "users" USING btree ("public_id");