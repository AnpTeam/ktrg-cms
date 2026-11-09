ALTER TABLE "blog_posts" ADD COLUMN "kind" text DEFAULT 'post' NOT NULL;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_slug_unique" UNIQUE("slug");--> statement-breakpoint
-- Made pages move into blog_posts as kind 'page', keeping their id, address, dates and words; site_pages stays as it is,
-- untouched, as a copy until a later release drops it.
INSERT INTO "blog_posts" ("id", "kind", "slug", "published_on", "published", "created_at", "updated_at")
SELECT "id", 'page', "slug", ("created_at" AT TIME ZONE 'Asia/Tokyo')::date, "published", "created_at", "updated_at" FROM "site_pages"
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
INSERT INTO "blog_post_translations" ("blog_post_id", "locale", "title", "body")
SELECT "id", 'ja', "title_ja", "body_ja" FROM "site_pages"
ON CONFLICT DO NOTHING;--> statement-breakpoint
INSERT INTO "blog_post_translations" ("blog_post_id", "locale", "title", "body")
SELECT "id", 'en', "title_en", "body_en" FROM "site_pages" WHERE "title_en" IS NOT NULL OR "body_en" IS NOT NULL
ON CONFLICT DO NOTHING;
