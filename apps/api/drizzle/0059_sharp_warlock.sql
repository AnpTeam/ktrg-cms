CREATE TABLE "blog_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_ja" text NOT NULL,
	"name_en" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "tag_ids" uuid[] DEFAULT '{}'::uuid[] NOT NULL;