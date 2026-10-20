CREATE TYPE "public"."content_locale" AS ENUM('ja', 'en', 'de', 'fr', 'th', 'es');--> statement-breakpoint
-- The "Japanese is required" checks compare locale with a user_locale value: drop them while the column type
-- changes, then add them back against content_locale.
ALTER TABLE "route_translations" DROP CONSTRAINT "route_translations_ja_name";--> statement-breakpoint
ALTER TABLE "spot_translations" DROP CONSTRAINT "spot_translations_ja_name";--> statement-breakpoint
ALTER TABLE "rally_translations" DROP CONSTRAINT "rally_translations_ja_name";--> statement-breakpoint
ALTER TABLE "trail_notice_translations" DROP CONSTRAINT "trail_notice_translations_ja_body";--> statement-breakpoint
ALTER TABLE "trail_notice_translations" DROP CONSTRAINT "trail_notice_translations_ja_title";--> statement-breakpoint
ALTER TABLE "banner_translations" DROP CONSTRAINT "banner_translations_ja_alt";--> statement-breakpoint
ALTER TABLE "banner_translations" ALTER COLUMN "locale" SET DATA TYPE "public"."content_locale" USING "locale"::text::"public"."content_locale";--> statement-breakpoint
ALTER TABLE "rally_translations" ALTER COLUMN "locale" SET DATA TYPE "public"."content_locale" USING "locale"::text::"public"."content_locale";--> statement-breakpoint
ALTER TABLE "route_translations" ALTER COLUMN "locale" SET DATA TYPE "public"."content_locale" USING "locale"::text::"public"."content_locale";--> statement-breakpoint
ALTER TABLE "spot_translations" ALTER COLUMN "locale" SET DATA TYPE "public"."content_locale" USING "locale"::text::"public"."content_locale";--> statement-breakpoint
ALTER TABLE "trail_notice_translations" ALTER COLUMN "locale" SET DATA TYPE "public"."content_locale" USING "locale"::text::"public"."content_locale";--> statement-breakpoint
ALTER TABLE "route_translations" ADD CONSTRAINT "route_translations_ja_name" CHECK ("route_translations"."locale" <> 'ja' or "route_translations"."name" is not null);--> statement-breakpoint
ALTER TABLE "spot_translations" ADD CONSTRAINT "spot_translations_ja_name" CHECK ("spot_translations"."locale" <> 'ja' or "spot_translations"."name" is not null);--> statement-breakpoint
ALTER TABLE "rally_translations" ADD CONSTRAINT "rally_translations_ja_name" CHECK ("rally_translations"."locale" <> 'ja' or "rally_translations"."name" is not null);--> statement-breakpoint
ALTER TABLE "trail_notice_translations" ADD CONSTRAINT "trail_notice_translations_ja_body" CHECK ("trail_notice_translations"."locale" <> 'ja' or "trail_notice_translations"."body" is not null);--> statement-breakpoint
ALTER TABLE "trail_notice_translations" ADD CONSTRAINT "trail_notice_translations_ja_title" CHECK ("trail_notice_translations"."locale" <> 'ja' or "trail_notice_translations"."title" is not null);--> statement-breakpoint
ALTER TABLE "banner_translations" ADD CONSTRAINT "banner_translations_ja_alt" CHECK ("banner_translations"."locale" <> 'ja' or "banner_translations"."alt" is not null);
