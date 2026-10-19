CREATE TYPE "public"."user_origin" AS ENUM('osaka', 'wakayama', 'nara', 'other_japan', 'overseas');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "origin" "user_origin";