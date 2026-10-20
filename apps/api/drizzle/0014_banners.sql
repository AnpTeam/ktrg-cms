CREATE TABLE "banner_translations" (
	"banner_id" uuid NOT NULL,
	"locale" "user_locale" NOT NULL,
	"alt" text,
	CONSTRAINT "banner_translations_banner_id_locale_pk" PRIMARY KEY("banner_id","locale"),
	CONSTRAINT "banner_translations_ja_alt" CHECK ("banner_translations"."locale" <> 'ja' or "banner_translations"."alt" is not null)
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"image_url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "banner_translations" ADD CONSTRAINT "banner_translations_banner_id_banners_id_fk" FOREIGN KEY ("banner_id") REFERENCES "public"."banners"("id") ON DELETE cascade ON UPDATE no action;