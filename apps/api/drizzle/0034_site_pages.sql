CREATE TABLE "site_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title_ja" text NOT NULL,
	"title_en" text,
	"body_ja" text DEFAULT '' NOT NULL,
	"body_en" text,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "site_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
-- Supabase serves every public-schema table through PostgREST, guarded only by row level security, and 0019 turned it
-- on for the tables that existed then. Tables made since need the same: on with no policies, so the outside API sees
-- nothing while the app (connecting as the table owner) is unaffected. furigana_words (0032) missed it.
ALTER TABLE "site_pages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "furigana_words" ENABLE ROW LEVEL SECURITY;
