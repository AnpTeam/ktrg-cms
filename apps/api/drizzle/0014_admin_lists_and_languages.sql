-- Admin lists and content languages (merged from the notices, banners and languages work).
--
-- Trail notices: no route means the whole trail; a draft flag; days (Japan time) instead of timestamps; a title and
-- a source name per language. Banners: the home page photos. Content languages: the translation tables' locale gets
-- its own list (content_locale: ja, en, de, fr, th, es), apart from user_locale (the website language).
--
-- Hand-ordered: the "Japanese is required" checks compare locale with a literal, which Postgres resolved against the
-- old type, so they are dropped while the column type changes and added back afterwards.
CREATE TYPE "public"."content_locale" AS ENUM('ja', 'en', 'de', 'fr', 'th', 'es');--> statement-breakpoint
ALTER TABLE "trail_notices" ALTER COLUMN "route_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "trail_notices" ALTER COLUMN "verified_at" SET DATA TYPE date USING ("verified_at" AT TIME ZONE 'Asia/Tokyo')::date;--> statement-breakpoint
ALTER TABLE "trail_notices" ALTER COLUMN "expires_at" SET DATA TYPE date USING ("expires_at" AT TIME ZONE 'Asia/Tokyo')::date;--> statement-breakpoint
ALTER TABLE "trail_notices" ADD COLUMN "published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trail_notice_translations" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "trail_notice_translations" ADD COLUMN "source_name" text;--> statement-breakpoint
CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banner_translations" (
	"banner_id" uuid NOT NULL,
	"locale" "content_locale" NOT NULL,
	"alt" text,
	CONSTRAINT "banner_translations_banner_id_locale_pk" PRIMARY KEY("banner_id","locale"),
	CONSTRAINT "banner_translations_ja_alt" CHECK ("banner_translations"."locale" <> 'ja' or "banner_translations"."alt" is not null)
);
--> statement-breakpoint
ALTER TABLE "banner_translations" ADD CONSTRAINT "banner_translations_banner_id_banners_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_translations" DROP CONSTRAINT "route_translations_ja_name";--> statement-breakpoint
ALTER TABLE "spot_translations" DROP CONSTRAINT "spot_translations_ja_name";--> statement-breakpoint
ALTER TABLE "rally_translations" DROP CONSTRAINT "rally_translations_ja_name";--> statement-breakpoint
ALTER TABLE "trail_notice_translations" DROP CONSTRAINT "trail_notice_translations_ja_body";--> statement-breakpoint
ALTER TABLE "route_translations" ALTER COLUMN "locale" SET DATA TYPE "public"."content_locale" USING "locale"::text::"public"."content_locale";--> statement-breakpoint
ALTER TABLE "spot_translations" ALTER COLUMN "locale" SET DATA TYPE "public"."content_locale" USING "locale"::text::"public"."content_locale";--> statement-breakpoint
ALTER TABLE "rally_translations" ALTER COLUMN "locale" SET DATA TYPE "public"."content_locale" USING "locale"::text::"public"."content_locale";--> statement-breakpoint
ALTER TABLE "trail_notice_translations" ALTER COLUMN "locale" SET DATA TYPE "public"."content_locale" USING "locale"::text::"public"."content_locale";--> statement-breakpoint
ALTER TABLE "route_translations" ADD CONSTRAINT "route_translations_ja_name" CHECK ("route_translations"."locale" <> 'ja' or "route_translations"."name" is not null);--> statement-breakpoint
ALTER TABLE "spot_translations" ADD CONSTRAINT "spot_translations_ja_name" CHECK ("spot_translations"."locale" <> 'ja' or "spot_translations"."name" is not null);--> statement-breakpoint
ALTER TABLE "rally_translations" ADD CONSTRAINT "rally_translations_ja_name" CHECK ("rally_translations"."locale" <> 'ja' or "rally_translations"."name" is not null);--> statement-breakpoint
ALTER TABLE "trail_notice_translations" ADD CONSTRAINT "trail_notice_translations_ja_body" CHECK ("trail_notice_translations"."locale" <> 'ja' or "trail_notice_translations"."body" is not null);--> statement-breakpoint
ALTER TABLE "trail_notice_translations" ADD CONSTRAINT "trail_notice_translations_ja_title" CHECK ("trail_notice_translations"."locale" <> 'ja' or "trail_notice_translations"."title" is not null);
