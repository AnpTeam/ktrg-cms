CREATE TABLE "rally_translations" (
	"rally_id" uuid NOT NULL,
	"locale" "user_locale" NOT NULL,
	"name" text,
	CONSTRAINT "rally_translations_rally_id_locale_pk" PRIMARY KEY("rally_id","locale"),
	CONSTRAINT "rally_translations_ja_name" CHECK ("rally_translations"."locale" <> 'ja' or "rally_translations"."name" is not null)
);
--> statement-breakpoint
CREATE TABLE "route_translations" (
	"route_id" uuid NOT NULL,
	"locale" "user_locale" NOT NULL,
	"name" text,
	"description" text,
	"history" text,
	"access" text,
	CONSTRAINT "route_translations_route_id_locale_pk" PRIMARY KEY("route_id","locale"),
	CONSTRAINT "route_translations_ja_name" CHECK ("route_translations"."locale" <> 'ja' or "route_translations"."name" is not null)
);
--> statement-breakpoint
CREATE TABLE "spot_translations" (
	"spot_id" uuid NOT NULL,
	"locale" "user_locale" NOT NULL,
	"name" text,
	"description" text,
	"status_note" text,
	CONSTRAINT "spot_translations_spot_id_locale_pk" PRIMARY KEY("spot_id","locale"),
	CONSTRAINT "spot_translations_ja_name" CHECK ("spot_translations"."locale" <> 'ja' or "spot_translations"."name" is not null)
);
--> statement-breakpoint
CREATE TABLE "trail_notice_translations" (
	"trail_notice_id" uuid NOT NULL,
	"locale" "user_locale" NOT NULL,
	"body" text,
	CONSTRAINT "trail_notice_translations_trail_notice_id_locale_pk" PRIMARY KEY("trail_notice_id","locale"),
	CONSTRAINT "trail_notice_translations_ja_body" CHECK ("trail_notice_translations"."locale" <> 'ja' or "trail_notice_translations"."body" is not null)
);
--> statement-breakpoint
ALTER TABLE "rally_translations" ADD CONSTRAINT "rally_translations_rally_id_rallies_id_fk" FOREIGN KEY ("rally_id") REFERENCES "public"."rallies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "route_translations" ADD CONSTRAINT "route_translations_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spot_translations" ADD CONSTRAINT "spot_translations_spot_id_spots_id_fk" FOREIGN KEY ("spot_id") REFERENCES "public"."spots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trail_notice_translations" ADD CONSTRAINT "trail_notice_translations_trail_notice_id_trail_notices_id_fk" FOREIGN KEY ("trail_notice_id") REFERENCES "public"."trail_notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Move the words into the new tables before the old columns go: a Japanese row for every owner, an English row
-- only where some English text exists.
INSERT INTO "route_translations" ("route_id", "locale", "name", "description", "history", "access")
	SELECT "id", 'ja', "name_ja", "description_ja", "history_ja", "access_ja" FROM "routes";--> statement-breakpoint
INSERT INTO "route_translations" ("route_id", "locale", "name", "description", "history", "access")
	SELECT "id", 'en', "name_en", "description_en", "history_en", "access_en" FROM "routes"
	WHERE coalesce("name_en", "description_en", "history_en", "access_en") IS NOT NULL;--> statement-breakpoint
INSERT INTO "spot_translations" ("spot_id", "locale", "name", "description", "status_note")
	SELECT "id", 'ja', "name_ja", "description_ja", "status_note_ja" FROM "spots";--> statement-breakpoint
INSERT INTO "spot_translations" ("spot_id", "locale", "name", "description", "status_note")
	SELECT "id", 'en', "name_en", "description_en", "status_note_en" FROM "spots"
	WHERE coalesce("name_en", "description_en", "status_note_en") IS NOT NULL;--> statement-breakpoint
INSERT INTO "rally_translations" ("rally_id", "locale", "name")
	SELECT "id", 'ja', "name_ja" FROM "rallies";--> statement-breakpoint
INSERT INTO "rally_translations" ("rally_id", "locale", "name")
	SELECT "id", 'en', "name_en" FROM "rallies" WHERE "name_en" IS NOT NULL;--> statement-breakpoint
INSERT INTO "trail_notice_translations" ("trail_notice_id", "locale", "body")
	SELECT "id", 'ja', "body_ja" FROM "trail_notices";--> statement-breakpoint
INSERT INTO "trail_notice_translations" ("trail_notice_id", "locale", "body")
	SELECT "id", 'en', "body_en" FROM "trail_notices" WHERE "body_en" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "rallies" DROP COLUMN "name_ja";--> statement-breakpoint
ALTER TABLE "rallies" DROP COLUMN "name_en";--> statement-breakpoint
ALTER TABLE "routes" DROP COLUMN "name_ja";--> statement-breakpoint
ALTER TABLE "routes" DROP COLUMN "name_en";--> statement-breakpoint
ALTER TABLE "routes" DROP COLUMN "description_ja";--> statement-breakpoint
ALTER TABLE "routes" DROP COLUMN "description_en";--> statement-breakpoint
ALTER TABLE "routes" DROP COLUMN "history_ja";--> statement-breakpoint
ALTER TABLE "routes" DROP COLUMN "history_en";--> statement-breakpoint
ALTER TABLE "routes" DROP COLUMN "access_ja";--> statement-breakpoint
ALTER TABLE "routes" DROP COLUMN "access_en";--> statement-breakpoint
ALTER TABLE "spots" DROP COLUMN "name_ja";--> statement-breakpoint
ALTER TABLE "spots" DROP COLUMN "name_en";--> statement-breakpoint
ALTER TABLE "spots" DROP COLUMN "description_ja";--> statement-breakpoint
ALTER TABLE "spots" DROP COLUMN "description_en";--> statement-breakpoint
ALTER TABLE "spots" DROP COLUMN "status_note_ja";--> statement-breakpoint
ALTER TABLE "spots" DROP COLUMN "status_note_en";--> statement-breakpoint
ALTER TABLE "trail_notices" DROP COLUMN "body_ja";--> statement-breakpoint
ALTER TABLE "trail_notices" DROP COLUMN "body_en";