ALTER TABLE "routes" ADD COLUMN "municipalities" text[] DEFAULT '{}'::text[] NOT NULL;
--> statement-breakpoint
-- A course can run through several cities (2026-11-11): the old single text, which lists them separated by 、 (or , or ，)
-- in walking order, becomes the array. Blanks are dropped and the order is kept. The old column is dropped by the next migration.
UPDATE "routes"
SET "municipalities" = ARRAY(
  SELECT btrim(part)
  FROM unnest(regexp_split_to_array("municipality", '[、,，]')) WITH ORDINALITY AS t(part, n)
  WHERE btrim(part) <> ''
  ORDER BY n
)
WHERE "municipality" IS NOT NULL AND btrim("municipality") <> '';
