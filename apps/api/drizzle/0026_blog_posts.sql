CREATE TABLE "blog_post_translations" (
	"blog_post_id" uuid NOT NULL,
	"locale" "content_locale" NOT NULL,
	"title" text,
	"body" text,
	"author_name" text,
	CONSTRAINT "blog_post_translations_blog_post_id_locale_pk" PRIMARY KEY("blog_post_id","locale"),
	CONSTRAINT "blog_post_translations_ja_title" CHECK ("blog_post_translations"."locale" <> 'ja' or "blog_post_translations"."title" is not null),
	CONSTRAINT "blog_post_translations_ja_body" CHECK ("blog_post_translations"."locale" <> 'ja' or "blog_post_translations"."body" is not null)
);
--> statement-breakpoint
CREATE TABLE "blog_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cover_photo_url" text,
	"cover_credit" text,
	"author_photo_url" text,
	"published_on" date NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "blog_post_translations" ADD CONSTRAINT "blog_post_translations_blog_post_id_blog_posts_id_fk" FOREIGN KEY ("blog_post_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "blog_posts_public_idx" ON "blog_posts" USING btree ("published","published_on");--> statement-breakpoint
-- Supabase serves every public-schema table through PostgREST, guarded only by row level security, and 0019 turned
-- it on for every table that existed then. These are the first tables since, so they need the same: on with no
-- policies, so the outside API sees nothing while the app (connecting as the table owner) is unaffected.
ALTER TABLE "blog_posts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "blog_post_translations" ENABLE ROW LEVEL SECURITY;
