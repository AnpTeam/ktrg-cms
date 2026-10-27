CREATE TABLE "visit_counts" (
	"day" date NOT NULL,
	"country" text NOT NULL,
	"region" text NOT NULL,
	"city" text NOT NULL,
	"path" text NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "visit_counts_day_country_region_city_path_pk" PRIMARY KEY("day","country","region","city","path")
);
--> statement-breakpoint
CREATE INDEX "visit_counts_path_idx" ON "visit_counts" USING btree ("path","day");
--> statement-breakpoint
ALTER TABLE "visit_counts" ENABLE ROW LEVEL SECURITY;
