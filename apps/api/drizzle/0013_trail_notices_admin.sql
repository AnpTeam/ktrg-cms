ALTER TABLE "trail_notices" ALTER COLUMN "route_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "trail_notices" ALTER COLUMN "verified_at" SET DATA TYPE date USING ("verified_at" AT TIME ZONE 'Asia/Tokyo')::date;--> statement-breakpoint
ALTER TABLE "trail_notices" ALTER COLUMN "expires_at" SET DATA TYPE date USING ("expires_at" AT TIME ZONE 'Asia/Tokyo')::date;--> statement-breakpoint
ALTER TABLE "trail_notice_translations" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "trail_notice_translations" ADD COLUMN "source_name" text;--> statement-breakpoint
ALTER TABLE "trail_notices" ADD COLUMN "published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "trail_notice_translations" ADD CONSTRAINT "trail_notice_translations_ja_title" CHECK ("trail_notice_translations"."locale" <> 'ja' or "trail_notice_translations"."title" is not null);