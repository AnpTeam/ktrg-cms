CREATE TYPE "public"."user_age_range" AS ENUM('under20', '20s', '30s', '40s', '50s', '60s', '70plus');--> statement-breakpoint
CREATE TYPE "public"."user_gender" AS ENUM('female', 'male', 'other', 'unspecified');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "age_range" "user_age_range";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "gender" "user_gender";