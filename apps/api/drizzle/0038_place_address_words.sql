ALTER TABLE "place_translations" ADD COLUMN "address" text;--> statement-breakpoint
-- The address was one Japanese text on the place; it becomes a word like the name, so it can be given in English too.
UPDATE "place_translations" AS t SET "address" = p."address" FROM "places" AS p WHERE t."place_id" = p."id" AND t."locale" = 'ja' AND p."address" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "places" DROP COLUMN "address";
